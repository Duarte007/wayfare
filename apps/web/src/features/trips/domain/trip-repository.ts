import type { Trip } from '@wayfare/shared';

/** Trips port. Reads come from the device; writes are queued for sync by the implementation. */
export interface TripRepository {
  /** Emits the current list and every later change (offline included). */
  observeAll(listener: (trips: Trip[]) => void): () => void;
  save(trip: Trip): Promise<void>;
}
