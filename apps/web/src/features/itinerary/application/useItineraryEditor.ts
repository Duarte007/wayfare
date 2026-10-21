import type { PlaceSuggestion, Stop } from '@wayfare/shared';
import type { TripDetails } from '../../trips/domain/trip-overview';
import {
  addCity,
  changedStops,
  moveStop,
  placeFromSuggestion,
  removeStop,
  setNights,
  tripEndFor,
} from '../domain/itinerary-plan';
import type { ItineraryChange } from '../domain/itinerary-ports';
import { useItineraryDependencies } from './ItineraryProvider';

/**
 * Edits the cities of a trip. Every action re-chains the dates from the first day, saves only
 * what changed (offline-first, queued for sync) and stretches the trip end if the cities need it.
 */
export function useItineraryEditor(details: TripDetails) {
  const { repository } = useItineraryDependencies();
  const { trip } = details;

  const commit = (after: Stop[], extra: Omit<ItineraryChange, 'stops' | 'trip'> = {}) => {
    const end = tripEndFor(after, trip.end_date);
    return repository.apply({
      ...extra,
      stops: changedStops(details.stops, after),
      trip: end === trip.end_date ? undefined : { ...trip, end_date: end },
    });
  };

  /** What adding `nights` would do, for the dialog preview. */
  const previewAdd = (nights: number) => {
    const after = addCity(
      details.stops,
      { stopId: 'preview', tripId: trip.id, placeId: '', nights },
      trip.start_date,
    );
    const added = after.at(-1)!;
    const end = tripEndFor(after, trip.end_date);
    return {
      start: added.start_date,
      end: added.end_date,
      newTripEnd: end === trip.end_date ? null : end,
    };
  };

  return {
    previewAdd,
    addCity: (suggestion: PlaceSuggestion, nights: number) => {
      const place = placeFromSuggestion(suggestion, trip.id, crypto.randomUUID());
      const after = addCity(
        details.stops,
        { stopId: crypto.randomUUID(), tripId: trip.id, placeId: place.id, nights },
        trip.start_date,
      );
      return commit(after, { places: [place] });
    },
    setNights: (stopId: string, nights: number) =>
      commit(setNights(details.stops, stopId, nights, trip.start_date)),
    move: (stopId: string, delta: -1 | 1) =>
      commit(moveStop(details.stops, stopId, delta, trip.start_date)),
    remove: (stopId: string) =>
      commit(removeStop(details.stops, stopId, trip.start_date), {
        removed: {
          activities: details.activities.filter((a) => a.stop_id === stopId).map((a) => a.id),
          stays: details.stays.filter((s) => s.stop_id === stopId).map((s) => s.id),
          legs: details.legs
            .filter((l) => l.from_stop_id === stopId || l.to_stop_id === stopId)
            .map((l) => l.id),
          stops: [stopId],
        },
      }),
  };
}
