import {
  daysBetween,
  type Activity,
  type DocumentLink,
  type Leg,
  type Place,
  type Stay,
  type Stop,
  type TravelDocument,
  type Trip,
} from '@wayfare/shared';

/** Everything the device has for one trip, as the trip page needs it. */
export interface TripDetails {
  trip: Trip;
  places: Place[];
  stops: Stop[];
  stays: Stay[];
  legs: Leg[];
  activities: Activity[];
  documents: TravelDocument[];
  links: DocumentLink[];
}

export interface ItineraryStop {
  stop: Stop;
  place: Place | undefined;
  nights: number;
  stays: Stay[];
  activities: Activity[];
  /** The way to the next city, or null when there is none saved (or this is the last city). */
  legToNext: Leg | null;
  isLast: boolean;
}

/** Cities in travel order, each with its stays, activities and the leg that leaves it. */
export function buildItinerary(details: TripDetails): ItineraryStop[] {
  const stops = [...details.stops].sort((a, b) => a.position - b.position);
  return stops.map((stop, i) => {
    const next = stops[i + 1];
    return {
      stop,
      place: details.places.find((p) => p.id === stop.place_id),
      nights: daysBetween(stop.start_date, stop.end_date),
      stays: details.stays
        .filter((s) => s.stop_id === stop.id)
        .sort((a, b) => a.check_in.localeCompare(b.check_in)),
      activities: details.activities.filter((a) => a.stop_id === stop.id),
      legToNext: next
        ? (details.legs.find((l) => l.from_stop_id === stop.id && l.to_stop_id === next.id) ?? null)
        : null,
      isLast: !next,
    };
  });
}

export type TripPhase =
  | { phase: 'upcoming'; daysToGo: number }
  | { phase: 'ongoing'; day: number; total: number }
  | { phase: 'past' };

/** Where today falls in the trip; the first and last day both count as trip days. */
export function tripPhase(trip: Pick<Trip, 'start_date' | 'end_date'>, today: string): TripPhase {
  if (today < trip.start_date)
    return { phase: 'upcoming', daysToGo: daysBetween(today, trip.start_date) };
  if (today > trip.end_date) return { phase: 'past' };
  return {
    phase: 'ongoing',
    day: daysBetween(trip.start_date, today) + 1,
    total: daysBetween(trip.start_date, trip.end_date) + 1,
  };
}
