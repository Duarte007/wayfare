import type { Trip } from '@wayfare/shared';
import { useEffect, useState } from 'react';
import type { TripDetails } from '../domain/trip-overview';
import { useTripRepository } from './TripsProvider';

/** `undefined` while reading the device, `null` when the trip isn't here (deleted, left the group). */
export function useTripDetails(tripId: string): TripDetails | null | undefined {
  const repository = useTripRepository();
  const [details, setDetails] = useState<{ id: string; value: TripDetails | null } | undefined>();
  useEffect(
    () => repository.observeTrip(tripId, (value) => setDetails({ id: tripId, value })),
    [repository, tripId],
  );
  // Never show the previous trip's data while the next one loads.
  return details?.id === tripId ? details.value : undefined;
}

export function useRemoveTrip(): (trip: Trip) => Promise<void> {
  const repository = useTripRepository();
  return (trip) => repository.remove(trip);
}
