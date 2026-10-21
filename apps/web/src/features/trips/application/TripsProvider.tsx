import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Trip } from '@wayfare/shared';
import type { TripRepository } from '../domain/trip-repository';

const TripRepositoryContext = createContext<TripRepository | null>(null);

export function TripsProvider({
  repository,
  children,
}: {
  repository: TripRepository;
  children: ReactNode;
}) {
  return (
    <TripRepositoryContext.Provider value={repository}>{children}</TripRepositoryContext.Provider>
  );
}

function useTripRepository(): TripRepository {
  const repository = useContext(TripRepositoryContext);
  if (!repository) throw new Error('useTrips must be used inside TripsProvider');
  return repository;
}

/** `undefined` while the local store is first read. */
export function useTrips(): Trip[] | undefined {
  const repository = useTripRepository();
  const [trips, setTrips] = useState<Trip[] | undefined>(undefined);
  useEffect(() => repository.observeAll(setTrips), [repository]);
  return trips;
}
