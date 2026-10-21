import type { ChecklistItem } from '@wayfare/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { WayfareDB } from '../../../shared/infrastructure/db';
import { DexieSyncStore } from '../../sync/infrastructure/dexie-sync-store';
import { DexieTripRepository } from '../../trips/infrastructure/dexie-trip-repository';
import type { ChecklistData } from '../domain/checklist-ports';
import { DexieChecklistRepository } from './dexie-checklist-repository';

const trip = {
  id: 't1',
  owner_id: 'u1',
  name: 'Trip',
  start_date: '2027-01-01',
  end_date: '2027-01-05',
};
const item = (id: string, tripId = 't1'): ChecklistItem => ({
  id,
  trip_id: tripId,
  group_key: 'documents',
  title: id,
  done: false,
  position: 0,
  visibility: 'group',
  assignees: [],
});

function next(repository: DexieChecklistRepository, tripId: string) {
  return new Promise<ChecklistData | null>((resolve) => {
    const stop = repository.observe(tripId, (data) => {
      resolve(data);
      queueMicrotask(stop);
    });
  });
}

describe('DexieChecklistRepository', () => {
  let db: WayfareDB;
  let repository: DexieChecklistRepository;

  beforeEach(async () => {
    db = new WayfareDB();
    await db.delete();
    await db.open();
    repository = new DexieChecklistRepository(db);
  });

  it('saves and removes items locally and queues both for sync', async () => {
    await db.trips.put(trip);
    await repository.apply({ items: [item('a'), item('b')] });
    await repository.apply({ removed: ['a'] });
    expect((await next(repository, 't1'))?.items.map((i) => i.id)).toEqual(['b']);
    const changes = await new DexieSyncStore(db).pendingChanges(10);
    expect(changes.map((c) => `${c.table}:${c.op}:${c.row.id}`)).toEqual([
      'checklist_items:upsert:a',
      'checklist_items:upsert:b',
      'checklist_items:delete:a',
    ]);
  });

  it('stores pulled rows and reports a missing trip as null', async () => {
    await db.trips.put(trip);
    await new DexieSyncStore(db).applyRemote(
      'checklist_items',
      [{ ...item('remote'), version: 3 }],
      3,
    );
    expect((await next(repository, 't1'))?.items.map((i) => i.id)).toEqual(['remote']);
    expect(await next(repository, 'nope')).toBeNull();
  });

  it('is cleared with its trip', async () => {
    await db.trips.put(trip);
    await db.checklist_items.bulkPut([item('a'), item('other', 't2')]);
    await new DexieTripRepository(db).remove(trip);
    expect((await db.checklist_items.toArray()).map((i) => i.id)).toEqual(['other']);
  });
});
