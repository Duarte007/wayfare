import type { MapPlace } from './map-places';
import type { BBox, LngLat, TileId } from './tiles';

/** A city's map saved on the device. Local only: never synced, every device downloads its own. */
export interface OfflineArea {
  /** The city's place id: one area per city. */
  placeId: string;
  tripId: string;
  name: string;
  bbox: BBox;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  /** Bytes actually stored. */
  bytes: number;
  downloadedAt: string;
}

export interface OfflineAreaRepository {
  observeAll(listener: (areas: OfflineArea[]) => void): () => void;
  save(area: OfflineArea): Promise<void>;
  remove(placeId: string): Promise<void>;
}

/** Where tiles come from when online (a PMTiles archive or a z/x/y URL). */
export interface TileSource {
  /** The tile's decoded bytes; null when the source has no tile there (open sea, outside an extract). */
  fetchTile(tile: TileId, signal?: AbortSignal): Promise<ArrayBuffer | null>;
}

/** Tiles kept on the device for offline use. */
export interface TileStore {
  /** Stores the tile and returns how many bytes it takes; null stores a known-empty tile. */
  put(tile: TileId, data: ArrayBuffer | null): Promise<number>;
  remove(tiles: readonly TileId[]): Promise<void>;
  /** Saves the style's fonts and icons so labels render offline. */
  saveStyleAssets(): Promise<void>;
  /** Bytes the browser still lets this site store, or null when it can't tell. */
  availableBytes(): Promise<number | null>;
}

export interface MapViewOptions {
  /** App language, for label names on the map. */
  language: string;
  dark: boolean;
  ariaLabel: string;
  onSelect: (placeId: string | null) => void;
  /** The visible area after every move, to tell whether it is on the device. */
  onMove: (visible: BBox) => void;
}

/** A mounted interactive map. */
export interface MapView {
  setPlaces(places: readonly MapPlace[], selectedId: string | null): void;
  fitTo(bbox: BBox): void;
  flyTo(point: LngLat): void;
  destroy(): void;
}

/** Draws the map; loaded on demand so the map library stays out of the first download. */
export interface MapRenderer {
  mount(container: HTMLElement, options: MapViewOptions): MapView;
}
