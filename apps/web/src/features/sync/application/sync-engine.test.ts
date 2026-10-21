import { describe, expect, it, vi } from 'vitest';
import {
  PULLED_TABLES,
  type FullRefreshMark,
  type LocalSyncStore,
  type PendingChange,
  type RemoteRow,
  type RemoteSyncStore,
  type PulledTable,
} from '../domain/sync-ports';
import { FULL_REFRESH_EVERY_MS, SyncEngine } from './sync-engine';

const at = (now: number) => ({ build: 'dev', now: () => now });

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

function memoryLocal(
  pending: PendingChange[] = [],
  trips: string[] = [],
  // Fully refreshed an hour ago by this build, so passes are incremental unless a test says not.
  fullRefresh: FullRefreshMark | null = { at: NOW - HOUR, build: 'dev' },
) {
  const queue = [...pending];
  const localTrips = new Set(trips);
  const rejected: string[] = [];
  const applied: Record<string, RemoteRow[]> = {};
  const cursors: Partial<Record<PulledTable, number>> = {};
  const kept: Partial<Record<PulledTable, string[]>> = {};
  const marks = { fullRefresh, syncedAt: null as number | null };
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
    observeSyncTimes: () => () => {},
    removeMissing: async (table, liveIds) => {
      kept[table] = [...liveIds];
      if (table !== 'trips') return 0;
      const unsent = new Set(queue.filter((c) => !rejected.includes(c.id)).map((c) => c.row.id));
      const stale = [...localTrips].filter((id) => !liveIds.has(id) && !unsent.has(id));
      stale.forEach((id) => localTrips.delete(id));
      return stale.length;
    },
    localId: (table, row) =>
      table === 'document_links' ? `${String(row.document_id)}:${String(row.entity_id)}` : row.id!,
    lastFullRefresh: async () => marks.fullRefresh,
    markFullRefresh: async (mark) => void (marks.fullRefresh = mark),
    markSynced: async (at) => void (marks.syncedAt = at),
  };
  return { local, queue, rejected, applied, cursors, localTrips, kept, marks };
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
    expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('synced');
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
    expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('offline');
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
    expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('synced');
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
    expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('offline');
  });

  it('forgets trips the user is no longer a member of', async () => {
    const { local, localTrips } = memoryLocal([], ['kept', 'left']);
    const remote: RemoteSyncStore = {
      push: async () => ({ outcome: 'pushed' }),
      pull: async () => [],
      memberTripIds: async () => ['kept'],
    };
    expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('synced');
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
    expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('synced');
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
    expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('offline');
    expect([...localTrips]).toEqual(['a']);
  });

  it('runs file steps after the push and after the pull, in that order', async () => {
    const { local } = memoryLocal([change('a')]);
    const calls: string[] = [];
    const remote: RemoteSyncStore = {
      push: async (c) => (calls.push(`push:${c.id}`), { outcome: 'pushed' }),
      pull: async (table) => (table === 'trips' && calls.push('pull'), []),
      memberTripIds: async () => [],
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
      { push: async () => ({ outcome: 'pushed' }), pull, memberTripIds: async () => [] },
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
      {
        push: async () => ({ outcome: 'transient' }),
        pull: async () => [],
        memberTripIds: async () => [],
      },
      { afterPush: [step], afterPull: [step] },
    );
    expect(await engine.run()).toBe('offline');
    expect(step).not.toHaveBeenCalled();
  });

  describe('full refresh', () => {
    /** A server holding `rows` per table, recording each pull's (table, since). */
    function server(
      rows: Partial<Record<PulledTable, RemoteRow[]>>,
      members: string[] | null = [],
    ) {
      const pulls: [PulledTable, number][] = [];
      const remote: RemoteSyncStore = {
        push: async () => ({ outcome: 'pushed' }),
        pull: async (table, since, limit) => {
          pulls.push([table, since]);
          return (rows[table] ?? []).filter((r) => r.version > since).slice(0, limit);
        },
        memberTripIds: async () => members,
      };
      return { remote, pulls };
    }

    it('runs on the first pass ever: every table from 0, removing what the server lacks', async () => {
      const { local, localTrips, cursors, kept, marks } = memoryLocal([], ['kept', 'stray'], null);
      cursors.trips = 90;
      const { remote, pulls } = server(
        {
          trips: [
            { id: 'kept', version: 3 },
            { id: 'gone', version: 4, deleted_at: '2026-10-20T00:00:00Z' },
          ],
        },
        ['kept'],
      );
      expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('synced');
      expect(pulls.filter(([t]) => t === 'trips')).toEqual([['trips', 0]]);
      expect(pulls.every(([, since]) => since === 0)).toBe(true);
      expect(new Set(pulls.map(([t]) => t)).size).toBe(PULLED_TABLES.length);
      // Deleted rows are not live, so they don't protect a local copy.
      expect(kept.trips).toEqual(['kept']);
      expect([...localTrips]).toEqual(['kept']);
      // The cursor is set right again, even when the device's had gone past the server.
      expect(cursors.trips).toBe(4);
      expect(cursors.stops).toBe(0);
      expect(marks.fullRefresh).toEqual({ at: NOW, build: 'dev' });
      expect(marks.syncedAt).toBe(NOW);
    });

    it('keeps a row edited during the refresh, but lets the server win over a rejected one', async () => {
      const { local, localTrips, queue } = memoryLocal([change('refused', 'r')], ['r', 'e'], null);
      const { remote } = server({}, ['r', 'e']);
      remote.push = async () => ({ outcome: 'rejected', reason: '42501' });
      const pull = remote.pull;
      remote.pull = async (table, since, limit) => {
        // Saved on the device while the pass pulls.
        if (table === 'trips') queue.push(change('edit', 'e'));
        return pull(table, since, limit);
      };
      expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('synced');
      expect([...localTrips]).toEqual(['e']);
    });

    it('pages through big tables with the usual page size', async () => {
      const { local, kept } = memoryLocal([], [], null);
      const trips = Array.from({ length: 1200 }, (_, i) => ({ id: `t${i}`, version: i + 1 }));
      const { remote, pulls } = server({ trips }, []);
      expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('synced');
      expect(pulls.filter(([t]) => t === 'trips')).toEqual([
        ['trips', 0],
        ['trips', 500],
        ['trips', 1000],
      ]);
      expect(kept.trips).toHaveLength(1200);
    });

    it('removes nothing and records nothing when a page cannot be fetched', async () => {
      const { local, localTrips, marks } = memoryLocal([], ['a'], null);
      const { remote } = server({}, ['a']);
      remote.pull = async (table) => (table === 'stops' ? null : []);
      const engine = new SyncEngine(local, remote, {}, at(NOW));
      expect(await engine.run()).toBe('offline');
      expect([...localTrips]).toEqual(['a']);
      expect(marks.fullRefresh).toBeNull();
    });

    it('never runs signed out, where every table would look empty', async () => {
      const { local, localTrips } = memoryLocal([], ['a'], null);
      const { remote, pulls } = server({}, null);
      expect(await new SyncEngine(local, remote, {}, at(NOW)).run()).toBe('offline');
      expect(pulls).toEqual([]);
      expect([...localTrips]).toEqual(['a']);
    });

    it('runs again once a day and after an app update, but not in between', async () => {
      const recent = { at: NOW - HOUR, build: 'v1' };
      const cases: [FullRefreshMark, string, boolean][] = [
        [recent, 'v1', false],
        [recent, 'v2', true],
        [{ at: NOW - FULL_REFRESH_EVERY_MS, build: 'v1' }, 'v1', true],
        // A clock set back can't be trusted.
        [{ at: NOW + HOUR, build: 'v1' }, 'v1', true],
      ];
      for (const [mark, build, full] of cases) {
        const { local, cursors } = memoryLocal([], [], mark);
        cursors.stops = 40;
        const { remote, pulls } = server({}, []);
        await new SyncEngine(local, remote, {}, { build, now: () => NOW }).run();
        expect(pulls.find(([t]) => t === 'stops')).toEqual(['stops', full ? 0 : 40]);
      }
    });

    it('refreshes on request, and a refresh that cannot reach the server waits for the next pass', async () => {
      const { local, cursors, marks } = memoryLocal();
      cursors.trips = 40;
      const { remote, pulls } = server({ trips: [{ id: 't', version: 40 }] }, ['t']);
      const engine = new SyncEngine(local, remote, {}, at(NOW));
      remote.memberTripIds = async () => null;
      expect(await engine.refresh()).toBe('offline');
      remote.memberTripIds = async () => ['t'];
      pulls.length = 0;
      expect(await engine.run()).toBe('synced');
      expect(pulls.find(([t]) => t === 'trips')).toEqual(['trips', 0]);
      expect(marks.fullRefresh?.at).toBe(NOW);
      pulls.length = 0;
      expect(await engine.run()).toBe('synced');
      expect(pulls.find(([t]) => t === 'trips')).toEqual(['trips', 40]);
    });

    it('reloads only the tables asked for, after the usual incremental pull', async () => {
      const { local, cursors, kept, marks } = memoryLocal();
      cursors.activities = 30;
      cursors.trips = 30;
      const before = marks.fullRefresh;
      const { remote, pulls } = server({ activities: [{ id: 'a1', version: 5 }] }, []);
      expect(await new SyncEngine(local, remote, {}, at(NOW)).refresh(['activities'])).toBe(
        'synced',
      );
      expect(pulls.filter(([t]) => t === 'activities')).toEqual([
        ['activities', 30],
        ['activities', 0],
      ]);
      expect(pulls.filter(([t]) => t === 'trips')).toEqual([['trips', 30]]);
      expect(kept).toEqual({ activities: ['a1'] });
      // Not a full refresh.
      expect(marks.fullRefresh).toBe(before);
    });

    it('uses the device id of composite-key rows', async () => {
      const { local, kept } = memoryLocal([], [], null);
      const { remote } = server(
        { document_links: [{ document_id: 'd', entity_type: 'stay', entity_id: 's', version: 2 }] },
        [],
      );
      await new SyncEngine(local, remote, {}, at(NOW)).run();
      expect(kept.document_links).toEqual(['d:s']);
    });
  });
});
