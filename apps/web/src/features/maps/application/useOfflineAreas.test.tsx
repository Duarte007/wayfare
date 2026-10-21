import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MapPlace } from '../domain/map-places';
import type {
  OfflineArea,
  OfflineAreaRepository,
  TileSource,
  TileStore,
} from '../domain/map-ports';
import { planArea, tileKey, type TileId } from '../domain/tiles';
import { MapsProvider } from './MapsProvider';
import { useOfflineAreas } from './useOfflineAreas';

const city = (placeId: string, lng: number, lat: number): MapPlace => ({
  id: `stop-${placeId}`,
  kind: 'city',
  placeId,
  title: placeId,
  cityNumber: 1,
  cityName: placeId,
  colorIndex: 0,
  stopId: `stop-${placeId}`,
  lng,
  lat,
});
const beijing = city('beijing', 116.4074, 39.9042);
const nearby = city('nearby', 116.5, 39.95);

function setup({
  source = { fetchTile: async () => new ArrayBuffer(10) },
  available = null,
}: { source?: TileSource; available?: number | null } = {}) {
  let areas: OfflineArea[] = [];
  const listeners = new Set<(a: OfflineArea[]) => void>();
  const emit = () => listeners.forEach((l) => l([...areas]));
  const repository: OfflineAreaRepository = {
    observeAll: (listener) => {
      listeners.add(listener);
      listener([...areas]);
      return () => listeners.delete(listener);
    },
    save: vi.fn(async (area) => {
      areas = [...areas.filter((a) => a.placeId !== area.placeId), area];
      emit();
    }),
    remove: vi.fn(async (placeId) => {
      areas = areas.filter((a) => a.placeId !== placeId);
      emit();
    }),
  };
  const stored = new Set<string>();
  const tiles: TileStore = {
    put: vi.fn(async (tile, data) => {
      stored.add(tileKey(tile));
      return data?.byteLength ?? 0;
    }),
    remove: vi.fn(async (list: readonly TileId[]) =>
      list.forEach((t) => stored.delete(tileKey(t))),
    ),
    saveStyleAssets: vi.fn(async () => {}),
    availableBytes: vi.fn(async () => available),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MapsProvider
      areas={repository}
      tiles={tiles}
      source={source}
      loadRenderer={() => Promise.reject(new Error('not in tests'))}
    >
      {children}
    </MapsProvider>
  );
  const hook = renderHook(() => useOfflineAreas('trip-1'), { wrapper });
  return { hook, repository, tiles, stored };
}

describe('useOfflineAreas', () => {
  it('downloads a city with its fonts and saves it as an area', async () => {
    const { hook, tiles, stored } = setup();
    await waitFor(() => expect(hook.result.current.areas).toEqual([]));
    const plan = planArea(beijing);
    await act(() => hook.result.current.download(beijing));
    expect(tiles.saveStyleAssets).toHaveBeenCalled();
    expect(stored.size).toBe(plan.tiles.length);
    expect(hook.result.current.areas).toEqual([
      expect.objectContaining({
        placeId: 'beijing',
        tripId: 'trip-1',
        tileCount: plan.tiles.length,
        bytes: plan.tiles.length * 10,
        maxZoom: plan.maxZoom,
      }),
    ]);
    expect(hook.result.current.active).toBeNull();
  });

  it('refuses when the device has no room, before fetching anything', async () => {
    const { hook, tiles } = setup({ available: 1024 });
    await act(() => hook.result.current.download(beijing));
    expect(hook.result.current.error).toEqual({ placeId: 'beijing', kind: 'no_space' });
    expect(tiles.put).not.toHaveBeenCalled();
  });

  it('cleans up after a failed download and says so', async () => {
    let calls = 0;
    const source: TileSource = {
      fetchTile: async () => {
        if (++calls > 50) throw new Error('offline');
        return new ArrayBuffer(1);
      },
    };
    const { hook, stored } = setup({ source });
    await act(() => hook.result.current.download(beijing));
    expect(hook.result.current.error).toEqual({ placeId: 'beijing', kind: 'failed' });
    expect(hook.result.current.areas).toEqual([]);
    expect(stored.size).toBe(0);
  });

  it('removing a city keeps the tiles a neighbouring download shares', async () => {
    const { hook, stored } = setup();
    await act(() => hook.result.current.download(beijing));
    await act(() => hook.result.current.download(nearby));
    await act(() => hook.result.current.remove('beijing'));
    expect(hook.result.current.areas?.map((a) => a.placeId)).toEqual(['nearby']);
    expect([...stored].sort()).toEqual(planArea(nearby).tiles.map(tileKey).sort());
  });
});
