import { describe, expect, it, vi } from 'vitest';
import { CachedPlaceSearch } from './cached-place-search';
import { NominatimPlaceSearch } from './nominatim-place-search';

const chengdu = {
  lat: '30.6598628',
  lon: '104.0633717',
  name: 'Chengdu',
  namedetails: { name: '成都市', 'name:en': 'Chengdu', 'name:pt': 'Chengdu', 'name:ja': '成都市' },
  address: { country: 'China', country_code: 'cn', state: 'Sichuan' },
};

describe('NominatimPlaceSearch', () => {
  it('asks for settlements in the user language and maps names, country and coordinates', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json([chengdu, chengdu]));
    const result = await new NominatimPlaceSearch('Wayfare/test', fetchMock).search({
      q: 'chengdu',
      locale: 'pt-BR',
    });
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.searchParams.get('featureType')).toBe('settlement');
    expect(url.searchParams.get('accept-language')).toBe('pt-BR');
    expect(result).toEqual([
      {
        name: 'Chengdu',
        name_local: '成都市',
        country_code: 'CN',
        country: 'China',
        region: 'Sichuan',
        lat: 30.6598628,
        lng: 104.0633717,
      },
    ]);
  });

  it('drops the local name when it is the same as the shown one', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json([chengdu]));
    const [place] = await new NominatimPlaceSearch('Wayfare/test', fetchMock).search({
      q: 'chengdu',
      locale: 'ja',
    });
    expect(place?.name).toBe('成都市');
    expect(place?.name_local).toBeNull();
  });

  it('skips results without a country or valid coordinates', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json([
        { lat: 'x', lon: '1', name: 'Nowhere', address: { country_code: 'zz' } },
        { lat: '1', lon: '2', name: 'Sea' },
      ]),
    );
    expect(
      await new NominatimPlaceSearch('Wayfare/test', fetchMock).search({ q: 'no', locale: 'en' }),
    ).toEqual([]);
  });
});

describe('CachedPlaceSearch', () => {
  it('answers repeats from memory until the entry expires', async () => {
    let now = 0;
    const inner = { search: vi.fn(async () => []) };
    const cached = new CachedPlaceSearch(inner, 1000, 10, () => now);
    await cached.search({ q: 'Lisboa', locale: 'pt-BR' });
    await cached.search({ q: 'lisboa', locale: 'pt-BR' });
    expect(inner.search).toHaveBeenCalledTimes(1);
    now = 2000;
    await cached.search({ q: 'lisboa', locale: 'pt-BR' });
    expect(inner.search).toHaveBeenCalledTimes(2);
  });
});
