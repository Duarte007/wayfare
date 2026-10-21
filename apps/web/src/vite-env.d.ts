/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_URL: string;
  /** Map tiles: `pmtiles://<url>` or a `{z}/{x}/{y}` template (Protomaps v4). See docs/MAPS.md. */
  readonly VITE_MAP_TILES_URL?: string;
  /** Base URL of the map's fonts and icons; defaults to `/map` on our own origin. */
  readonly VITE_MAP_ASSETS_URL?: string;
}
