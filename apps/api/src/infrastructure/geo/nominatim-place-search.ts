import type { PlaceSearchRequest, PlaceSuggestion } from '@wayfare/shared';
import { PlaceSearchUnavailableError } from '../../application/errors.js';
import type { PlaceSearch } from '../../application/ports.js';

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  namedetails?: Record<string, string>;
  address?: { country?: string; country_code?: string; state?: string; region?: string };
}

/**
 * OpenStreetMap's Nominatim, called from our server so phones only ever talk to our API (it
 * keeps working where third-party hosts are blocked). Usage policy: identify the app and keep
 * traffic low; the client debounces and `CachedPlaceSearch` absorbs repeats.
 */
export class NominatimPlaceSearch implements PlaceSearch {
  constructor(
    private readonly userAgent: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly baseUrl = 'https://nominatim.openstreetmap.org',
  ) {}

  async search({ q, locale }: PlaceSearchRequest): Promise<PlaceSuggestion[]> {
    const url = new URL('/search', this.baseUrl);
    url.search = new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '1',
      namedetails: '1',
      featureType: 'settlement',
      limit: '8',
      'accept-language': locale,
    }).toString();
    const res = await this.fetchFn(url, { headers: { 'User-Agent': this.userAgent } });
    if (!res.ok) throw new PlaceSearchUnavailableError(`Place search failed (${res.status})`);
    const results = (await res.json()) as NominatimResult[];
    return dedupe(results.flatMap((r) => toSuggestion(r, locale)));
  }
}

function toSuggestion(r: NominatimResult, locale: string): PlaceSuggestion[] {
  const code = r.address?.country_code;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!code || code.length !== 2 || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const local = r.namedetails?.name ?? r.name ?? '';
  const language = locale.split('-')[0]!;
  const name =
    r.namedetails?.[`name:${locale}`] ??
    r.namedetails?.[`name:${language}`] ??
    r.name ??
    r.namedetails?.['name:en'] ??
    local;
  if (!name) return [];
  return [
    {
      name,
      name_local: local && local !== name ? local : null,
      country_code: code.toUpperCase(),
      country: r.address?.country ?? null,
      region: r.address?.state ?? r.address?.region ?? null,
      lat,
      lng,
    },
  ];
}

/** OSM often has a city twice (city and its administrative area); keep the first. */
function dedupe(list: PlaceSuggestion[]): PlaceSuggestion[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    const key = `${p.name}|${p.region ?? ''}|${p.country_code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
