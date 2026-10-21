import type { Place } from '@wayfare/shared';
import type { ItineraryStop } from '../../trips/domain/trip-overview';
import type { BBox, LngLat } from './tiles';

export type MapPlaceKind = 'city' | 'stay' | 'activity';

/** One marker on the trip map (and one row in its list alternative). */
export interface MapPlace extends LngLat {
  /** The stop, stay or activity id: unique on the map. */
  id: string;
  kind: MapPlaceKind;
  /** The stop's place for a city; the stay's or activity's own place otherwise. */
  placeId: string;
  title: string;
  /** Travel order of the city it belongs to, starting at 1. */
  cityNumber: number;
  cityName: string;
  colorIndex: number;
  stopId: string;
}

/**
 * Cities in travel order, then each city's stays and activities that have a place of their own.
 * A city without coordinates (its place is not on the device yet) is left out.
 */
export function mapPlaces(
  itinerary: readonly ItineraryStop[],
  places: readonly Place[],
): MapPlace[] {
  const placeOf = (id: string | null | undefined) =>
    id ? places.find((p) => p.id === id) : undefined;
  const result: MapPlace[] = [];
  itinerary.forEach(({ stop, place, stays, activities }, index) => {
    const base = {
      cityNumber: index + 1,
      cityName: place?.name ?? '',
      colorIndex: stop.color_index,
      stopId: stop.id,
    };
    if (place) {
      result.push({
        ...base,
        id: stop.id,
        kind: 'city',
        placeId: place.id,
        title: place.name,
        lng: place.lng,
        lat: place.lat,
      });
    }
    const children = [
      ...stays.map((s) => ({
        kind: 'stay' as const,
        id: s.id,
        title: s.name,
        placeId: s.place_id,
      })),
      ...activities.map((a) => ({
        kind: 'activity' as const,
        id: a.id,
        title: a.title,
        placeId: a.place_id,
      })),
    ];
    for (const child of children) {
      const own = placeOf(child.placeId);
      if (!own) continue;
      result.push({ ...base, ...child, placeId: own.id, lng: own.lng, lat: own.lat });
    }
  });
  return result;
}

/** The smallest box around every point, or null when there is nothing to show. */
export function boundsOf(points: readonly LngLat[]): BBox | null {
  if (points.length === 0) return null;
  return points.reduce<BBox>(
    (box, p) => ({
      west: Math.min(box.west, p.lng),
      east: Math.max(box.east, p.lng),
      south: Math.min(box.south, p.lat),
      north: Math.max(box.north, p.lat),
    }),
    { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity },
  );
}
