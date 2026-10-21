import { SYNCED_TABLES } from '@wayfare/shared';
import { liveQuery } from 'dexie';
import {
  documentLinkId,
  localTable,
  type StoredDocumentLink,
  type WayfareDB,
} from '../../../shared/infrastructure/db';
import {
  PULLED_TABLES,
  type FullRefreshMark,
  type LocalSyncStore,
  type PendingChange,
  type PulledTable,
  type RemoteRow,
  type SyncTimes,
} from '../domain/sync-ports';

const cursorKey = (table: PulledTable) => `sync.cursor.${table}`;
const FULL_REFRESH_KEY = 'sync.fullRefresh';
const LAST_SYNCED_KEY = 'sync.lastSyncedAt';

/** The row's key on the device; document links have a composite key on the server. */
function localId(table: PulledTable, row: RemoteRow): string {
  return table === 'document_links'
    ? documentLinkId(row as unknown as StoredDocumentLink)
    : row.id!;
}

export class DexieSyncStore implements LocalSyncStore {
  constructor(private readonly db: WayfareDB) {}

  async pendingChanges(limit: number): Promise<PendingChange[]> {
    const entries = await this.db.outbox
      .orderBy('createdAt')
      .filter((e) => !e.rejected)
      .limit(limit)
      .toArray();
    return entries.map(({ id, table, op, row }) => ({
      id,
      table,
      op,
      row: row as PendingChange['row'],
    }));
  }

  async markPushed(changeId: string) {
    await this.db.outbox.delete(changeId);
  }

  async markRejected(changeId: string, reason: string) {
    await this.db.outbox.update(changeId, { rejected: reason });
  }

  observePendingCount(listener: (count: number) => void) {
    const subscription = liveQuery(() =>
      this.db.outbox.filter((e) => !e.rejected).count(),
    ).subscribe({
      next: listener,
      error: (err: unknown) => console.error('Failed to count changes', err),
    });
    return () => subscription.unsubscribe();
  }

  async cursor(table: PulledTable) {
    const entry = await this.db.meta.get(cursorKey(table));
    return entry ? Number(entry.value) : 0;
  }

  localId(table: PulledTable, row: RemoteRow): string {
    return localId(table, row);
  }

  async applyRemote(table: PulledTable, rows: RemoteRow[], cursor: number) {
    const target = localTable(this.db, table);
    await this.db.transaction('rw', target, this.db.outbox, this.db.meta, async () => {
      const pending = await this.unsentRowIds(table);
      for (const row of rows) {
        const id = localId(table, row);
        if (pending.has(id)) continue;
        if (row.deleted_at) await target.delete(id);
        else await target.put({ ...row, id });
      }
      await this.db.meta.put({ key: cursorKey(table), value: String(cursor) });
    });
  }

  async removeMissing(table: PulledTable, liveIds: ReadonlySet<string>) {
    const target = localTable(this.db, table);
    return this.db.transaction('rw', target, this.db.outbox, async () => {
      const pending = await this.unsentRowIds(table);
      const here = (await target.toCollection().primaryKeys()) as string[];
      const stale = here.filter((id) => !liveIds.has(id) && !pending.has(id));
      await target.bulkDelete(stale);
      return stale.length;
    });
  }

  async lastFullRefresh(): Promise<FullRefreshMark | null> {
    const entry = await this.db.meta.get(FULL_REFRESH_KEY);
    if (!entry) return null;
    try {
      const mark = JSON.parse(entry.value) as Partial<FullRefreshMark>;
      return typeof mark.at === 'number' && typeof mark.build === 'string'
        ? { at: mark.at, build: mark.build }
        : null;
    } catch {
      return null;
    }
  }

  async markFullRefresh(mark: FullRefreshMark) {
    await this.db.meta.put({ key: FULL_REFRESH_KEY, value: JSON.stringify(mark) });
  }

  async markSynced(at: number) {
    await this.db.meta.put({ key: LAST_SYNCED_KEY, value: String(at) });
  }

  /** When the last pass and the last full refresh finished (epoch ms), as they change. */
  observeSyncTimes(listener: (times: SyncTimes) => void) {
    const subscription = liveQuery(async () => {
      const [synced, full] = await Promise.all([
        this.db.meta.get(LAST_SYNCED_KEY),
        this.lastFullRefresh(),
      ]);
      return {
        lastSyncedAt: synced ? Number(synced.value) : null,
        lastFullRefreshAt: full?.at ?? null,
      };
    }).subscribe({
      next: listener,
      error: (err: unknown) => console.error('Failed to read sync times', err),
    });
    return () => subscription.unsubscribe();
  }

  async keepTrips(memberTripIds: readonly string[]) {
    const members = new Set(memberTripIds);
    const local = (await this.db.trips.toCollection().primaryKeys()) as string[];
    const unsent = await this.tripsWithUnsentChanges();
    for (const id of local) {
      if (!members.has(id) && !unsent.has(id)) await this.forgetTrip(id);
    }
    const here = new Set(local);
    return { missing: memberTripIds.filter((id) => !here.has(id)) };
  }

  async resetCursors() {
    await this.db.meta.bulkDelete(PULLED_TABLES.map(cursorKey));
  }

  /** Deletes a trip, its rows in every synced table, its cached members and its unsent changes. */
  async forgetTrip(tripId: string) {
    // document_links lives in the device's `documentLinks` table.
    const tables = SYNCED_TABLES.map((t) => localTable(this.db, t));
    await this.db.transaction('rw', [...tables, this.db.outbox, this.db.meta], async () => {
      await this.db.trips.delete(tripId);
      for (const table of tables) {
        await table.filter((row: { trip_id?: string }) => row.trip_id === tripId).delete();
      }
      await this.db.outbox.filter((e) => belongsTo(e.table, e.row, tripId)).delete();
      // Same key as SupabaseMemberDirectory's cache.
      await this.db.meta.delete(`members.${tripId}`);
    });
  }

  /** Rows of `table` with changes still to send (rejected ones don't count: the server wins). */
  private async unsentRowIds(table: PulledTable): Promise<Set<string>> {
    const entries = await this.db.outbox.where('table').equals(table).toArray();
    return new Set(entries.filter((e) => !e.rejected).map((e) => (e.row as { id: string }).id));
  }

  private async tripsWithUnsentChanges(): Promise<Set<string>> {
    const entries = await this.db.outbox.filter((e) => !e.rejected).toArray();
    return new Set(
      entries.map((e) => (e.table === 'trips' ? e.row.id : e.row.trip_id)).filter(isString),
    );
  }
}

function belongsTo(table: string, row: Record<string, unknown>, tripId: string): boolean {
  return table === 'trips' ? row.id === tripId : row.trip_id === tripId;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
