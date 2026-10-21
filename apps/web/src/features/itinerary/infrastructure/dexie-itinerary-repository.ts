import { applyLocal, type LocalChange, type WayfareDB } from '../../../shared/infrastructure/db';
import type { ItineraryChange, ItineraryRepository } from '../domain/itinerary-ports';

export class DexieItineraryRepository implements ItineraryRepository {
  constructor(private readonly db: WayfareDB) {}

  apply(change: ItineraryChange) {
    const upserts: LocalChange['upserts'] = [
      ...(change.places ?? []).map((row) => ({ table: 'places' as const, row })),
      ...(change.stops ?? []).map((row) => ({ table: 'stops' as const, row })),
      ...(change.stays ?? []).map((row) => ({ table: 'stays' as const, row })),
      ...(change.legs ?? []).map((row) => ({ table: 'legs' as const, row })),
      ...(change.trip ? [{ table: 'trips' as const, row: change.trip }] : []),
    ];
    const r = change.removed ?? {};
    const deletes: LocalChange['deletes'] = [
      ...(r.activities ?? []).map((id) => ({ table: 'activities' as const, id })),
      ...(r.stays ?? []).map((id) => ({ table: 'stays' as const, id })),
      ...(r.legs ?? []).map((id) => ({ table: 'legs' as const, id })),
      ...(r.stops ?? []).map((id) => ({ table: 'stops' as const, id })),
    ];
    return applyLocal(this.db, { upserts, deletes });
  }
}
