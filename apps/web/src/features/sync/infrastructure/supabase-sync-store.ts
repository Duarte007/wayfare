import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type {
  PendingChange,
  PushOutcome,
  RemoteRow,
  RemoteSyncStore,
  PulledTable,
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

/** Writes go through the user's own session, so RLS decides what they may change. */
export class SupabaseSyncStore implements RemoteSyncStore {
  constructor(private readonly client: SupabaseClient) {}

  async push(change: PendingChange) {
    try {
      // The server owns version and updated_at (trigger).
      const { version: _v, updated_at: _u, ...row } = change.row;
      const table = this.client.from(change.table);
      if (change.op === 'delete') {
        const { error } = await table
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', row.id);
        return outcomeOf(error);
      }
      // Update first: an upsert would also check the insert policy, which only the owner passes,
      // so a trip mate's edit would be refused. Ownership columns never change on update.
      const { owner_id: _o, created_by: _c, ...changes } = row;
      const updated = await table.update(changes).eq('id', row.id).select('id');
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

  async memberTripIds(): Promise<string[] | null> {
    try {
      // Without a session the query would run as anon and see nothing, which would look like
      // "left every trip"; never answer for a signed-out client.
      const { data: auth } = await this.client.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) return null;
      const { data, error } = await this.client
        .from('trip_members')
        .select('trip_id, trips!inner(deleted_at)')
        .eq('user_id', userId)
        .is('trips.deleted_at', null);
      return error ? null : data.map((m) => m.trip_id as string);
    } catch {
      return null;
    }
  }
}
