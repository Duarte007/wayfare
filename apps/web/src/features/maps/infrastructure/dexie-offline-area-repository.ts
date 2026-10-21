import { liveQuery } from 'dexie';
import type { WayfareDB } from '../../../shared/infrastructure/db';
import type { OfflineArea, OfflineAreaRepository } from '../domain/map-ports';

/** Which cities are downloaded, kept next to the trips (local only, never synced). */
export class DexieOfflineAreaRepository implements OfflineAreaRepository {
  constructor(private readonly db: WayfareDB) {}

  observeAll(listener: (areas: OfflineArea[]) => void) {
    const subscription = liveQuery(() => this.db.map_areas.toArray()).subscribe({
      next: listener,
      error: (err: unknown) => console.error('Failed to read offline maps', err),
    });
    return () => subscription.unsubscribe();
  }

  async save(area: OfflineArea) {
    await this.db.map_areas.put(area);
  }

  async remove(placeId: string) {
    await this.db.map_areas.delete(placeId);
  }
}
