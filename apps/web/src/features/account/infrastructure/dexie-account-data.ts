import { SYNCED_TABLES } from '@wayfare/shared';
import { localTable, type WayfareDB } from '../../../shared/infrastructure/db';
import type { AccountDataSource } from '../domain/account-ports';
import type { ExportTables } from '../domain/data-export';

export class DexieAccountData implements AccountDataSource {
  constructor(private readonly db: WayfareDB) {}

  async readTables(): Promise<ExportTables> {
    const rows = await this.db.transaction(
      'r',
      SYNCED_TABLES.map((table) => localTable(this.db, table)),
      () => Promise.all(SYNCED_TABLES.map((table) => localTable(this.db, table).toArray())),
    );
    return Object.fromEntries(
      SYNCED_TABLES.map((table, i) => [table, rows[i] ?? []]),
    ) as ExportTables;
  }
}
