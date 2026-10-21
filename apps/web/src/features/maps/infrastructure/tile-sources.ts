import type { TileSource } from '../domain/map-ports';
import type { TileId } from '../domain/tiles';

/**
 * A Protomaps PMTiles archive read with HTTP range requests: one static file on any CDN or
 * bucket (our own origin, R2, a Hong Kong bucket...). The `pmtiles` library loads on first use.
 */
export class PmtilesTileSource implements TileSource {
  private archive: Promise<import('pmtiles').PMTiles> | null = null;

  constructor(private readonly url: string) {}

  private open() {
    this.archive ??= import('pmtiles').then(({ PMTiles }) => new PMTiles(this.url));
    // A failed first read (offline) must not stick: try again next time.
    this.archive.catch(() => (this.archive = null));
    return this.archive;
  }

  async fetchTile(tile: TileId, signal?: AbortSignal): Promise<ArrayBuffer | null> {
    const archive = await this.open();
    const result = await archive.getZxy(tile.z, tile.x, tile.y, signal);
    return result?.data ?? null;
  }
}

/** A `{z}/{x}/{y}` URL template serving Protomaps-schema vector tiles (e.g. a tile API). */
export class XyzTileSource implements TileSource {
  constructor(
    private readonly template: string,
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}

  async fetchTile(tile: TileId, signal?: AbortSignal): Promise<ArrayBuffer | null> {
    const url = this.template
      .replace('{z}', String(tile.z))
      .replace('{x}', String(tile.x))
      .replace('{y}', String(tile.y));
    const response = await this.fetcher(url, { signal });
    if (response.status === 204 || response.status === 404) return null;
    if (!response.ok) throw new Error(`Tile ${url}: ${response.status}`);
    return response.arrayBuffer();
  }
}

/** `pmtiles://<url>` (or a `.pmtiles` URL) is an archive; anything else is a z/x/y template. */
export function createTileSource(config: string): TileSource {
  const pmtiles = config.startsWith('pmtiles://')
    ? config.slice('pmtiles://'.length)
    : /\.pmtiles(\?|$)/.test(config)
      ? config
      : null;
  return pmtiles ? new PmtilesTileSource(pmtiles) : new XyzTileSource(config);
}
