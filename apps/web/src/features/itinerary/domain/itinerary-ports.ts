import type { Leg, Place, PlaceSuggestion, Stay, Stop, Trip } from '@wayfare/shared';

/** One edit of the itinerary, saved atomically on the device and queued for sync. */
export interface ItineraryChange {
  trip?: Trip;
  places?: Place[];
  stops?: Stop[];
  stays?: Stay[];
  legs?: Leg[];
  /** Ids to delete, children first so nothing on the server points at a deleted city. */
  removed?: { activities?: string[]; stays?: string[]; legs?: string[]; stops?: string[] };
}

export interface ItineraryRepository {
  apply(change: ItineraryChange): Promise<void>;
}

export type PlaceSearchResult =
  { status: 'ok'; places: PlaceSuggestion[] } | { status: 'offline' } | { status: 'error' };

export interface PlaceSearchClient {
  search(query: string, locale: string, signal?: AbortSignal): Promise<PlaceSearchResult>;
}
