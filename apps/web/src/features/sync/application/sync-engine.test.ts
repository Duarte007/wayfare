import { describe, expect, it, vi } from 'vitest';
import type {
  LocalSyncStore,
  PendingChange,
  RemoteRow,
  RemoteSyncStore,
  PulledTable,
} from '../domain/sync-ports';
import { SyncEngine } from './sync-engine';

function memoryLocal(pending: PendingChange[] = [], trips: string[] = []) {
  const queue = [...pending];
  const localTrips = new Set(trips);
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
      if (table === 'trips') rows.forEach((r) => localTrips.add(r.id!));
      cursors[table] = cursor;
    },
    keepTrips: async (memberTripIds) => {
      for (const id of localTrips) if (!memberTripIds.includes(id)) localTrips.delete(id);
      return { missing: memberTripIds.filter((id) => !localTrips.has(id)) };
    },
    resetCursors: async () => {
      for (const key of Object.keys(cursors)) delete cursors[key as PulledTable];
    },
  };
  return { local, queue, rejected, applied, cursors, localTrips };
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
      memberTripIds: async () => ['t1'],
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
    const remote: RemoteSyncStore = {
      push: async () => ({ outcome: 'transient' }),
      pull,
      memberTripIds: async () => [],
    };
    expect(await new SyncEngine(local, remote).run()).toBe('offline');
    expect(queue.map((c) => c.id)).toEqual(['a', 'b']);
    expect(pull).not.toHaveBeenCalled();
  });

  it('sets a rejected change aside so it cannot block the queue', async () => {
    const { local, rejected, queue } = memoryLocal([change('bad'), change('good')]);
    const remote: RemoteSyncStore = {
      push: async (c) => ({ outcome: c.id === 'bad' ? 'rejected' : 'pushed', reason: '42501' }),
      pull: async () => [],
      memberTripIds: async () => [],
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
      memberTripIds: async () => [],
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
      memberTripIds: async () => [],
    };
    expect(await new SyncEngine(local, remote).run()).toBe('offline');
  });

  it('forgets trips the user is no longer a member of', async () => {
    const { local, localTrips } = memoryLocal([], ['kept', 'left']);
    const remote: RemoteSyncStore = {
      push: async () => ({ outcome: 'pushed' }),
      pull: async () => [],
      memberTripIds: async () => ['kept'],
    };
    expect(await new SyncEngine(local, remote).run()).toBe('synced');
    expect([...localTrips]).toEqual(['kept']);
  });

  it('pulls everything again when the user joined a trip the device does not have', async () => {
    const { local, cursors, localTrips } = memoryLocal([], ['mine']);
    cursors.trips = 50;
    const sinces: number[] = [];
    const remote: RemoteSyncStore = {
      push: async () => ({ outcome: 'pushed' }),
      // The joined trip was written long ago, so its version is below the cursor.
      pull: async (table, since) => {
        if (table !== 'trips') return [];
        sinces.push(since);
        return since < 10 ? [{ id: 'joined', version: 9 }] : [];
      },
      memberTripIds: async () => ['mine', 'joined'],
    };
    expect(await new SyncEngine(local, remote).run()).toBe('synced');
    expect(sinces).toEqual([50, 0]);
    expect(localTrips.has('joined')).toBe(true);
  });

  it('reports offline and keeps every trip when memberships cannot be read', async () => {
    const { local, localTrips } = memoryLocal([], ['a']);
    const remote: RemoteSyncStore = {
      push: async () => ({ outcome: 'pushed' }),
      pull: async () => [],
      memberTripIds: async () => null,
    };
    expect(await new SyncEngine(local, remote).run()).toBe('offline');
    expect([...localTrips]).toEqual(['a']);
  });
});
