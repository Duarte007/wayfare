import { describe, expect, it } from 'vitest';
import {
  applyLocal,
  documentLinkId,
  documentLinkKey,
  nextQueuedAt,
  saveLocal,
  WayfareDB,
} from './db';

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

describe('document links', () => {
  const link = (documentId: string, entityType: 'stay' | 'leg' | 'activity', entityId: string) => {
    const key = { document_id: documentId, entity_type: entityType, entity_id: entityId };
    return { id: documentLinkId(key), ...key, trip_id: 't', deleted_at: null };
  };

  it('builds and reads back the composite id', () => {
    const key = { document_id: 'd', entity_type: 'leg' as const, entity_id: 'l' };
    expect(documentLinkId(key)).toBe('d:leg:l');
    expect(documentLinkKey('d:leg:l')).toEqual({ id: 'd:leg:l', ...key });
  });

  it('removing a stay, leg or activity also removes the links pointing at it, first', async () => {
    const db3 = new WayfareDB();
    await db3.open();
    await Promise.all([db3.outbox.clear(), db3.documentLinks.clear()]);
    await db3.documentLinks.bulkPut([
      link('d1', 'stay', 's1'),
      link('d2', 'stay', 's1'),
      link('d1', 'leg', 'l1'),
      link('d1', 'activity', 'a1'),
    ]);
    await applyLocal(db3, {
      upserts: [],
      deletes: [
        { table: 'stays', id: 's1' },
        { table: 'activities', id: 'a1' },
      ],
    });
    expect((await db3.documentLinks.toArray()).map((l) => l.id)).toEqual(['d1:leg:l1']);
    const queued = await db3.outbox.orderBy('createdAt').toArray();
    expect(queued.map((e) => `${e.table}:${(e.row as { id: string }).id}`)).toEqual([
      'document_links:d1:stay:s1',
      'document_links:d2:stay:s1',
      'stays:s1',
      'document_links:d1:activity:a1',
      'activities:a1',
    ]);
    expect(queued[0]!.row).toMatchObject({
      document_id: 'd1',
      entity_type: 'stay',
      entity_id: 's1',
    });
  });
});
