import type { Trip } from '@wayfare/shared';
import type { TripDetails } from './trip-overview';

/** Trips port. Reads come from the device; writes are queued for sync by the implementation. */
export interface TripRepository {
  /** Emits the current list and every later change (offline included). */
  observeAll(listener: (trips: Trip[]) => void): () => void;
  /** One trip with its cities, stays, legs, activities and documents; null if it isn't here. */
  observeTrip(tripId: string, listener: (details: TripDetails | null) => void): () => void;
  save(trip: Trip): Promise<void>;
  /** Removes the trip from the device and queues the deletion for sync. */
  remove(trip: Trip): Promise<void>;
}
