import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteLocal, saveLocal, WayfareDB } from '../../../shared/infrastructure/db';
import { DexieSyncIssueStore } from './dexie-sync-issues';
import { DexieSyncStore } from './dexie-sync-store';

const tripId = 'trip-1';
const row = { trip_id: tripId, visibility: 'group', assignees: [] };

describe('DexieSyncIssueStore', () => {
  let db: WayfareDB;
  let sync: DexieSyncStore;
  let issues: DexieSyncIssueStore;

  /** Queues a change and lets the server refuse it. */
  async function refuse(save: () => Promise<void>, reason: string) {
    await save();
    const pending = await sync.pendingChanges(100);
    await sync.markRejected(pending.at(-1)!.id, reason);
  }

  beforeEach(async () => {
    db = new WayfareDB();
    await db.delete();
    await db.open();
    sync = new DexieSyncStore(db);
    issues = new DexieSyncIssueStore(db);
    await db.places.bulkPut([
      { id: 'p-lis', trip_id: tripId, name: 'Lisboa', lat: 0, lng: 0, country_code: 'PT' },
      { id: 'p-opo', trip_id: tripId, name: 'Porto', lat: 0, lng: 0, country_code: 'PT' },
    ] as never);
    await db.stops.bulkPut([
      { ...row, id: 's-lis', place_id: 'p-lis' },
      { ...row, id: 's-opo', place_id: 'p-opo' },
    ] as never);
    await db.documents.put({ ...row, id: 'd1', title: 'Seguro viagem' } as never);
  });

  it('lists only refused changes, oldest first, named in terms the person knows', async () => {
    await saveLocal(db, 'trips', { id: 'ok', name: 'Still pending' });
    await refuse(
      () => saveLocal(db, 'activities', { ...row, id: 'a1', title: 'Museu', stop_id: 'x' }),
      '23503 insert or update on table "activities" violates foreign key constraint',
    );
    await refuse(() => saveLocal(db, 'stops', { ...row, id: 's-lis', place_id: 'p-lis' }), '42501');
    await refuse(
      () => saveLocal(db, 'legs', { ...row, id: 'l1', from_stop_id: 's-lis', to_stop_id: 's-opo' }),
      '23514 check',
    );
    await refuse(
      () =>
        saveLocal(db, 'document_links', {
          id: 'd1:stay:st1',
          document_id: 'd1',
          entity_type: 'stay',
          entity_id: 'st1',
          trip_id: tripId,
        }),
      '23505 duplicate',
    );
    await refuse(() => deleteLocal(db, 'checklist_items', 'gone'), '42501 denied');

    const list = await issues.issues();

    expect(list.map(({ kind, title, reason, op }) => ({ kind, title, reason, op }))).toEqual([
      { kind: 'activity', title: 'Museu', reason: 'missing', op: 'upsert' },
      { kind: 'city', title: 'Lisboa', reason: 'permission', op: 'upsert' },
      { kind: 'leg', title: 'Lisboa → Porto', reason: 'invalid', op: 'upsert' },
      { kind: 'link', title: 'Seguro viagem', reason: 'duplicate', op: 'upsert' },
      { kind: 'checklist', title: null, reason: 'permission', op: 'delete' },
    ]);
    expect(list[0]!.detail).toMatch(/^23503 /);
  });

  it('retry puts the change back in the queue', async () => {
    await refuse(() => saveLocal(db, 'trips', { id: 't', name: 'Trip' }), '42501');
    const [issue] = await issues.issues();
    await issues.retry(issue!.id);
    expect(await issues.issues()).toEqual([]);
    expect((await sync.pendingChanges(10)).map((c) => c.id)).toEqual([issue!.id]);
  });

  it('discard drops the change and says which table to reload', async () => {
    await refuse(() => saveLocal(db, 'activities', { ...row, id: 'a', title: 'X' }), '23503');
    const [issue] = await issues.issues();
    expect(await issues.discard(issue!.id)).toBe('activities');
    expect(await db.outbox.count()).toBe(0);
    expect(await issues.discard(issue!.id)).toBeNull();
  });

  it('reports changes as they happen', async () => {
    const seen: number[] = [];
    const stop = issues.observeIssues((list) => seen.push(list.length));
    await refuse(() => saveLocal(db, 'trips', { id: 't', name: 'Trip' }), '42501');
    await vi.waitFor(() => expect(seen.at(-1)).toBe(1));
    stop();
  });
});
