import { daysBetween, type Trip } from '@wayfare/shared';

export interface TripSummary {
  nights: number;
  /** Days until departure; 0 or less once the trip has started. */
  daysToGo: number;
}

export function summarizeTrip(
  trip: Pick<Trip, 'start_date' | 'end_date'>,
  today: string,
): TripSummary {
  return {
    nights: daysBetween(trip.start_date, trip.end_date),
    daysToGo: daysBetween(today, trip.start_date),
  };
}
