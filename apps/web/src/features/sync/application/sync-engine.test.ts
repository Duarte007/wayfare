import { describe, expect, it, vi } from 'vitest';
import type {
  LocalSyncStore,
  PendingChange,
  RemoteRow,
  RemoteSyncStore,
  PulledTable,
} from '../domain/sync-ports';
import { SyncEngine } from './sync-engine';

function memoryLocal(pending: PendingChange[] = []) {
  const queue = [...pending];
  const rejected: string[] = [];
  const applied: Record<string, RemoteRow[]> = {};
  const cursors: Partial<Record<PulledTable, number>> = {};
  const local: LocalSyncStore = {
    pendingChanges: async (limit) => queue.filter((c) => !rejected.includes(c.id)).slice(0, limit),
    markPushed: async (id) =>
      void queue.splice(
        queue.findIndex((c) => c.id === id),
        1,
      ),
    markRejected: async (id) => void rejected.push(id),
    observePendingCount: () => () => {},
    cursor: async (table) => cursors[table] ?? 0,
    applyRemote: async (table, rows, cursor) => {
      (applied[table] ??= []).push(...rows);
      cursors[table] = cursor;
    },
  };
  return { local, queue, rejected, applied, cursors };
}

const change = (id: string, rowId = id): PendingChange => ({
  id,
  table: 'trips',
  op: 'upsert',
  row: { id: rowId, name: id },
});

describe('SyncEngine', () => {
  it('pushes in order, then pulls every table from its cursor', async () => {
    const { local, queue, applied, cursors } = memoryLocal([change('a'), change('b')]);
    const pushed: string[] = [];
    const remote: RemoteSyncStore = {
      push: async (c) => (pushed.push(c.id), { outcome: 'pushed' }),
      pull: async (table, since) =>
        table === 'trips' && since === 0 ? [{ id: 't1', version: 7 }] : [],
    };
    expect(await new SyncEngine(local, remote).run()).toBe('synced');
    expect(pushed).toEqual(['a', 'b']);
    expect(queue).toEqual([]);
    expect(applied.trips).toEqual([{ id: 't1', version: 7 }]);
    expect(cursors.trips).toBe(7);
  });

  it('stops at the first transient failure and keeps the rest queued, without pulling', async () => {
    const { local, queue } = memoryLocal([change('a'), change('b')]);
    const pull = vi.fn();
    const remote: RemoteSyncStore = { push: async () => ({ outcome: 'transient' }), pull };
    expect(await new SyncEngine(local, remote).run()).toBe('offline');
    expect(queue.map((c) => c.id)).toEqual(['a', 'b']);
    expect(pull).not.toHaveBeenCalled();
  });

  it('sets a rejected change aside so it cannot block the queue', async () => {
    const { local, rejected, queue } = memoryLocal([change('bad'), change('good')]);
    const remote: RemoteSyncStore = {
      push: async (c) => ({ outcome: c.id === 'bad' ? 'rejected' : 'pushed', reason: '42501' }),
      pull: async () => [],
    };
    expect(await new SyncEngine(local, remote).run()).toBe('synced');
    expect(rejected).toEqual(['bad']);
    expect(queue.map((c) => c.id)).toEqual(['bad']);
  });

  it('runs one follow-up pass for calls made during a pass, so mid-pass changes go out', async () => {
    const { local, queue } = memoryLocal();
    const pushed: string[] = [];
    let passes = 0;
    const engine = new SyncEngine(local, {
      push: async (c) => (pushed.push(c.id), { outcome: 'pushed' }),
      pull: async (table) => {
        if (table === 'trips') passes++;
        // A change saved while the first pass is pulling.
        if (passes === 1 && table === 'trips') queue.push(change('mid-pass'));
        return [];
      },
    });
    await Promise.all([engine.run(), engine.run(), engine.run()]);
    expect(passes).toBe(2);
    expect(pushed).toEqual(['mid-pass']);
  });

  it('reports offline when a pull cannot reach the server', async () => {
    const { local } = memoryLocal();
    const remote: RemoteSyncStore = {
      push: async () => ({ outcome: 'pushed' }),
      pull: async () => null,
    };
    expect(await new SyncEngine(local, remote).run()).toBe('offline');
  });

  it('runs file steps after the push and after the pull, in that order', async () => {
    const { local } = memoryLocal([change('a')]);
    const calls: string[] = [];
    const remote: RemoteSyncStore = {
      push: async (c) => (calls.push(`push:${c.id}`), { outcome: 'pushed' }),
      pull: async (table) => (table === 'trips' && calls.push('pull'), []),
    };
    const engine = new SyncEngine(local, remote, {
      afterPush: [async () => (calls.push('upload'), true)],
      afterPull: [async () => (calls.push('download'), true)],
    });
    expect(await engine.run()).toBe('synced');
    expect(calls).toEqual(['push:a', 'upload', 'pull', 'download']);
  });

  it('still pulls when a step cannot reach the server, but reports offline', async () => {
    const { local } = memoryLocal();
    const pull = vi.fn(async () => []);
    const download = vi.fn(async () => true);
    const engine = new SyncEngine(
      local,
      { push: async () => ({ outcome: 'pushed' }), pull },
      {
        afterPush: [
          async () => false,
          async () => {
            throw new Error('boom');
          },
        ],
        afterPull: [download],
      },
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await engine.run()).toBe('offline');
    expect(pull).toHaveBeenCalled();
    expect(download).toHaveBeenCalled();
  });

  it('skips the steps when the push could not reach the server', async () => {
    const { local } = memoryLocal([change('a')]);
    const step = vi.fn(async () => true);
    const engine = new SyncEngine(
      local,
      { push: async () => ({ outcome: 'transient' }), pull: async () => [] },
      { afterPush: [step], afterPull: [step] },
    );
    expect(await engine.run()).toBe('offline');
    expect(step).not.toHaveBeenCalled();
  });
});
