import {
  PULLED_TABLES,
  type LocalSyncStore,
  type RemoteSyncStore,
  type SyncSteps,
  type SyncStep,
} from '../domain/sync-ports';

export type SyncResult = 'synced' | 'offline';

const PUSH_BATCH = 50;
const PULL_PAGE = 500;

/**
 * One sync pass: push local changes in order, then pull what changed on the server.
 * Last write wins per row; the local store keeps rows that still have unsent changes.
 * A call during a pass gets one follow-up pass, so a change saved mid-pass goes out right after
 * it instead of waiting for the next trigger. Further calls share that follow-up.
 *
 * Extra steps (file uploads, downloads) run after the push, when the rows they belong to are on
 * the server, and after the pull, when the device knows every row it can see. A step never stops
 * the pass; one that can't reach the server makes the pass report offline.
 */
export class SyncEngine {
  private running: Promise<SyncResult> | null = null;
  private followUp: Promise<SyncResult> | null = null;

  constructor(
    private readonly local: LocalSyncStore,
    private readonly remote: RemoteSyncStore,
    private readonly steps: SyncSteps = {},
  ) {}

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
    if (!(await this.pull())) return 'offline';
    const fetched = await runSteps(this.steps.afterPull);
    return sent && fetched ? 'synced' : 'offline';
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
