import type { CityTips, CityTipsRequest } from '@wayfare/shared';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, QuotaExceededError } from './errors.js';
import { GetCityTips } from './get-city-tips.js';
import type { TipsCache } from './ports.js';

const tip = {
  title: 'Forbidden City',
  title_local: '故宫',
  reason: 'Imperial palace',
  area: 'Dongcheng',
  duration: '3 h',
  price_range: '60 CNY',
  needs_booking: true,
  booking_hint: 'Closed on Mondays',
  search_query: 'Forbidden City tickets',
  source_url: null,
};
const tips: CityTips = { events: [], tours_day_trips: [tip], food: [], shopping: [] };

const request: CityTipsRequest = {
  tripId: crypto.randomUUID(),
  stopId: crypto.randomUUID(),
  city: 'Beijing',
  country: 'CN',
  startDate: '2026-10-23',
  endDate: '2026-10-28',
  alreadyPlanned: [],
  otherCities: [],
  interests: ['history'],
  pace: 'balanced',
  party: 4,
  locale: 'pt-BR',
};

function setup({
  quotaOk = true,
  canSee = true,
  cached = null as Awaited<ReturnType<TipsCache['find']>>,
} = {}) {
  const deps = {
    access: { canSeeStop: vi.fn(async (_tripId: string, _stopId: string) => canSee) },
    generator: { generate: vi.fn(async () => ({ tips, model: 'claude-opus-5-5' })) },
    cache: {
      find: vi.fn(async (_stopId: string, _inputHash: string, _since: Date) => cached),
      save: vi.fn(async () => {}),
    },
    quota: { consume: vi.fn(async () => quotaOk) },
    links: { build: vi.fn((country: string, q: string) => `https://shop/${country}/${q}`) },
    modelKey: 'claude-opus-5-5',
  };
  return { deps, useCase: new GetCityTips(deps) };
}

describe('GetCityTips', () => {
  it('generates, attaches our own buy links and caches the result', async () => {
    const { deps, useCase } = setup();
    const result = await useCase.execute(request);
    expect(result.cached).toBe(false);
    expect(result.tips.tours_day_trips[0]?.buy_url).toBe('https://shop/CN/Forbidden City tickets');
    expect(deps.cache.save).toHaveBeenCalledOnce();
  });

  it('returns the cached answer without spending quota', async () => {
    const stored = { tips: { events: [], tours_day_trips: [], food: [], shopping: [] } };
    const { deps, useCase } = setup({ cached: stored });
    expect(await useCase.execute(request)).toEqual({ cached: true, tips: stored.tips });
    expect(deps.quota.consume).not.toHaveBeenCalled();
    expect(deps.generator.generate).not.toHaveBeenCalled();
  });

  it('refuses when the daily quota is used up', async () => {
    const { deps, useCase } = setup({ quotaOk: false });
    await expect(useCase.execute(request)).rejects.toBeInstanceOf(QuotaExceededError);
    expect(deps.generator.generate).not.toHaveBeenCalled();
  });

  it("refuses a stop the user can't see before reading the cache or spending quota", async () => {
    const { deps, useCase } = setup({ canSee: false });
    await expect(useCase.execute(request)).rejects.toBeInstanceOf(NotFoundError);
    expect(deps.access.canSeeStop).toHaveBeenCalledWith(request.tripId, request.stopId);
    expect(deps.cache.find).not.toHaveBeenCalled();
    expect(deps.quota.consume).not.toHaveBeenCalled();
    expect(deps.generator.generate).not.toHaveBeenCalled();
  });

  it('uses the same cache key regardless of interest order', async () => {
    const { deps, useCase } = setup();
    await useCase.execute({ ...request, interests: ['food', 'history'] });
    await useCase.execute({ ...request, interests: ['history', 'food'] });
    const [first, second] = deps.cache.find.mock.calls;
    expect(first?.[1]).toBe(second?.[1]);
  });
});
