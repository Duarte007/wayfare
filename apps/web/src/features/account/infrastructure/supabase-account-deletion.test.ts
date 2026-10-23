import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseAccountDeletion } from './supabase-account-deletion';

function fakeClient(opts: { paths?: string[]; rpcError?: unknown; removeError?: unknown } = {}) {
  const calls: string[] = [];
  const remove = vi.fn(async (paths: string[]) => {
    calls.push(`remove:${paths.length}`);
    return { error: opts.removeError ?? null };
  });
  const rpc = vi.fn(async (name: string) => {
    calls.push(`rpc:${name}`);
    return { error: opts.rpcError ?? null };
  });
  const query = {
    select: () => query,
    eq: (column: string, value: string) => {
      calls.push(`docs:${column}=${value}`);
      return query;
    },
    not: async () => ({
      data: (opts.paths ?? []).map((storage_path) => ({ storage_path })),
      error: null,
    }),
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => query,
    storage: { from: () => ({ remove }) },
    rpc,
  } as unknown as SupabaseClient;
  return { client, calls, remove };
}

describe('SupabaseAccountDeletion', () => {
  it('removes the user’s files in batches, then deletes the account', async () => {
    const paths = Array.from({ length: 150 }, (_, i) => `u1/t1/${i}`);
    const { client, calls } = fakeClient({ paths });
    expect(await new SupabaseAccountDeletion(client).deleteAccount()).toEqual({ ok: true });
    expect(calls).toEqual(['docs:owner_id=u1', 'remove:100', 'remove:50', 'rpc:delete_my_account']);
  });

  it('keeps the account when its files cannot be removed', async () => {
    const { client, calls } = fakeClient({ paths: ['u1/t1/d1'], removeError: new Error('no') });
    expect(await new SupabaseAccountDeletion(client).deleteAccount()).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(calls).not.toContain('rpc:delete_my_account');
  });

  it('reports a refused deletion', async () => {
    const { client } = fakeClient({ rpcError: { message: 'denied' } });
    expect(await new SupabaseAccountDeletion(client).deleteAccount()).toEqual({
      ok: false,
      reason: 'failed',
    });
  });
});
