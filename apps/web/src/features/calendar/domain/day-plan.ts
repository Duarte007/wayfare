import type { Activity, Leg, Stay } from '@wayfare/shared';
import { daysBetween } from '@wayfare/shared';
import { zonedParts } from '../../../shared/lib/timezone';
import { sortActivities } from '../../itinerary/domain/activity';
import type { ItineraryStop } from '../../trips/domain/trip-overview';

/**
 * Where you are on a calendar day. A city's `end_date` is its departure day, which is also the
 * next city's first day: that overlap is a travel day.
 */
export type DayPlace =
  /** Before the trip starts or after it ends. */
  | { kind: 'outside' }
  /** A trip day that no city covers yet. */
  | { kind: 'free' }
  | { kind: 'city'; stop: ItineraryStop }
  | { kind: 'travel'; from: ItineraryStop; to: ItineraryStop };

export interface DayLeg {
  leg: Leg;
  from: ItineraryStop | undefined;
  to: ItineraryStop | undefined;
  departs: boolean;
  arrives: boolean;
}

export interface DayStay {
  stay: Stay;
  stop: ItineraryStop;
  /** Check-in is this day. */
  checkIn: boolean;
}

export interface DayPlan {
  date: string;
  place: DayPlace;
  /** 1-based day of the trip, or null outside it. */
  tripDay: number | null;
  /** Where you sleep the night that starts this day (check-in ≤ day < check-out). */
  stays: DayStay[];
  /** Legs leaving or arriving this day, in the local day of each end. */
  legs: DayLeg[];
  /** This day's activities, in plan order. */
  activities: Activity[];
}

export interface TripRange {
  start_date: string;
  end_date: string;
}

/** The cities whose days include `date`, departure day included, in travel order. */
function stopsOn(itinerary: readonly ItineraryStop[], date: string): ItineraryStop[] {
  return itinerary
    .filter((s) => s.stop.start_date <= date && date <= s.stop.end_date)
    .sort((a, b) => a.stop.position - b.stop.position);
}

export function placeOn(
  itinerary: readonly ItineraryStop[],
  trip: TripRange,
  date: string,
): DayPlace {
  if (date < trip.start_date || date > trip.end_date) return { kind: 'outside' };
  const here = stopsOn(itinerary, date);
  if (here.length === 0) return { kind: 'free' };
  if (here.length === 1) return { kind: 'city', stop: here[0]! };
  return { kind: 'travel', from: here[0]!, to: here.at(-1)! };
}

/**
 * The local day a leg leaves and arrives. Without a saved time, the leg belongs to the change
 * day: the day you leave the first city and the day the next one begins.
 */
export function legDays(
  leg: Leg,
  from: ItineraryStop | undefined,
  to: ItineraryStop | undefined,
): { depart: string | null; arrive: string | null } {
  const depart =
    leg.depart_at && leg.depart_tz
      ? zonedParts(leg.depart_at, leg.depart_tz).date
      : (from?.stop.end_date ?? null);
  const arrive =
    leg.arrive_at && leg.arrive_tz
      ? zonedParts(leg.arrive_at, leg.arrive_tz).date
      : (to?.stop.start_date ?? depart);
  return { depart, arrive };
}

export function dayPlan(
  itinerary: readonly ItineraryStop[],
  legs: readonly Leg[],
  trip: TripRange,
  date: string,
): DayPlan {
  const place = placeOn(itinerary, trip, date);
  const inTrip = place.kind !== 'outside';
  const byId = new Map(itinerary.map((s) => [s.stop.id, s]));

  const stays: DayStay[] = itinerary.flatMap((stop) =>
    stop.stays
      .filter((stay) => stay.check_in <= date && date < stay.check_out)
      .map((stay) => ({ stay, stop, checkIn: stay.check_in === date })),
  );

  const dayLegs: DayLeg[] = legs.flatMap((leg) => {
    const from = byId.get(leg.from_stop_id);
    const to = byId.get(leg.to_stop_id);
    const { depart, arrive } = legDays(leg, from, to);
    const departs = depart === date;
    const arrives = arrive === date;
    return departs || arrives ? [{ leg, from, to, departs, arrives }] : [];
  });

  const activities = sortActivities(
    itinerary.flatMap((s) => s.activities).filter((a) => a.date === date),
  );

  return {
    date,
    place,
    tripDay: inTrip ? daysBetween(trip.start_date, date) + 1 : null,
    stays,
    legs: dayLegs,
    activities,
  };
}

/** What a calendar cell needs to draw itself: colours, short label and markers. */
export interface DaySummary {
  date: string;
  place: DayPlace;
  checkIn: boolean;
  legModes: Leg['mode'][];
  activityCount: number;
}

export function daySummary(plan: DayPlan): DaySummary {
  return {
    date: plan.date,
    place: plan.place,
    checkIn: plan.stays.some((s) => s.checkIn),
    legModes: [...new Set(plan.legs.map((l) => l.leg.mode))],
    activityCount: plan.activities.length,
  };
}
