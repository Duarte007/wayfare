import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapPlace } from '../domain/map-places';
import type { OfflineArea } from '../domain/map-ports';
import { planArea, tilesOnlyIn, type AreaPlan } from '../domain/tiles';
import { downloadArea, type DownloadProgress } from './download-area';
import { useMapsDependencies } from './MapsProvider';

export type DownloadError = 'too_large' | 'no_space' | 'failed';

export interface ActiveDownload {
  placeId: string;
  progress: DownloadProgress;
}

export interface OfflineAreas {
  /** Undefined while reading the device. */
  areas: OfflineArea[] | undefined;
  active: ActiveDownload | null;
  error: { placeId: string; kind: DownloadError } | null;
  planFor: (city: MapPlace) => AreaPlan;
  download: (city: MapPlace) => Promise<void>;
  cancel: () => void;
  remove: (placeId: string) => Promise<void>;
}

/** Download, list and remove the cities' offline maps (one download at a time). */
export function useOfflineAreas(tripId: string): OfflineAreas {
  const { areas: repository, tiles, source } = useMapsDependencies();
  const [areas, setAreas] = useState<OfflineArea[] | undefined>();
  const [active, setActive] = useState<ActiveDownload | null>(null);
  const [error, setError] = useState<OfflineAreas['error']>(null);
  const areasRef = useRef<OfflineArea[]>([]);
  const running = useRef<AbortController | null>(null);

  useEffect(
    () =>
      repository.observeAll((list) => {
        areasRef.current = list;
        setAreas(list);
      }),
    [repository],
  );
  // Leaving the page stops a download; what was fetched is cleaned up.
  useEffect(() => () => running.current?.abort(), []);

  const planFor = useCallback((city: MapPlace) => planArea(city), []);

  const download = useCallback(
    async (city: MapPlace) => {
      // One at a time; an area already on the device is removed first, never re-fetched over.
      if (running.current || areasRef.current.some((a) => a.placeId === city.placeId)) return;
      setError(null);
      const plan = planArea(city);
      if (plan.tooLarge) {
        setError({ placeId: city.placeId, kind: 'too_large' });
        return;
      }
      const available = await tiles.availableBytes();
      if (available !== null && available < plan.estimatedBytes * 1.2) {
        setError({ placeId: city.placeId, kind: 'no_space' });
        return;
      }
      const controller = new AbortController();
      running.current = controller;
      setActive({
        placeId: city.placeId,
        progress: { done: 0, total: plan.tiles.length, bytes: 0 },
      });
      try {
        await tiles.saveStyleAssets();
        const result = await downloadArea({
          tiles: plan.tiles,
          source,
          store: tiles,
          signal: controller.signal,
          onProgress: (progress) => setActive({ placeId: city.placeId, progress }),
        });
        await repository.save({
          placeId: city.placeId,
          tripId,
          name: city.title,
          bbox: plan.bbox,
          minZoom: plan.minZoom,
          maxZoom: plan.maxZoom,
          tileCount: result.total,
          bytes: result.bytes,
          downloadedAt: new Date().toISOString(),
        });
      } catch {
        // Keep the device tidy: drop what this attempt stored unless another area uses it.
        const others = areasRef.current.filter((a) => a.placeId !== city.placeId);
        await tiles.remove(tilesOnlyIn(plan, others)).catch(() => undefined);
        if (!controller.signal.aborted) setError({ placeId: city.placeId, kind: 'failed' });
      } finally {
        running.current = null;
        setActive(null);
      }
    },
    [repository, source, tiles, tripId],
  );

  const cancel = useCallback(() => running.current?.abort(), []);

  const remove = useCallback(
    async (placeId: string) => {
      const area = areasRef.current.find((a) => a.placeId === placeId);
      if (!area) return;
      const others = areasRef.current.filter((a) => a.placeId !== placeId);
      await tiles.remove(tilesOnlyIn(area, others));
      await repository.remove(placeId);
    },
    [repository, tiles],
  );

  return { areas, active, error, planFor, download, cancel, remove };
}
