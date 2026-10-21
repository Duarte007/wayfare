/** Web Mercator tile math for downloading a city's map: pure functions, no I/O. */

export interface LngLat {
  lng: number;
  lat: number;
}

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface TileId {
  z: number;
  x: number;
  y: number;
}

/** Web Mercator stops at about ±85.05°; tiles do not exist beyond it. */
const MAX_LAT = 85.05112878;
const KM_PER_DEGREE_LAT = 111.32;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const tileKey = ({ z, x, y }: TileId) => `${z}/${x}/${y}`;

/** A square of `radiusKm` around the point, clamped to the map's edges. */
export function bboxAround(center: LngLat, radiusKm: number): BBox {
  const lat = clamp(center.lat, -MAX_LAT, MAX_LAT);
  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  // Keep the cosine away from zero so a point near a pole still gets a finite box.
  const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return {
    west: clamp(center.lng - lngDelta, -180, 180),
    east: clamp(center.lng + lngDelta, -180, 180),
    south: clamp(lat - latDelta, -MAX_LAT, MAX_LAT),
    north: clamp(lat + latDelta, -MAX_LAT, MAX_LAT),
  };
}

export function containsPoint(bbox: BBox, point: LngLat): boolean {
  return (
    point.lng >= bbox.west &&
    point.lng <= bbox.east &&
    point.lat >= bbox.south &&
    point.lat <= bbox.north
  );
}

export function intersects(a: BBox, b: BBox): boolean {
  return a.west <= b.east && b.west <= a.east && a.south <= b.north && b.south <= a.north;
}

/** The tile at zoom `z` that contains the point. */
export function tileAt(point: LngLat, z: number): TileId {
  const n = 2 ** z;
  const lat = (clamp(point.lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180;
  const x = Math.floor(((point.lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n);
  return { z, x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1) };
}

/** The tile range at zoom `z` that touches the box. */
function tileRange(bbox: BBox, z: number) {
  const topLeft = tileAt({ lng: bbox.west, lat: bbox.north }, z);
  const bottomRight = tileAt({ lng: bbox.east, lat: bbox.south }, z);
  return { minX: topLeft.x, maxX: bottomRight.x, minY: topLeft.y, maxY: bottomRight.y };
}

/** Every tile at zoom `z` that touches the box. */
export function tilesInBBox(bbox: BBox, z: number): TileId[] {
  const { minX, maxX, minY, maxY } = tileRange(bbox, z);
  const tiles: TileId[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) tiles.push({ z, x, y });
  }
  return tiles;
}

export function tilesForArea(bbox: BBox, minZoom: number, maxZoom: number): TileId[] {
  const tiles: TileId[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    for (const tile of tilesInBBox(bbox, z)) tiles.push(tile);
  }
  return tiles;
}

/** How many tiles each zoom needs, without listing them (a huge area stays cheap to plan). */
function tileCounts(bbox: BBox, minZoom: number, maxZoom: number): number[] {
  const counts: number[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const { minX, maxX, minY, maxY } = tileRange(bbox, z);
    counts.push((maxX - minX + 1) * (maxY - minY + 1));
  }
  return counts;
}

/**
 * Typical stored size of one vector tile (Protomaps basemap, gzip) by zoom, measured on a dense
 * European city centre. Low zooms hold whole countries, so they are the heaviest per tile.
 */
const AVERAGE_TILE_BYTES = [
  420, 380, 420, 280, 250, 170, 100, 110, 100, 115, 100, 80, 70, 75, 45, 45,
].map((kb) => kb * 1024);

const averageBytesAt = (z: number) =>
  AVERAGE_TILE_BYTES[clamp(z, 0, AVERAGE_TILE_BYTES.length - 1)]!;

export function estimateBytes(tiles: readonly TileId[]): number {
  return tiles.reduce((sum, t) => sum + averageBytesAt(t.z), 0);
}

export interface AreaOptions {
  radiusKm: number;
  minZoom: number;
  maxZoom: number;
  /** Detail is dropped (lower max zoom) until the area fits both caps. */
  maxTiles: number;
  maxBytes: number;
  /** Never drop below this zoom: streets are unreadable without it. */
  minDetailZoom: number;
}

/**
 * A city centre and its surroundings at street level (zoom 15 is the source's deepest; the map
 * overzooms beyond it). Zooms 0–9 add one or two tiles each, so the trip overview still shows
 * offline.
 */
export const DEFAULT_AREA_OPTIONS: AreaOptions = {
  radiusKm: 10,
  minZoom: 0,
  maxZoom: 15,
  maxTiles: 2000,
  maxBytes: 80 * 1024 * 1024,
  minDetailZoom: 13,
};

export interface AreaPlan {
  bbox: BBox;
  minZoom: number;
  maxZoom: number;
  tiles: TileId[];
  estimatedBytes: number;
  /** True when even the minimum detail exceeds the caps; the UI refuses to download. */
  tooLarge: boolean;
}

/** What "Download map" for one place will fetch, and roughly how much space it takes. */
export function planArea(center: LngLat, options: AreaOptions = DEFAULT_AREA_OPTIONS): AreaPlan {
  const bbox = bboxAround(center, options.radiusKm);
  let maxZoom = options.maxZoom;
  for (;;) {
    const counts = tileCounts(bbox, options.minZoom, maxZoom);
    const tileCount = counts.reduce((a, b) => a + b, 0);
    const estimatedBytes = counts.reduce(
      (sum, n, i) => sum + n * averageBytesAt(options.minZoom + i),
      0,
    );
    const fits = tileCount <= options.maxTiles && estimatedBytes <= options.maxBytes;
    if (fits || maxZoom <= options.minDetailZoom) {
      return {
        bbox,
        minZoom: options.minZoom,
        maxZoom,
        // Never list the tiles of an area that won't be downloaded.
        tiles: fits ? tilesForArea(bbox, options.minZoom, maxZoom) : [],
        estimatedBytes,
        tooLarge: !fits,
      };
    }
    maxZoom -= 1;
  }
}

/**
 * Tiles to delete when an area goes: its own tiles minus any another kept area still uses
 * (neighbouring cities share their low-zoom tiles).
 */
export function tilesOnlyIn(
  area: Pick<AreaPlan, 'bbox' | 'minZoom' | 'maxZoom'>,
  others: readonly Pick<AreaPlan, 'bbox' | 'minZoom' | 'maxZoom'>[],
): TileId[] {
  const kept = new Set(
    others.flatMap((o) => tilesForArea(o.bbox, o.minZoom, o.maxZoom).map(tileKey)),
  );
  return tilesForArea(area.bbox, area.minZoom, area.maxZoom).filter((t) => !kept.has(tileKey(t)));
}
