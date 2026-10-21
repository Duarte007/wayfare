import type { PlaceSearchRequest, PlaceSuggestion } from '@wayfare/shared';
import type { PlaceSearch } from './ports.js';

/** Use case: find a city to add to an itinerary. Thin today; the seam for ranking or limits. */
export class SearchPlaces {
  constructor(private readonly places: PlaceSearch) {}

  execute(request: PlaceSearchRequest): Promise<PlaceSuggestion[]> {
    return this.places.search({ ...request, q: request.q.trim() });
  }
}
