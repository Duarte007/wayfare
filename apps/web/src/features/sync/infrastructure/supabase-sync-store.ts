import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type {
  PendingChange,
  PushOutcome,
  RemoteRow,
  RemoteSyncStore,
  PulledTable,
  SyncedTable,
} from '../domain/sync-ports';

/**
 * Data (22), constraint (23) and permission/schema (42) errors will fail the same way on every
 * retry. Anything else (no network, timeouts, an expiring token) is worth retrying.
 */
function outcomeOf(error: PostgrestError | null): { outcome: PushOutcome; reason?: string } {
  if (!error) return { outcome: 'pushed' };
  const code = error.code ?? '';
  return /^(22|23|42)/.test(code)
    ? { outcome: 'rejected', reason: `${code} ${error.message}` }
    : { outcome: 'transient', reason: error.message };
}

/** Tables whose server key isn't `id`; their device-made `id` is never sent. */
const COMPOSITE_KEYS: Partial<Record<SyncedTable, readonly string[]>> = {
  document_links: ['document_id', 'entity_type', 'entity_id'],
};

interface Filterable<Q> {
  eq(column: string, value: unknown): Q;
}

/** Writes go through the user's own session, so RLS decides what they may change. */
export class SupabaseSyncStore implements RemoteSyncStore {
  constructor(private readonly client: SupabaseClient) {}

  async push(change: PendingChange) {
    try {
      // The server owns version and updated_at (trigger).
      const { version: _v, updated_at: _u, id, ...rest } = change.row;
      const composite = COMPOSITE_KEYS[change.table];
      const row: Record<string, unknown> = composite ? rest : { id, ...rest };
      const keys = composite ?? ['id'];
      const byKey = <Q extends Filterable<Q>>(query: Q): Q =>
        keys.reduce((q, column) => q.eq(column, row[column]), query);
      const table = this.client.from(change.table);
      if (change.op === 'delete') {
        const { error } = await byKey(table.update({ deleted_at: new Date().toISOString() }));
        return outcomeOf(error);
      }
      // Update first: an upsert would also check the insert policy, which only the owner passes,
      // so a trip mate's edit would be refused. Ownership columns never change on update.
      // A link sends deleted_at: null, so linking again revives one that was removed.
      const { owner_id: _o, created_by: _c, ...changes } = row;
      const updated = await byKey(table.update(changes)).select(keys.join(','));
      if (updated.error) return outcomeOf(updated.error);
      if (updated.data.length > 0) return { outcome: 'pushed' as const };
      const inserted = await table.insert(row);
      return outcomeOf(inserted.error);
    } catch (error) {
      return { outcome: 'transient' as const, reason: String(error) };
    }
  }

  async pull(table: PulledTable, since: number, limit: number): Promise<RemoteRow[] | null> {
    try {
      const { data, error } = await this.client
        .from(table)
        .select('*')
        .gt('version', since)
        .order('version')
        .limit(limit);
      return error ? null : (data as RemoteRow[]);
    } catch {
      return null;
    }
  }
}
