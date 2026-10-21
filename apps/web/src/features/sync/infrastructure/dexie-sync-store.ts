import { liveQuery, type Table } from 'dexie';
import type { WayfareDB } from '../../../shared/infrastructure/db';
import type { LocalSyncStore, PendingChange, PulledTable, RemoteRow } from '../domain/sync-ports';

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
}
