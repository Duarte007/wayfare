import type { TileSource } from '../domain/map-ports';
import type { TileId } from '../domain/tiles';
import { glyphPath } from './map-assets';

/** The map style's URLs use this scheme so every request goes through the device first. */
export const MAP_PROTOCOL = 'wayfare-map';

export const STYLE_URLS = {
  tiles: `${MAP_PROTOCOL}://tiles/{z}/{x}/{y}`,
  glyphs: `${MAP_PROTOCOL}://glyphs/{fontstack}/{range}`,
  sprite: (name: string) => `${MAP_PROTOCOL}://sprite/${name}`,
};

export interface OfflineLoaderDeps {
  readTile(tile: TileId): Promise<ArrayBuffer | undefined>;
  fetchTile: TileSource['fetchTile'];
  readAsset(path: string, signal?: AbortSignal): Promise<ArrayBuffer>;
}

const EMPTY = () => new ArrayBuffer(0);

/**
 * Resolves a `wayfare-map://` request: downloaded tiles from the device (no network at all),
 * other tiles from the source, fonts and icons from our origin (kept once seen).
 */
export function createOfflineLoader(deps: OfflineLoaderDeps) {
  return async (url: string, signal?: AbortSignal): Promise<ArrayBuffer> => {
    const [kind, ...rest] = url.slice(`${MAP_PROTOCOL}://`.length).split('/');
    if (kind === 'tiles') {
      const [z, x, y] = rest.map(Number);
      const tile = { z: z!, x: x!, y: y! };
      const stored = await deps.readTile(tile);
      if (stored) return stored;
      return (await deps.fetchTile(tile, signal)) ?? EMPTY();
    }
    if (kind === 'glyphs') {
      const [fontstack = '', range = ''] = rest.map(decodeURIComponent);
      const path = glyphPath(fontstack, range.replace(/\.pbf$/, ''));
      return path ? deps.readAsset(path, signal) : EMPTY();
    }
    if (kind === 'sprite') {
      // MapLibre asks for `<sprite>[@2x].json` and `.png`.
      return deps.readAsset(`sprites/${rest.join('/')}`, signal);
    }
    throw new Error(`Unknown map resource: ${url}`);
  };
}
