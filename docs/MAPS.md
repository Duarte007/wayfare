# Maps

The trip map (`/trips/$tripId/map`) shows the cities (numbered in travel order, in their calendar
colour), and the stays and activities that have a place. Each city's area can be downloaded for
offline use. Code: `apps/web/src/features/maps`.

## Decision: Protomaps vector tiles, served from a file we host

| Option                              | Works offline            | Reachable in mainland China                 | Notes                                                                                                                                  |
| ----------------------------------- | ------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Protomaps PMTiles** (chosen)      | Yes, we store tiles      | Depends on where the file lives (we choose) | One static file, read with HTTP range requests; no tile server. OSM data, ODbL.                                                        |
| OpenFreeMap                         | Yes, same way            | Unknown; single origin, no CDN              | Free, no key, but OpenMapTiles schema and a host we don't control.                                                                     |
| Amap / Gaode                        | Forbidden by their terms | Yes                                         | GCJ-02 coordinates: our WGS84 points (Nominatim) land 100–700 m off unless converted. China only, so it breaks "destination-agnostic". |
| Google / Mapbox / most Western CDNs | Caching limited by terms | Blocked or slow                             | Rejected.                                                                                                                              |

Reasons:

- **Offline first is the real China strategy.** You download each city before you leave, at
  home. In China, downloaded cities need no network at all.
- **We pick the host.** A PMTiles archive is one file on any static host that supports range
  requests. That lets the host be one that loads in China.
- **One schema, one style.** The style comes from `@protomaps/basemaps` (light or dark, labels in
  the app language). Fonts and icons are in `apps/web/public/map`, served from our own origin
  (no `github.io`, which is often blocked in China). Chinese, Japanese and Korean labels use the
  device's fonts (`localIdeographFontFamily`), so we only ship Latin glyphs.

## How it works

- Every map request uses the `wayfare-map://` protocol (`infrastructure/offline-loader.ts`). A
  downloaded tile comes from Cache Storage (`wayfare-map-v1`) without touching the network. Other
  tiles come from the source. Fonts and icons are cached once they have been loaded.
- **Download map** (per city): a square of 10 km radius around the city, zooms 0–15. Zooms 0–9
  are one or two tiles each, so the trip overview also shows offline. About 700 tiles. The size
  estimate is shown before you download (`domain/tiles.ts`, measured on a dense city centre:
  roughly 25–35 MB per city). Caps: 2000 tiles and 80 MB. Over a cap, detail drops (lower max
  zoom) down to zoom 13, and below that the download is refused. Free storage is checked first.
- Tiles are stored gzipped. Areas are listed in Dexie `map_areas` (v6, local only, never synced).
  Removing a city keeps the tiles another downloaded city shares. Signing out deletes both.
- Offline, if the visible area doesn't overlap a downloaded city, the map says "Map not
  downloaded". The list below the map has every place, for screen readers and as a fallback.
- MapLibre (with its worker) and pmtiles are separate lazy chunks. They load the first time a
  map opens and are precached by the service worker, so the map also opens offline.

## Configuration

| Variable              | Default                                                  | Meaning                                                                                                                                      |
| --------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_MAP_TILES_URL`  | `pmtiles://https://demo-bucket.protomaps.com/v4.pmtiles` | `pmtiles://<url>` (or a `.pmtiles` URL) for an archive, or a `{z}/{x}/{y}` template. The tiles must use the Protomaps basemap **v4** schema. |
| `VITE_MAP_ASSETS_URL` | `/map`                                                   | Base URL of the fonts and sprites.                                                                                                           |

The default is **Protomaps' public demo bucket, for development only**: it has no uptime promise
and it is not meant for production.

## Owner action: host the tiles

1. Install the `pmtiles` CLI (github.com/protomaps/go-pmtiles releases).
2. Cut an extract from a daily planet build (see maps.protomaps.com/builds for the current date):
   ```sh
   pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles wayfare.pmtiles \
     --bbox=<west>,<south>,<east>,<north> --maxzoom=15
   ```
   Use one bbox that covers the regions you travel to, or the whole planet (about 120 GB, no
   extract). Example: east China, `--bbox=108,20,124,42`.
3. Upload `wayfare.pmtiles` to a host that supports HTTP range requests and CORS (`GET`, `HEAD`,
   the `Range` request header, and exposed `ETag` / `Content-Range` headers for our origin):
   - **Best for China:** an object-storage bucket in Hong Kong or Singapore (Alibaba Cloud OSS or
     Tencent COS). These load from the mainland without an ICP licence.
   - **Simple:** Cloudflare R2 with a custom domain. It works from China but is slower and can be
     unreliable there; downloaded cities are unaffected either way.
   - Vercel static works for small extracts only (deployment file-size limits).
4. In Vercel project settings, set `VITE_MAP_TILES_URL=pmtiles://https://<host>/wayfare.pmtiles`
   and redeploy.
5. Credit OpenStreetMap: the attribution control already shows "© OpenStreetMap · Protomaps".

## Not done yet

- Stays and activities have an optional `place_id` (the column was already on the server). The
  map shows them when it's set, but the stay and activity dialogs don't have a place picker yet.
- Downloads run in the open page. Leaving the page cancels the download and removes what was
  fetched.
