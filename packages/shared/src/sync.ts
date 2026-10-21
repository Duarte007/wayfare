/**
 * Tables mirrored on the device and synced with the server, in pull order: parents before
 * children, so a stop never arrives before its trip.
 */
export const SYNCED_TABLES = [
  'trips',
  'places',
  'stops',
  'stays',
  'legs',
  'activities',
  'documents',
  'checklist_items',
  // After documents: a link points at one. Its key is (document_id, entity_type, entity_id).
  'document_links',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

/**
 * Tables pulled to the device: every synced table. `document_links` has a composite key, which
 * the device turns into one id.
 */
export const PULLED_TABLES = SYNCED_TABLES;

export type PulledTable = (typeof PULLED_TABLES)[number];
