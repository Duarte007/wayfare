import type { PlaceSearchRequest, PlaceSuggestion } from '@wayfare/shared';
import type { PlaceSearch } from '../../application/ports.js';

/** Remembers recent answers per function instance; place names change rarely. */
export class CachedPlaceSearch implements PlaceSearch {
  private readonly entries = new Map<string, { at: number; value: PlaceSuggestion[] }>();

  constructor(
    private readonly inner: PlaceSearch,
    private readonly ttlMs = 24 * 3600_000,
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  async search(request: PlaceSearchRequest): Promise<PlaceSuggestion[]> {
    const key = `${request.locale}|${request.q.toLowerCase()}`;
    const hit = this.entries.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value;
    const value = await this.inner.search(request);
    if (this.entries.size >= this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value!);
    }
    this.entries.set(key, { at: this.now(), value });
    return value;
  }
}
