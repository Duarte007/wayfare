import { beforeEach, describe, expect, it } from 'vitest';
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
});
