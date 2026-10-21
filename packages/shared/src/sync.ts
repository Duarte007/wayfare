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
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

/**
 * Tables pulled to the device. `document_links` is read-only for now (nothing on the device
 * writes links yet) and has a composite key, which the device turns into one id.
 */
export const PULLED_TABLES = [...SYNCED_TABLES, 'document_links'] as const;

export type PulledTable = (typeof PULLED_TABLES)[number];
