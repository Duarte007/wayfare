import { createContext, useContext, type ReactNode } from 'react';
import type { ItineraryRepository, PlaceSearchClient } from '../domain/itinerary-ports';

interface ItineraryDependencies {
  repository: ItineraryRepository;
  placeSearch: PlaceSearchClient;
}

const ItineraryContext = createContext<ItineraryDependencies | null>(null);

export function ItineraryProvider({
  children,
  ...deps
}: ItineraryDependencies & { children: ReactNode }) {
  return <ItineraryContext.Provider value={deps}>{children}</ItineraryContext.Provider>;
}

export function useItineraryDependencies(): ItineraryDependencies {
  const deps = useContext(ItineraryContext);
  if (!deps) throw new Error('Itinerary hooks must be used inside ItineraryProvider');
  return deps;
}
