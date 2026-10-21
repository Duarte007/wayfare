import type { TileSource, TileStore } from '../domain/map-ports';
import type { TileId } from '../domain/tiles';

export interface DownloadProgress {
  done: number;
  total: number;
  bytes: number;
}

export interface DownloadAreaInput {
  tiles: readonly TileId[];
  source: TileSource;
  store: TileStore;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  /** Parallel requests; browsers allow about six per host. */
  concurrency?: number;
  /** Extra tries per tile before the whole download fails. */
  retries?: number;
}

/**
 * Fetches every tile of an area and stores it on the device. Fails as a whole on the first tile
 * that can't be fetched after retrying (the caller cleans up), so a "downloaded" area is complete.
 */
export async function downloadArea({
  tiles,
  source,
  store,
  onProgress,
  signal,
  concurrency = 6,
  retries = 2,
}: DownloadAreaInput): Promise<DownloadProgress> {
  const progress: DownloadProgress = { done: 0, total: tiles.length, bytes: 0 };
  let next = 0;

  const fetchWithRetry = async (tile: TileId) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await source.fetchTile(tile, signal);
      } catch (error) {
        if (signal?.aborted || attempt >= retries) throw error;
      }
    }
  };

  // Once one tile fails for good, the other workers stop taking new tiles.
  let failed = false;
  const worker = async () => {
    try {
      while (!failed && next < tiles.length) {
        signal?.throwIfAborted();
        const tile = tiles[next++]!;
        const data = await fetchWithRetry(tile);
        signal?.throwIfAborted();
        // Await first: `bytes += await` would read the total before other workers add to it.
        const stored = await store.put(tile, data);
        progress.bytes += stored;
        progress.done += 1;
        onProgress?.({ ...progress });
      }
    } catch (error) {
      failed = true;
      throw error;
    }
  };

  onProgress?.({ ...progress });
  // Wait for every worker to stop before failing, so cleanup never races a late write.
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, tiles.length) }, worker),
  );
  const failure = results.find((r) => r.status === 'rejected');
  if (failure) throw failure.reason;
  return progress;
}
