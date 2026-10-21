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
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];
