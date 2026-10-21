import { describe, expect, it } from 'vitest';
import { saveLocal, WayfareDB } from './db';

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
