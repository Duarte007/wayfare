import { liveQuery } from 'dexie';
import { applyLocal, type WayfareDB } from '../../../shared/infrastructure/db';
import type {
  ChecklistChange,
  ChecklistData,
  ChecklistRepository,
} from '../domain/checklist-ports';

export class DexieChecklistRepository implements ChecklistRepository {
  constructor(private readonly db: WayfareDB) {}

  observe(tripId: string, listener: (data: ChecklistData | null) => void) {
    const subscription = liveQuery(() => this.read(tripId)).subscribe({
      next: listener,
      error: (err: unknown) => console.error('Failed to read the checklist', err),
    });
    return () => subscription.unsubscribe();
  }

  apply(change: ChecklistChange) {
    return applyLocal(this.db, {
      upserts: (change.items ?? []).map((row) => ({ table: 'checklist_items' as const, row })),
      deletes: (change.removed ?? []).map((id) => ({ table: 'checklist_items' as const, id })),
    });
  }

  private async read(tripId: string): Promise<ChecklistData | null> {
    const db = this.db;
    const trip = await db.trips.get(tripId);
    if (!trip) return null;
    const [items, places, stops] = await Promise.all([
      db.checklist_items.where('trip_id').equals(tripId).toArray(),
      db.places.where('trip_id').equals(tripId).toArray(),
      db.stops.where('trip_id').equals(tripId).toArray(),
    ]);
    return { trip, items, places, stops };
  }
}
