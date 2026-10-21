import type { Trip } from '@wayfare/shared';
import { liveQuery } from 'dexie';
import { deleteLocal, saveLocal, type WayfareDB } from '../../../shared/infrastructure/db';
import type { TripDetails } from '../domain/trip-overview';
import type { TripRepository } from '../domain/trip-repository';

export class DexieTripRepository implements TripRepository {
  constructor(private readonly db: WayfareDB) {}

  observeAll(listener: (trips: Trip[]) => void) {
    const subscription = liveQuery(() => this.db.trips.orderBy('start_date').toArray()).subscribe({
      next: listener,
      error: (err: unknown) => console.error('Failed to read trips', err),
    });
    return () => subscription.unsubscribe();
  }

  observeTrip(tripId: string, listener: (details: TripDetails | null) => void) {
    const subscription = liveQuery(() => this.readTrip(tripId)).subscribe({
      next: listener,
      error: (err: unknown) => console.error('Failed to read trip', err),
    });
    return () => subscription.unsubscribe();
  }

  save(trip: Trip) {
    return saveLocal(this.db, 'trips', trip);
  }

  async remove(trip: Trip) {
    await deleteLocal(this.db, 'trips', trip.id);
    // The server keeps the children of a deleted trip; the device has no use for them.
    const db = this.db;
    const children = [
      db.places,
      db.stops,
      db.stays,
      db.legs,
      db.activities,
      db.documents,
      db.checklist_items,
    ];
    await db.transaction('rw', children, async () => {
      for (const table of children) {
        await table.where('trip_id').equals(trip.id).delete();
      }
    });
  }

  private async readTrip(tripId: string): Promise<TripDetails | null> {
    const db = this.db;
    const trip = await db.trips.get(tripId);
    if (!trip) return null;
    const [places, stops, stays, legs, activities, documents] = await Promise.all([
      db.places.where('trip_id').equals(tripId).toArray(),
      db.stops.where('trip_id').equals(tripId).toArray(),
      db.stays.where('trip_id').equals(tripId).toArray(),
      db.legs.where('trip_id').equals(tripId).toArray(),
      db.activities.where('trip_id').equals(tripId).toArray(),
      db.documents.where('trip_id').equals(tripId).toArray(),
    ]);
    const links = documents.length
      ? await db.documentLinks
          .where('document_id')
          .anyOf(documents.map((d) => d.id))
          .toArray()
      : [];
    return { trip, places, stops, stays, legs, activities, documents, links };
  }
}
