import type { PlaceSuggestion } from '@wayfare/shared';
import { useEffect, useState } from 'react';
import { useItineraryDependencies } from './ItineraryProvider';

export type PlaceSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; places: PlaceSuggestion[] }
  | { status: 'offline' }
  | { status: 'error' };

const DEBOUNCE_MS = 400;

/** Searches as you type, after a pause, cancelling the previous request. */
export function usePlaceSearch(query: string, locale: string): PlaceSearchState {
  const { placeSearch } = useItineraryDependencies();
  const [state, setState] = useState<PlaceSearchState>({ status: 'idle' });
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState({ status: 'loading' });
      placeSearch
        .search(q, locale, controller.signal)
        .then((result) =>
          setState(result.status === 'ok' ? { status: 'done', places: result.places } : result),
        )
        .catch(() => {
          // Aborted by a newer query; that one sets the state.
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [placeSearch, q, locale]);

  return q.length < 2 ? { status: 'idle' } : state;
}
