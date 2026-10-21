import { describe, expect, it, vi } from 'vitest';
import { glyphPath, mapAssetPaths } from './map-assets';
import { readMapConfig, DEMO_TILES_URL } from './map-config';
import { createOfflineLoader } from './offline-loader';
import { createTileSource, PmtilesTileSource, XyzTileSource } from './tile-sources';

const bytes = (n: number) => new Uint8Array(n).buffer;

function setup(stored?: ArrayBuffer) {
  const deps = {
    readTile: vi.fn(async () => stored),
    fetchTile: vi.fn(async () => bytes(7)),
    readAsset: vi.fn(async () => bytes(3)),
  };
  return { deps, load: createOfflineLoader(deps) };
}

describe('offline loader', () => {
  it('serves a downloaded tile from the device without touching the network', async () => {
    const { deps, load } = setup(bytes(5));
    expect((await load('wayfare-map://tiles/15/26979/12416')).byteLength).toBe(5);
    expect(deps.readTile).toHaveBeenCalledWith({ z: 15, x: 26979, y: 12416 });
    expect(deps.fetchTile).not.toHaveBeenCalled();
  });

  it('fetches other tiles from the source, and answers "no tile there" with an empty one', async () => {
    const { deps, load } = setup();
    expect((await load('wayfare-map://tiles/3/1/2')).byteLength).toBe(7);
    deps.fetchTile.mockResolvedValueOnce(null as never);
    expect((await load('wayfare-map://tiles/3/1/3')).byteLength).toBe(0);
  });

  it('lets a missing tile fail while offline, so the page can say it is not downloaded', async () => {
    const { deps, load } = setup();
    deps.fetchTile.mockRejectedValueOnce(new Error('offline'));
    await expect(load('wayfare-map://tiles/3/1/2')).rejects.toThrow('offline');
  });

  it('maps glyph and sprite requests to our own files', async () => {
    const { deps, load } = setup();
    await load('wayfare-map://glyphs/Noto%20Sans%20Regular/0-255');
    expect(deps.readAsset).toHaveBeenLastCalledWith('fonts/Noto Sans Regular/0-255.pbf', undefined);
    await load('wayfare-map://sprite/light@2x.json');
    expect(deps.readAsset).toHaveBeenLastCalledWith('sprites/light@2x.json', undefined);
  });

  it('answers scripts the device draws itself with an empty glyph set', async () => {
    const { deps, load } = setup();
    expect((await load('wayfare-map://glyphs/Noto%20Sans%20Regular/19968-20223')).byteLength).toBe(
      0,
    );
    expect(deps.readAsset).not.toHaveBeenCalled();
  });
});

describe('map assets', () => {
  it('picks the first shipped font of a stack', () => {
    expect(glyphPath('Unknown Font,Noto Sans Medium', '256-511')).toBe(
      'fonts/Noto Sans Medium/256-511.pbf',
    );
    expect(glyphPath('Noto Sans Devanagari Regular v1', '0-255')).toBeNull();
  });

  it('lists every file the style can ask for', () => {
    const paths = mapAssetPaths();
    expect(paths).toContain('fonts/Noto Sans Italic/8192-8447.pbf');
    expect(paths).toContain('sprites/dark@2x.png');
    expect(paths).toHaveLength(9 + 8);
  });
});

describe('tile sources', () => {
  it('reads PMTiles archives and z/x/y templates', () => {
    expect(createTileSource('pmtiles://https://tiles.example.org/trip.pmtiles')).toBeInstanceOf(
      PmtilesTileSource,
    );
    expect(createTileSource('/tiles/region.pmtiles')).toBeInstanceOf(PmtilesTileSource);
    expect(createTileSource('https://tiles.example.org/{z}/{x}/{y}.mvt')).toBeInstanceOf(
      XyzTileSource,
    );
  });

  it('fills the template, and treats 404 as "no tile there"', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes('/9/') ? new Response(null, { status: 404 }) : new Response(bytes(4)),
    );
    const source = new XyzTileSource(
      'https://t.example.org/{z}/{x}/{y}.mvt?key=k',
      fetcher as unknown as typeof fetch,
    );
    expect((await source.fetchTile({ z: 3, x: 1, y: 2 }))?.byteLength).toBe(4);
    expect(fetcher).toHaveBeenCalledWith('https://t.example.org/3/1/2.mvt?key=k', {
      signal: undefined,
    });
    expect(await source.fetchTile({ z: 9, x: 1, y: 2 })).toBeNull();
  });

  it('falls back to the demo archive only when nothing is configured', () => {
    expect(readMapConfig({})).toEqual({
      tilesUrl: DEMO_TILES_URL,
      assetsUrl: '/map',
      usingDemoTiles: true,
    });
    expect(
      readMapConfig({ VITE_MAP_TILES_URL: 'pmtiles:///t.pmtiles', VITE_MAP_ASSETS_URL: '/a/' }),
    ).toEqual({ tilesUrl: 'pmtiles:///t.pmtiles', assetsUrl: '/a', usingDemoTiles: false });
  });
});
