import { afterEach, describe, expect, it } from 'vitest';
import { WayfareDB } from '../../../shared/infrastructure/db';
import { DexieAccountData } from './dexie-account-data';

describe('DexieAccountData', () => {
  const db = new WayfareDB();
  afterEach(() => db.delete().then(() => db.open()));

  it('reads every synced table, document links included', async () => {
    await db.trips.put({ id: 't1', name: 'Trip' } as never);
    await db.documentLinks.put({ id: 'd:stay:s', document_id: 'd', trip_id: 't1' } as never);
    const tables = await new DexieAccountData(db).readTables();
    expect(tables.trips).toHaveLength(1);
    expect(tables.document_links).toHaveLength(1);
    expect(tables.checklist_items).toEqual([]);
  });
});
