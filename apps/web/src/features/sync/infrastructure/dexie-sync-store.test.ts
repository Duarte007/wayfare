import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveLocal, WayfareDB } from '../../../shared/infrastructure/db';
import { DexieSyncStore } from './dexie-sync-store';

const trip = (id: string, name: string) => ({
  id,
  owner_id: '7e570000-0000-4000-8000-00000000a001',
  name,
  start_date: '2027-01-01',
  end_date: '2027-01-05',
});

describe('DexieSyncStore', () => {
  let db: WayfareDB;
  let store: DexieSyncStore;

  beforeEach(async () => {
    db = new WayfareDB();
    await db.delete();
    await db.open();
    store = new DexieSyncStore(db);
  });

  it('lists unsent changes oldest first and skips rejected ones', async () => {
    await saveLocal(db, 'trips', trip('a', 'First'));
    await saveLocal(db, 'trips', trip('b', 'Second'));
    const [first, second] = await store.pendingChanges(10);
    expect([first?.row.id, second?.row.id]).toEqual(['a', 'b']);

    await store.markRejected(first!.id, '42501 denied');
    expect((await store.pendingChanges(10)).map((c) => c.row.id)).toEqual(['b']);
    await store.markPushed(second!.id);
    expect(await store.pendingChanges(10)).toEqual([]);
  });

  it('applies pulled rows, keeps rows with unsent edits, removes deleted ones, saves the cursor', async () => {
    await db.trips.put(trip('gone', 'Old'));
    await saveLocal(db, 'trips', trip('mine', 'Edited offline'));

    await store.applyRemote(
      'trips',
      [
        { ...trip('mine', 'Older server copy'), version: 5 },
        { ...trip('new', 'From a trip mate'), version: 6 },
        { ...trip('gone', 'Old'), version: 7, deleted_at: '2026-10-21T00:00:00Z' },
      ],
      7,
    );

    expect((await db.trips.get('mine'))?.name).toBe('Edited offline');
    expect((await db.trips.get('new'))?.name).toBe('From a trip mate');
    expect(await db.trips.get('gone')).toBeUndefined();
    expect(await store.cursor('trips')).toBe(7);
    expect(await store.cursor('stops')).toBe(0);
  });

  it('lets the server win over a change it rejected', async () => {
    await saveLocal(db, 'trips', trip('t', 'Not allowed'));
    const [change] = await store.pendingChanges(1);
    await store.markRejected(change!.id, '42501');
    await store.applyRemote('trips', [{ ...trip('t', 'Server'), version: 9 }], 9);
    expect((await db.trips.get('t'))?.name).toBe('Server');
  });

  it('stores document links under a key built from their composite key', async () => {
    const link = { document_id: 'd1', entity_type: 'stay', entity_id: 's1', trip_id: 't' };
    await store.applyRemote('document_links', [{ ...link, version: 3 }], 3);
    expect(await db.documentLinks.get('d1:stay:s1')).toMatchObject(link);
    await store.applyRemote(
      'document_links',
      [{ ...link, version: 4, deleted_at: '2026-10-21T00:00:00Z' }],
      4,
    );
    expect(await db.documentLinks.count()).toBe(0);
  });

  it('keeps a link made offline when the server still has it removed', async () => {
    const link = { document_id: 'd1', entity_type: 'leg', entity_id: 'l1', trip_id: 't' } as const;
    await saveLocal(db, 'document_links', { id: 'd1:leg:l1', ...link, deleted_at: null });
    await store.applyRemote(
      'document_links',
      [{ ...link, version: 5, deleted_at: '2026-10-21T00:00:00Z' }],
      5,
    );
    expect(await db.documentLinks.get('d1:leg:l1')).toMatchObject(link);
    expect((await store.pendingChanges(10)).map((c) => c.table)).toEqual(['document_links']);
  });

  it('forgets trips the user left, with their rows, but keeps ones with unsent changes', async () => {
    await db.trips.bulkPut([trip('kept', 'Kept'), trip('left', 'Left')]);
    await saveLocal(db, 'trips', trip('offline', 'Made offline'));
    const row = { trip_id: 'left', visibility: 'group', assignees: [] };
    await db.table('stops').put({ ...row, id: 'stop-left' });
    await db.table('stops').put({ ...row, id: 'stop-kept', trip_id: 'kept' });
    await db.documentLinks.put({
      id: 'd:stay:s',
      document_id: 'd',
      entity_type: 'stay',
      entity_id: 's',
      trip_id: 'left',
    } as never);
    await db.meta.put({ key: 'members.left', value: '[]' });

    const { missing } = await store.keepTrips(['kept', 'joined']);

    expect(missing).toEqual(['joined']);
    expect((await db.trips.toCollection().primaryKeys()).sort()).toEqual(['kept', 'offline']);
    expect(await db.table('stops').toCollection().primaryKeys()).toEqual(['stop-kept']);
    expect(await db.documentLinks.count()).toBe(0);
    expect(await db.meta.get('members.left')).toBeUndefined();
  });

  it('resets every cursor so the next pull starts over', async () => {
    await store.applyRemote('trips', [], 40);
    await store.applyRemote('stops', [], 41);
    await store.resetCursors();
    expect(await store.cursor('trips')).toBe(0);
    expect(await store.cursor('stops')).toBe(0);
  });

  it('after a full pull, removes rows the server no longer has, except ones with unsent changes', async () => {
    await db.trips.bulkPut([trip('live', 'Live'), trip('stray', 'Stray'), trip('refused', 'No')]);
    await saveLocal(db, 'trips', trip('offline', 'Made offline'));
    await saveLocal(db, 'trips', trip('refused', 'Not allowed'));
    const refused = (await store.pendingChanges(10)).find((c) => c.row.id === 'refused')!;
    await store.markRejected(refused.id, '42501');

    expect(await store.removeMissing('trips', new Set(['live']))).toBe(2);

    expect((await db.trips.toCollection().primaryKeys()).sort()).toEqual(['live', 'offline']);
  });

  it('matches document links by their device id', async () => {
    const link = { document_id: 'd', entity_type: 'stay', entity_id: 's', trip_id: 't' } as const;
    const row = { ...link, version: 1 };
    expect(store.localId('document_links', row)).toBe('d:stay:s');
    await store.applyRemote('document_links', [row], 1);
    await db.documentLinks.put({ ...link, id: 'd:stay:old', entity_id: 'old' });
    await store.removeMissing('document_links', new Set(['d:stay:s']));
    expect(await db.documentLinks.toCollection().primaryKeys()).toEqual(['d:stay:s']);
  });

  it('remembers the last full refresh and the last sync, and reports them as they change', async () => {
    expect(await store.lastFullRefresh()).toBeNull();
    const seen: unknown[] = [];
    const stop = store.observeSyncTimes((times) => seen.push(times));
    await store.markFullRefresh({ at: 1000, build: 'b1' });
    await store.markSynced(2000);
    expect(await store.lastFullRefresh()).toEqual({ at: 1000, build: 'b1' });
    await vi.waitFor(() =>
      expect(seen.at(-1)).toEqual({ lastSyncedAt: 2000, lastFullRefreshAt: 1000 }),
    );
    stop();
    // A damaged entry counts as never refreshed.
    await db.meta.put({ key: 'sync.fullRefresh', value: 'oops' });
    expect(await store.lastFullRefresh()).toBeNull();
  });
});
