import { liveQuery, type Table } from 'dexie';
import type { WayfareDB } from '../../../shared/infrastructure/db';
import { SYNCED_TABLES } from '@wayfare/shared';
import {
  PULLED_TABLES,
  type LocalSyncStore,
  type PendingChange,
  type PulledTable,
  type RemoteRow,
} from '../domain/sync-ports';

const cursorKey = (table: PulledTable) => `sync.cursor.${table}`;

/** Server table → device table, and the row's key on the device. */
function localTable(db: WayfareDB, table: PulledTable): Table<Record<string, unknown>, string> {
  // Server rows are stored as they come; the screens read them through the typed tables.
  return table === 'document_links' ? (db.documentLinks as unknown as Table) : db.table(table);
}

function localId(table: PulledTable, row: RemoteRow): string {
  return table === 'document_links'
    ? `${String(row.document_id)}:${String(row.entity_type)}:${String(row.entity_id)}`
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

  async applyRemote(table: PulledTable, rows: RemoteRow[], cursor: number) {
    const target = localTable(this.db, table);
    await this.db.transaction('rw', target, this.db.outbox, this.db.meta, async () => {
      const pending = new Set(
        (await this.db.outbox.where('table').equals(table).toArray())
          .filter((e) => !e.rejected)
          .map((e) => (e.row as { id: string }).id),
      );
      for (const row of rows) {
        const id = localId(table, row);
        if (pending.has(id)) continue;
        if (row.deleted_at) await target.delete(id);
        else await target.put({ ...row, id });
      }
      await this.db.meta.put({ key: cursorKey(table), value: String(cursor) });
    });
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
    const tables = [...SYNCED_TABLES.map((t) => this.db.table(t)), this.db.documentLinks];
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
