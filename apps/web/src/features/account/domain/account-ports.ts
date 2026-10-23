import type { ExportTables } from './data-export';

/** Reads every synced table from the device. */
export interface AccountDataSource {
  readTables(): Promise<ExportTables>;
}

/** Hands a file to the person (a download in the browser). */
export interface FileSaver {
  save(name: string, file: Blob): void;
}

export type DeleteAccountResult = { ok: true } | { ok: false; reason: 'offline' | 'failed' };

/** Removes the signed-in account on the server: its files first, then the account and its data. */
export interface AccountDeletion {
  deleteAccount(): Promise<DeleteAccountResult>;
}
