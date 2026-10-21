import type { Trip } from '@wayfare/shared';
import { liveQuery } from 'dexie';
import { saveLocal, type WayfareDB } from '../../../shared/infrastructure/db';
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

  save(trip: Trip) {
    return saveLocal(this.db, 'trips', trip);
  }
}
