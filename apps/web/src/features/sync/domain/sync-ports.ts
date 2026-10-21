/**
 * Sync ports. The engine moves changes between the device store and the server; it does not know
 * about Dexie or Supabase.
 */

import type { SyncedTable } from '@wayfare/shared';

export { SYNCED_TABLES, type SyncedTable } from '@wayfare/shared';

export interface PendingChange {
  id: string;
  table: SyncedTable;
  op: 'upsert' | 'delete';
  row: { id: string } & Record<string, unknown>;
}

export interface RemoteRow {
  id: string;
  version: number;
  deleted_at?: string | null;
  [column: string]: unknown;
}

/** Transient failures (offline, timeout, expired token) are retried; rejected ones never will pass. */
export type PushOutcome = 'pushed' | 'transient' | 'rejected';

export interface LocalSyncStore {
  /** Oldest first, excluding changes the server already rejected. */
  pendingChanges(limit: number): Promise<PendingChange[]>;
  markPushed(changeId: string): Promise<void>;
  markRejected(changeId: string, reason: string): Promise<void>;
  observePendingCount(listener: (count: number) => void): () => void;
  cursor(table: SyncedTable): Promise<number>;
  /**
   * Stores pulled rows and advances the cursor atomically. Rows with unsent local changes are
   * skipped, checked in the same transaction, so an edit made during the pull is never lost.
   * Rejected changes don't count: the server's row wins.
   */
  applyRemote(table: SyncedTable, rows: RemoteRow[], cursor: number): Promise<void>;
}

export interface RemoteSyncStore {
  push(change: PendingChange): Promise<{ outcome: PushOutcome; reason?: string }>;
  /** Rows changed after `since`, by ascending version; null when the server can't be reached. */
  pull(table: SyncedTable, since: number, limit: number): Promise<RemoteRow[] | null>;
}
