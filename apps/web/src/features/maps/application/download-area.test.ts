import { describe, expect, it, vi } from 'vitest';
import type { TileSource, TileStore } from '../domain/map-ports';
import { tileKey, type TileId } from '../domain/tiles';
import { downloadArea } from './download-area';

const tiles: TileId[] = Array.from({ length: 10 }, (_, i) => ({ z: 15, x: i, y: 0 }));

function fakeStore() {
  const stored = new Map<string, ArrayBuffer | null>();
  const store: TileStore = {
    put: vi.fn(async (tile, data) => {
      stored.set(tileKey(tile), data);
      return data?.byteLength ?? 0;
    }),
    remove: vi.fn(async () => {}),
    saveStyleAssets: vi.fn(async () => {}),
    availableBytes: vi.fn(async () => null),
  };
  return { store, stored };
}

describe('downloadArea', () => {
  it('stores every tile, including known-empty ones, and reports progress', async () => {
    const { store, stored } = fakeStore();
    const source: TileSource = {
      fetchTile: async (t) => (t.x === 3 ? null : new ArrayBuffer(100)),
    };
    const progress = vi.fn();
    const result = await downloadArea({ tiles, source, store, onProgress: progress });
    expect(result).toEqual({ done: 10, total: 10, bytes: 900 });
    expect(stored.size).toBe(10);
    expect(stored.get('15/3/0')).toBeNull();
    expect(progress).toHaveBeenLastCalledWith({ done: 10, total: 10, bytes: 900 });
  });

  it('retries a flaky tile before giving up', async () => {
    const { store } = fakeStore();
    let failures = 0;
    const source: TileSource = {
      fetchTile: async (t) => {
        if (t.x === 5 && failures < 2) {
          failures++;
          throw new Error('network');
        }
        return new ArrayBuffer(1);
      },
    };
    await expect(downloadArea({ tiles, source, store })).resolves.toMatchObject({ done: 10 });
  });

  it('fails as a whole when a tile keeps failing, and stops taking new tiles', async () => {
    const { store } = fakeStore();
    const source: TileSource = {
      fetchTile: vi.fn(async (t: TileId) => {
        if (t.x === 0) throw new Error('offline');
        return new ArrayBuffer(1);
      }),
    };
    await expect(downloadArea({ tiles, source, store, concurrency: 1 })).rejects.toThrow('offline');
    expect(store.put).not.toHaveBeenCalled();
  });

  it('stops when cancelled', async () => {
    const { store } = fakeStore();
    const controller = new AbortController();
    const source: TileSource = {
      fetchTile: async () => {
        controller.abort();
        return new ArrayBuffer(1);
      },
    };
    await expect(
      downloadArea({ tiles, source, store, signal: controller.signal }),
    ).rejects.toThrow();
    expect(store.put).not.toHaveBeenCalled();
  });
});
