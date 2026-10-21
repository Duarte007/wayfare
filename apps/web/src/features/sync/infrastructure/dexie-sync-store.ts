import { liveQuery } from 'dexie';
import type { WayfareDB } from '../../../shared/infrastructure/db';
import type { LocalSyncStore, PendingChange, RemoteRow, SyncedTable } from '../domain/sync-ports';

const cursorKey = (table: SyncedTable) => `sync.cursor.${table}`;

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

  async cursor(table: SyncedTable) {
    const entry = await this.db.meta.get(cursorKey(table));
    return entry ? Number(entry.value) : 0;
  }

  async applyRemote(table: SyncedTable, rows: RemoteRow[], cursor: number) {
    const target = this.db.table(table);
    await this.db.transaction('rw', target, this.db.outbox, this.db.meta, async () => {
      const pending = new Set(
        (await this.db.outbox.where('table').equals(table).toArray())
          .filter((e) => !e.rejected)
          .map((e) => (e.row as { id: string }).id),
      );
      for (const row of rows) {
        if (pending.has(row.id)) continue;
        if (row.deleted_at) await target.delete(row.id);
        else await target.put(row);
      }
      await this.db.meta.put({ key: cursorKey(table), value: String(cursor) });
    });
  }
}
