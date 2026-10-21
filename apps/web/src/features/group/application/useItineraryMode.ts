import { useState } from 'react';
import { readPref, writePref } from '../../../shared/lib/storage';
import { isItineraryMode, type ItineraryMode } from '../domain/group';

const KEY = 'wayfare.itineraryMode';

/** "Mine" or "Everyone" on the itinerary; remembered on this device, "Mine" by default. */
export function useItineraryMode(): [ItineraryMode, (mode: ItineraryMode) => void] {
  const [mode, setMode] = useState<ItineraryMode>(() => {
    const saved = readPref(KEY);
    return isItineraryMode(saved) ? saved : 'mine';
  });
  return [
    mode,
    (next) => {
      setMode(next);
      writePref(KEY, next);
    },
  ];
}
