import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountDeletion, DeleteAccountResult } from '../domain/account-ports';

const BUCKET = 'documents';
/** Storage removes at most this many paths per request. */
const REMOVE_BATCH = 100;

export class SupabaseAccountDeletion implements AccountDeletion {
  constructor(private readonly client: SupabaseClient) {}

  async deleteAccount(): Promise<DeleteAccountResult> {
    try {
      const { data: auth } = await this.client.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return { ok: false, reason: 'failed' };

      // Files first: once the account is gone, nobody may remove them through the API.
      const { data: docs, error: listError } = await this.client
        .from('documents')
        .select('storage_path')
        .eq('owner_id', userId)
        .not('storage_path', 'is', null);
      if (listError) return { ok: false, reason: 'failed' };
      const paths = (docs ?? []).map((doc) => doc.storage_path as string);
      for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
        const { error } = await this.client.storage
          .from(BUCKET)
          .remove(paths.slice(i, i + REMOVE_BATCH));
        if (error) return { ok: false, reason: 'failed' };
      }

      const { error } = await this.client.rpc('delete_my_account');
      return error ? { ok: false, reason: 'failed' } : { ok: true };
    } catch {
      return { ok: false, reason: navigator.onLine ? 'failed' : 'offline' };
    }
  }
}
