import type { SyncedTable } from '@wayfare/shared';

/**
 * A change the server refused for good, set aside so it doesn't block the queue. The person
 * decides: retry it (after fixing what was wrong, or when access comes back) or discard it.
 */
export interface SyncIssue {
  /** The outbox entry. */
  id: string;
  kind: SyncIssueKind;
  op: 'upsert' | 'delete';
  /** The item's name or title, when the device knows it. */
  title: string | null;
  reason: SyncIssueReason;
  /** The server's code and message, for support. */
  detail: string;
  /** Epoch ms when the change was made. */
  createdAt: number;
}

/** What the person calls the item; cities are stored as a place plus a stop. */
export type SyncIssueKind =
  'trip' | 'city' | 'stay' | 'leg' | 'activity' | 'document' | 'link' | 'checklist';

const KIND_OF: Record<SyncedTable, SyncIssueKind> = {
  trips: 'trip',
  places: 'city',
  stops: 'city',
  stays: 'stay',
  legs: 'leg',
  activities: 'activity',
  documents: 'document',
  checklist_items: 'checklist',
  document_links: 'link',
};

export function issueKind(table: SyncedTable): SyncIssueKind {
  return KIND_OF[table];
}

/**
 * Why the server refused, in terms a person can act on:
 * - `permission`: they can no longer change it (left the trip, not the owner); 42501.
 * - `missing`: it points at something that no longer exists on the server; 23503.
 * - `duplicate`: the server already has one like it; 23505.
 * - `invalid`: any other validation, constraint or schema refusal.
 */
export type SyncIssueReason = 'permission' | 'missing' | 'duplicate' | 'invalid';

/** Reads the SQLSTATE at the start of a stored rejection ("42501 new row violates …"). */
export function issueReason(rejected: string): SyncIssueReason {
  const code = /^\s*([0-9A-Z]{5})\b/.exec(rejected)?.[1];
  if (code === '42501') return 'permission';
  if (code === '23503') return 'missing';
  if (code === '23505') return 'duplicate';
  return 'invalid';
}

export interface SyncIssueStore {
  /** Set-aside changes, oldest first, as they change. */
  observeIssues(listener: (issues: SyncIssue[]) => void): () => void;
  /** Puts the change back in the queue; the next pass sends it again. */
  retry(changeId: string): Promise<void>;
  /**
   * Drops the change and returns the table its row belongs to, so the caller can reload it from
   * the server: until then the device would keep showing a change the server refused.
   */
  discard(changeId: string): Promise<SyncedTable | null>;
}
