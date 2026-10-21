import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { PendingChange } from '../domain/sync-ports';
import { SupabaseSyncStore } from './supabase-sync-store';

interface Call {
  table: string;
  op: 'update' | 'insert';
  values: Record<string, unknown>;
  filters: [string, unknown][];
}

/** A Supabase client that records writes; `updated` is how many rows an update matches. */
function fakeClient(updated: number) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          const call: Call = { table, op: 'update', values, filters: [] };
          calls.push(call);
          const result = { error: null, data: Array.from({ length: updated }, () => ({})) };
          const query = {
            eq(column: string, value: unknown) {
              call.filters.push([column, value]);
              return query;
            },
            select: () => Promise.resolve(result),
            then: (resolve: (r: typeof result) => unknown) => Promise.resolve(result).then(resolve),
          };
          return query;
        },
        insert(values: Record<string, unknown>) {
          calls.push({ table, op: 'insert', values, filters: [] });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const link = {
  id: 'd1:stay:s1',
  document_id: 'd1',
  entity_type: 'stay',
  entity_id: 's1',
  trip_id: 't1',
  deleted_at: null,
};
const linkKey: [string, unknown][] = [
  ['document_id', 'd1'],
  ['entity_type', 'stay'],
  ['entity_id', 's1'],
];

const change = (patch: Partial<PendingChange>): PendingChange => ({
  id: 'c1',
  table: 'document_links',
  op: 'upsert',
  row: link,
  ...patch,
});

describe('SupabaseSyncStore.push', () => {
  it('updates a link on its composite key, reviving it, without the device id', async () => {
    const { client, calls } = fakeClient(1);
    const result = await new SupabaseSyncStore(client).push(change({}));
    expect(result).toEqual({ outcome: 'pushed' });
    expect(calls).toEqual([
      {
        table: 'document_links',
        op: 'update',
        values: {
          document_id: 'd1',
          entity_type: 'stay',
          entity_id: 's1',
          trip_id: 't1',
          deleted_at: null,
        },
        filters: linkKey,
      },
    ]);
  });

  it('inserts a new link when no row has its key', async () => {
    const { client, calls } = fakeClient(0);
    await new SupabaseSyncStore(client).push(change({}));
    expect(calls.map((c) => c.op)).toEqual(['update', 'insert']);
    expect(calls[1]!.values).toEqual({
      document_id: 'd1',
      entity_type: 'stay',
      entity_id: 's1',
      trip_id: 't1',
      deleted_at: null,
    });
  });

  it('soft-deletes a link on its composite key', async () => {
    const { client, calls } = fakeClient(1);
    const { trip_id: _t, deleted_at: _d, ...key } = link;
    await new SupabaseSyncStore(client).push(change({ op: 'delete', row: key }));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.filters).toEqual(linkKey);
    expect(Object.keys(calls[0]!.values)).toEqual(['deleted_at']);
  });

  it('keeps writing other tables by id, without ownership columns on update', async () => {
    const { client, calls } = fakeClient(0);
    const stay = { id: 's1', trip_id: 't1', name: 'Hotel', created_by: 'u', version: 3 };
    await new SupabaseSyncStore(client).push(change({ table: 'stays', row: stay }));
    expect(calls[0]).toMatchObject({
      op: 'update',
      values: { id: 's1', trip_id: 't1', name: 'Hotel' },
      filters: [['id', 's1']],
    });
    expect(calls[1]!.values).toEqual({ id: 's1', trip_id: 't1', name: 'Hotel', created_by: 'u' });
  });
});
