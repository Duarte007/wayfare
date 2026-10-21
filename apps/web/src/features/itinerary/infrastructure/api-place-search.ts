import { placeSearchResponseSchema } from '@wayfare/shared';
import type { PlaceSearchClient, PlaceSearchResult } from '../domain/itinerary-ports';

/** Calls our API (never a third-party host), so search works wherever the app does. */
export class ApiPlaceSearch implements PlaceSearchClient {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: () => Promise<string | null>,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async search(query: string, locale: string, signal?: AbortSignal): Promise<PlaceSearchResult> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { status: 'offline' };
    const token = await this.accessToken();
    if (!token) return { status: 'error' };
    const url = `${this.baseUrl}/geo/search?${new URLSearchParams({ q: query, locale })}`;
    try {
      const res = await this.fetchFn(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) return { status: 'error' };
      return { status: 'ok', places: placeSearchResponseSchema.parse(await res.json()).places };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      return { status: navigator.onLine ? 'error' : 'offline' };
    }
  }
}
