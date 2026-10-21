/**
 * Protomaps' public demo archive (whole planet, Protomaps basemap v4 schema). DEVELOPMENT ONLY:
 * it has no uptime promise and is not meant for production traffic. Production sets
 * `VITE_MAP_TILES_URL` to our own archive; see docs/MAPS.md.
 */
export const DEMO_TILES_URL = 'pmtiles://https://demo-bucket.protomaps.com/v4.pmtiles';

export interface MapConfig {
  /** `pmtiles://<url>` for an archive, or a `{z}/{x}/{y}` template; Protomaps v4 schema. */
  tilesUrl: string;
  /** Base URL of the style's fonts and icons (`public/map` by default). */
  assetsUrl: string;
  usingDemoTiles: boolean;
}

export function readMapConfig(env: {
  VITE_MAP_TILES_URL?: string;
  VITE_MAP_ASSETS_URL?: string;
}): MapConfig {
  const tilesUrl = env.VITE_MAP_TILES_URL?.trim() || DEMO_TILES_URL;
  return {
    tilesUrl,
    assetsUrl: (env.VITE_MAP_ASSETS_URL?.trim() || '/map').replace(/\/$/, ''),
    usingDemoTiles: tilesUrl === DEMO_TILES_URL,
  };
}
