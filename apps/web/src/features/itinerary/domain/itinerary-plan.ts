import {
  chainStops,
  daysBetween,
  type Place,
  type PlaceSuggestion,
  type Stop,
} from '@wayfare/shared';

export const MIN_NIGHTS = 1;
export const MAX_NIGHTS = 90;
/** Stop colours cycle through the 8 calendar colours of the reference design. */
const COLORS = 8;

export const nightsOf = (stop: Pick<Stop, 'start_date' | 'end_date'>) =>
  daysBetween(stop.start_date, stop.end_date);

const byPosition = (stops: readonly Stop[]) => [...stops].sort((a, b) => a.position - b.position);

/**
 * Lays the cities end to end from the trip's first day, in the given order, keeping each one's
 * nights. Position and colour follow the order. Pure: returns new objects.
 */
export function rechain(
  orderedStops: readonly Stop[],
  tripStart: string,
  nights?: number[],
): Stop[] {
  const chain = chainStops(tripStart, nights ?? orderedStops.map(nightsOf));
  return orderedStops.map((stop, position) => ({
    ...stop,
    position,
    color_index: position % COLORS,
    start_date: chain[position]!.start_date,
    end_date: chain[position]!.end_date,
  }));
}

export function placeFromSuggestion(s: PlaceSuggestion, tripId: string, id: string): Place {
  return {
    id,
    trip_id: tripId,
    name: s.name,
    name_local: s.name_local,
    country_code: s.country_code,
    city: s.name,
    lat: s.lat,
    lng: s.lng,
  };
}

/** Appends a city after the last one. */
export function addCity(
  stops: readonly Stop[],
  city: { stopId: string; tripId: string; placeId: string; nights: number },
  tripStart: string,
): Stop[] {
  const ordered = byPosition(stops);
  const added: Stop = {
    id: city.stopId,
    trip_id: city.tripId,
    place_id: city.placeId,
    position: ordered.length,
    color_index: 0,
    start_date: tripStart,
    end_date: tripStart,
    visibility: 'group',
    assignees: [],
  };
  return rechain([...ordered, added], tripStart, [...ordered.map(nightsOf), city.nights]);
}

export function setNights(
  stops: readonly Stop[],
  stopId: string,
  nights: number,
  tripStart: string,
) {
  const ordered = byPosition(stops);
  return rechain(
    ordered,
    tripStart,
    ordered.map((s) => (s.id === stopId ? nights : nightsOf(s))),
  );
}

/** Moves a city one place up (-1) or down (+1); out-of-range moves change nothing. */
export function moveStop(stops: readonly Stop[], stopId: string, delta: -1 | 1, tripStart: string) {
  const ordered = byPosition(stops);
  const from = ordered.findIndex((s) => s.id === stopId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ordered.length) return rechain(ordered, tripStart);
  [ordered[from], ordered[to]] = [ordered[to]!, ordered[from]!];
  return rechain(ordered, tripStart);
}

export function removeStop(stops: readonly Stop[], stopId: string, tripStart: string) {
  return rechain(
    byPosition(stops).filter((s) => s.id !== stopId),
    tripStart,
  );
}

/** Only the stops whose saved fields differ, so an edit writes (and syncs) the minimum. */
export function changedStops(before: readonly Stop[], after: readonly Stop[]): Stop[] {
  const old = new Map(before.map((s) => [s.id, s]));
  return after.filter((s) => {
    const prev = old.get(s.id);
    return (
      !prev ||
      prev.position !== s.position ||
      prev.start_date !== s.start_date ||
      prev.end_date !== s.end_date ||
      prev.color_index !== s.color_index
    );
  });
}

/** The trip has to last at least as long as its cities; never shortened automatically. */
export function tripEndFor(stops: readonly Stop[], currentEnd: string): string {
  const last = byPosition(stops).at(-1)?.end_date;
  return last && last > currentEnd ? last : currentEnd;
}
