import {
  PULLED_TABLES,
  type PulledTable,
  type LocalSyncStore,
  type RemoteSyncStore,
  type SyncSteps,
  type SyncStep,
} from '../domain/sync-ports';

export type SyncResult = 'synced' | 'offline';

const PUSH_BATCH = 50;
const PULL_PAGE = 500;
/** How often a full refresh runs on its own (also after every app update). */
export const FULL_REFRESH_EVERY_MS = 24 * 60 * 60 * 1000;

export interface SyncEngineOptions {
  /** Identifies the app build; a new build triggers a full refresh on its first pass. */
  build?: string;
  now?: () => number;
}

/** What a pass re-pulls from scratch: every table, some tables, or none (incremental only). */
type RefreshScope = 'all' | ReadonlySet<PulledTable> | null;

/**
 * One sync pass: push local changes in order, then pull what changed on the server.
 * Last write wins per row; the local store keeps rows that still have unsent changes.
 * A call during a pass gets one follow-up pass, so a change saved mid-pass goes out right after
 * it instead of waiting for the next trigger. Further calls share that follow-up.
 *
 * Extra steps (file uploads, downloads) run after the push, when the rows they belong to are on
 * the server, and after the pull, when the device knows every row it can see. A step never stops
 * the pass; one that can't reach the server makes the pass report offline.
 *
 * Incremental pulls can miss rows (a transaction that commits a lower version after the cursor
 * moved past it, rows hidden by lost access, a damaged device store), so a full refresh re-pulls
 * every table from the start and removes local rows the server no longer returns. It runs on the
 * first pass ever, after an app update, once a day, and on request (`refresh`).
 */
export class SyncEngine {
  private running: Promise<SyncResult> | null = null;
  private followUp: Promise<SyncResult> | null = null;
  private requested: RefreshScope = null;
  private readonly build: string;
  private readonly now: () => number;

  constructor(
    private readonly local: LocalSyncStore,
    private readonly remote: RemoteSyncStore,
    private readonly steps: SyncSteps = {},
    options: SyncEngineOptions = {},
  ) {
    this.build = options.build ?? 'dev';
    this.now = options.now ?? Date.now;
  }

  /**
   * Runs a pass that re-pulls `tables` (all of them when omitted) from scratch. A request that
   * can't reach the server stays queued for the next pass.
   */
  refresh(tables?: readonly PulledTable[]): Promise<SyncResult> {
    this.request(tables ? new Set(tables) : 'all');
    return this.run();
  }

  run(): Promise<SyncResult> {
    if (this.running) {
      this.followUp ??= this.running.then(() => {
        this.followUp = null;
        return this.run();
      });
      return this.followUp;
    }
    this.running = this.pass().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async pass(): Promise<SyncResult> {
    if (!(await this.push())) return 'offline';
    const sent = await runSteps(this.steps.afterPush);
    const scope = await this.takeScope();
    const pulled = scope ? await this.pullFresh(scope) : await this.pull();
    if (!pulled) {
      if (scope) this.request(scope);
      return 'offline';
    }
    const fetched = await runSteps(this.steps.afterPull);
    if (!(sent && fetched)) return 'offline';
    await this.local.markSynced(this.now());
    return 'synced';
  }

  private request(scope: 'all' | ReadonlySet<PulledTable>) {
    const current = this.requested;
    if (scope === 'all' || current === 'all') this.requested = 'all';
    else this.requested = new Set([...(current ?? []), ...scope]);
  }

  /** The tables this pass re-pulls: what was requested, or all of them when a refresh is due. */
  private async takeScope(): Promise<RefreshScope> {
    const requested = this.requested;
    this.requested = null;
    if (requested === 'all') return 'all';
    const last = await this.local.lastFullRefresh();
    const now = this.now();
    const due =
      !last ||
      last.build !== this.build ||
      now - last.at >= FULL_REFRESH_EVERY_MS ||
      // The clock moved back: trust nothing about the elapsed time.
      last.at > now;
    return due ? 'all' : requested;
  }

  /** False when the server could not be reached; the remaining changes wait for the next pass. */
  private async push(): Promise<boolean> {
    for (;;) {
      const batch = await this.local.pendingChanges(PUSH_BATCH);
      if (batch.length === 0) return true;
      for (const change of batch) {
        const { outcome, reason } = await this.remote.push(change);
        if (outcome === 'transient') return false;
        if (outcome === 'rejected') await this.local.markRejected(change.id, reason ?? 'rejected');
        else await this.local.markPushed(change.id);
      }
    }
  }

  private async pull(): Promise<boolean> {
    if (!(await this.pullTables())) return false;
    // Pulls only bring rows the user can still see, so trips they left (or were removed from)
    // have to be cleaned up by comparing with the current memberships.
    const memberTripIds = await this.remote.memberTripIds();
    if (memberTripIds === null) return false;
    return this.keepTrips(memberTripIds);
  }

  /**
   * Re-pulls tables from the start. A partial refresh (after discarding a change) first runs the
   * usual incremental pull; a full one replaces it and records when it finished.
   */
  private async pullFresh(scope: 'all' | ReadonlySet<PulledTable>): Promise<boolean> {
    if (scope !== 'all') {
      if (!(await this.pull())) return false;
      return this.reload(PULLED_TABLES.filter((t) => scope.has(t)));
    }
    // A signed-out client would see no rows at all; never take that for "everything was deleted".
    const memberTripIds = await this.remote.memberTripIds();
    if (memberTripIds === null) return false;
    if (!(await this.reload(PULLED_TABLES))) return false;
    if (!(await this.keepTrips(memberTripIds))) return false;
    await this.local.markFullRefresh({ at: this.now(), build: this.build });
    return true;
  }

  /**
   * Pulls every row of the tables, page by page, then removes the local rows the server didn't
   * return. Nothing is removed unless every page of every table arrived.
   */
  private async reload(tables: readonly PulledTable[]): Promise<boolean> {
    const live = new Map<PulledTable, Set<string>>();
    for (const table of tables) {
      const ids = new Set<string>();
      let since = 0;
      for (;;) {
        const rows = await this.remote.pull(table, since, PULL_PAGE);
        if (rows === null) return false;
        // The cursor ends at the newest version the server has, even if the device's was off.
        if (rows.length === 0 && since === 0) await this.local.applyRemote(table, [], 0);
        if (rows.length === 0) break;
        since = rows[rows.length - 1]!.version;
        for (const row of rows) if (!row.deleted_at) ids.add(this.local.localId(table, row));
        await this.local.applyRemote(table, rows, since);
        if (rows.length < PULL_PAGE) break;
      }
      live.set(table, ids);
    }
    for (const [table, ids] of live) await this.local.removeMissing(table, ids);
    return true;
  }

  private async keepTrips(memberTripIds: string[]): Promise<boolean> {
    const { missing } = await this.local.keepTrips(memberTripIds);
    if (missing.length === 0) return true;
    // A trip joined since the last pass: its rows carry versions older than the cursors, so
    // incremental pulls would skip them. Pull everything again (rows already here are kept).
    await this.local.resetCursors();
    return this.pullTables();
  }

  private async pullTables(): Promise<boolean> {
    for (const table of PULLED_TABLES) {
      let since = await this.local.cursor(table);
      for (;;) {
        const rows = await this.remote.pull(table, since, PULL_PAGE);
        if (rows === null) return false;
        if (rows.length === 0) break;
        since = rows[rows.length - 1]!.version;
        await this.local.applyRemote(table, rows, since);
        if (rows.length < PULL_PAGE) break;
      }
    }
    return true;
  }
}

/** True when every step reached the server. A step that throws counts as unreachable. */
async function runSteps(steps: readonly SyncStep[] = []): Promise<boolean> {
  let reached = true;
  for (const step of steps) {
    try {
      reached = (await step()) && reached;
    } catch (error) {
      console.error('Sync step failed', error);
      reached = false;
    }
  }
  return reached;
}
