import { SYNCED_TABLES, type SyncedTable } from '@wayfare/shared';

export type ExportRow = Record<string, unknown>;

/** Every synced table as the device holds it. */
export type ExportTables = Record<SyncedTable, ExportRow[]>;

export interface ExportAccount {
  id: string;
  email: string | null;
  displayName: string | null;
}

export interface DataExport {
  format: 'wayfare-export';
  version: 1;
  exportedAt: string;
  /** Whether the device reached the server just before the export (else it is the device copy). */
  syncedBeforeExport: boolean;
  account: ExportAccount;
  /** Document files are not included; each document keeps its `storage_path`. */
  notes: string[];
  tables: ExportTables;
}

/** Device-only fields (sync bookkeeping) that mean nothing outside the app. */
const LOCAL_FIELDS = new Set(['version']);

function clean(row: ExportRow): ExportRow {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !LOCAL_FIELDS.has(key)));
}

/**
 * The person's data as one JSON document: their account and every trip row on the device, minus
 * removed rows. Trips they share include their mates' shared rows, so the file matches what the app
 * shows them.
 */
export function buildDataExport(input: {
  account: ExportAccount;
  tables: Partial<ExportTables>;
  exportedAt: Date;
  syncedBeforeExport: boolean;
}): DataExport {
  const tables = Object.fromEntries(
    SYNCED_TABLES.map((table) => [
      table,
      (input.tables[table] ?? []).filter((row) => row.deleted_at == null).map(clean),
    ]),
  ) as ExportTables;
  return {
    format: 'wayfare-export',
    version: 1,
    exportedAt: input.exportedAt.toISOString(),
    syncedBeforeExport: input.syncedBeforeExport,
    account: input.account,
    notes: [
      'Document files are not included in this file; open each document in the app to save it.',
    ],
    tables,
  };
}

/** `wayfare-data-2026-10-23.json`, dated in the person's own calendar. */
export function exportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `wayfare-data-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
