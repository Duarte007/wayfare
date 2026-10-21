import { describe, expect, it } from 'vitest';
import { applyLocal, nextQueuedAt, saveLocal, WayfareDB } from './db';

const db = new WayfareDB();

describe('local store', () => {
  it('writes the row and queues it for sync atomically', async () => {
    const trip = {
      id: crypto.randomUUID(),
      owner_id: crypto.randomUUID(),
      name: 'Lisbon & Porto',
      start_date: '2026-10-23',
      end_date: '2026-11-19',
    };
    await saveLocal(db, 'trips', trip);
    expect(await db.trips.get(trip.id)).toEqual(trip);
    const queued = await db.outbox.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ table: 'trips', op: 'upsert', row: trip });
  });
});

describe('outbox order', () => {
  it('keeps the order of changes made in the same millisecond', async () => {
    const db2 = new WayfareDB();
    await db2.open();
    await db2.outbox.clear();
    const now = Date.now();
    const realNow = Date.now;
    Date.now = () => now; // every write "at the same time"
    try {
      await applyLocal(db2, {
        upserts: [
          { table: 'places', row: { id: 'place-1' } },
          { table: 'stops', row: { id: 'stop-1' } },
        ],
        deletes: [],
      });
      await applyLocal(db2, { upserts: [{ table: 'stops', row: { id: 'stop-1' } }], deletes: [] });
      expect(nextQueuedAt()).toBeGreaterThan(now + 2);
    } finally {
      Date.now = realNow;
    }
    const ordered = await db2.outbox.orderBy('createdAt').toArray();
    expect(ordered.map((e) => `${e.table}:${(e.row as { id: string }).id}`)).toEqual([
      'places:place-1',
      'stops:stop-1',
      'stops:stop-1',
    ]);
  });
});
