import type { TileStore } from '../domain/map-ports';
import { tileKey, type TileId } from '../domain/tiles';
import { mapAssetPaths } from './map-assets';

/** Cache Storage name; the service worker's precache (workbox-*) lives in its own caches. */
export const MAP_CACHE = 'wayfare-map-v1';
// Cache Storage needs http(s) keys; this host never resolves, so nothing is ever fetched from it.
const KEY_BASE = 'https://offline-map.wayfare.invalid';
const tileUrl = (tile: TileId) => `${KEY_BASE}/tiles/${tileKey(tile)}`;
const assetUrl = (path: string) => `${KEY_BASE}/assets/${encodeURI(path)}`;

async function gzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

async function gunzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/**
 * Downloaded tiles and style assets in Cache Storage. Tiles are kept gzipped (about half the
 * space of decoded vector tiles); a zero-length entry means "the source has no tile here".
 */
export class CacheTileStore implements TileStore {
  constructor(
    /** Where the style's fonts and icons are served, e.g. `/map`. */
    private readonly assetsBase: string,
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}

  private open() {
    return caches.open(MAP_CACHE);
  }

  async put(tile: TileId, data: ArrayBuffer | null): Promise<number> {
    const body = data && data.byteLength > 0 ? await gzip(data) : new ArrayBuffer(0);
    const cache = await this.open();
    await cache.put(tileUrl(tile), new Response(body));
    return body.byteLength;
  }

  /** The decoded tile, an empty buffer for a known-empty tile, or undefined when not stored. */
  async readTile(tile: TileId): Promise<ArrayBuffer | undefined> {
    if (typeof caches === 'undefined') return undefined;
    const cache = await this.open();
    const hit = await cache.match(tileUrl(tile));
    if (!hit) return undefined;
    const body = await hit.arrayBuffer();
    return body.byteLength > 0 ? gunzip(body) : body;
  }

  async remove(tiles: readonly TileId[]): Promise<void> {
    const cache = await this.open();
    await Promise.all(tiles.map((t) => cache.delete(tileUrl(t))));
  }

  /** An asset from the device, else from the network (and then kept for offline use). */
  async readAsset(path: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const cache = typeof caches === 'undefined' ? null : await this.open();
    const hit = await cache?.match(assetUrl(path));
    if (hit) return hit.arrayBuffer();
    const response = await this.fetcher(`${this.assetsBase}/${encodeURI(path)}`, { signal });
    if (!response.ok) throw new Error(`Map asset ${path}: ${response.status}`);
    const body = await response.arrayBuffer();
    await cache?.put(assetUrl(path), new Response(body.slice(0)));
    return body;
  }

  async saveStyleAssets(): Promise<void> {
    await Promise.all(mapAssetPaths().map((path) => this.readAsset(path)));
  }

  async availableBytes(): Promise<number | null> {
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (!estimate?.quota) return null;
      return estimate.quota - (estimate.usage ?? 0);
    } catch {
      return null;
    }
  }

  /** Signing out wipes the device: maps go too (they reveal where the trips go). */
  async clear(): Promise<void> {
    if (typeof caches !== 'undefined') await caches.delete(MAP_CACHE);
  }
}
