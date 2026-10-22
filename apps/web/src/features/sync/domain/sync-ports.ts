/**
 * Sync ports. The engine moves changes between the device store and the server; it does not know
 * about Dexie or Supabase.
 */

import type { PulledTable, SyncedTable } from '@wayfare/shared';

export { PULLED_TABLES, type PulledTable, type SyncedTable } from '@wayfare/shared';

export interface PendingChange {
  id: string;
  table: SyncedTable;
  op: 'upsert' | 'delete';
  row: { id: string } & Record<string, unknown>;
}

export interface RemoteRow {
  /** Absent on composite-key tables (document_links); the local store derives one. */
  id?: string;
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
  /** When the last pass and the last full refresh finished, as they change. */
  observeSyncTimes(listener: (times: SyncTimes) => void): () => void;
  cursor(table: PulledTable): Promise<number>;
  /**
   * Stores pulled rows and advances the cursor atomically. Rows with unsent local changes are
   * skipped, checked in the same transaction, so an edit made during the pull is never lost.
   * Rejected changes don't count: the server's row wins.
   */
  applyRemote(table: PulledTable, rows: RemoteRow[], cursor: number): Promise<void>;
  /**
   * After a full pull of `table`: removes the rows the server no longer returned (`liveIds` holds
   * the device ids of every live row it did return), except rows with unsent changes. Rejected
   * changes don't count, as in `applyRemote`. Returns how many rows were removed.
   */
  removeMissing(table: PulledTable, liveIds: ReadonlySet<string>): Promise<number>;
  /** The device id of a pulled row (document links have a composite key on the server). */
  localId(table: PulledTable, row: RemoteRow): string;
  /** When the last full refresh finished and which app build ran it; null if never. */
  lastFullRefresh(): Promise<FullRefreshMark | null>;
  markFullRefresh(mark: FullRefreshMark): Promise<void>;
  /** Records the end of a pass that reached the server for every step. */
  markSynced(at: number): Promise<void>;
  /**
   * Removes trips the user is no longer a member of (with everything under them), except those
   * with unsent changes, and returns the ids in `memberTripIds` this device doesn't have yet.
   */
  keepTrips(memberTripIds: readonly string[]): Promise<{ missing: string[] }>;
  /** Forgets every pull cursor, so the next pull brings every visible row again. */
  resetCursors(): Promise<void>;
}

export interface SyncTimes {
  /** Epoch ms of the last pass that reached the server; null if none yet. */
  lastSyncedAt: number | null;
  /** Epoch ms of the last full refresh; null if none yet. */
  lastFullRefreshAt: number | null;
}

export interface FullRefreshMark {
  /** Epoch milliseconds. */
  at: number;
  build: string;
}

export interface RemoteSyncStore {
  push(change: PendingChange): Promise<{ outcome: PushOutcome; reason?: string }>;
  /**
   * Rows changed after `since`, by ascending version, deleted ones included; null when the server
   * can't be reached.
   */
  pull(table: PulledTable, since: number, limit: number): Promise<RemoteRow[] | null>;
  /** Trips the user is a member of right now (not deleted); null when the server can't be reached. */
  memberTripIds(): Promise<string[] | null>;
}

/** Extra work in a sync pass (e.g. document files); false when the server couldn't be reached. */
export type SyncStep = () => Promise<boolean>;

export interface SyncSteps {
  /** After local changes were pushed, so the rows a step depends on exist on the server. */
  afterPush?: readonly SyncStep[];
  /** After the pull, when the device holds every row it can see. */
  afterPull?: readonly SyncStep[];
}
