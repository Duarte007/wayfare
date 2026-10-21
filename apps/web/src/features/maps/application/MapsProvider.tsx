import { createContext, useContext, type ReactNode } from 'react';
import type {
  MapRenderer,
  OfflineAreaRepository,
  TileSource,
  TileStore,
} from '../domain/map-ports';

export interface MapsDependencies {
  areas: OfflineAreaRepository;
  tiles: TileStore;
  source: TileSource;
  /** Loads the map library on demand (its own chunk), only when a map is shown. */
  loadRenderer: () => Promise<MapRenderer>;
}

const MapsContext = createContext<MapsDependencies | null>(null);

export function MapsProvider({ children, ...deps }: MapsDependencies & { children: ReactNode }) {
  return <MapsContext.Provider value={deps}>{children}</MapsContext.Provider>;
}

export function useMapsDependencies(): MapsDependencies {
  const deps = useContext(MapsContext);
  if (!deps) throw new Error('Map hooks must be used inside MapsProvider');
  return deps;
}
