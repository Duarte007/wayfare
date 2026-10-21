import { CITY_TIPS_PROMPT_VERSION, type CityTips, type CityTipsRequest } from '@wayfare/shared';
import { createHash } from 'node:crypto';
import { NotFoundError, QuotaExceededError } from './errors.js';
import type {
  AiQuota,
  BuyLinkBuilder,
  CityTipsWithLinks,
  TipsCache,
  TipsGenerator,
  TripAccess,
} from './ports.js';

const CACHE_DAYS = 30;

export interface GetCityTipsResult {
  cached: boolean;
  tips: CityTipsWithLinks;
}

interface Dependencies {
  access: TripAccess;
  generator: TipsGenerator;
  cache: TipsCache;
  quota: AiQuota;
  links: BuyLinkBuilder;
  /** Part of the cache key, so changing the primary model regenerates answers. */
  modelKey: string;
  now?: () => Date;
}

/**
 * Use case: tips for one stop of a trip the user can see. Reuses a recent identical answer, otherwise spends one
 * unit of the user's daily quota, generates, attaches shopping links and stores the result.
 */
export class GetCityTips {
  constructor(private readonly deps: Dependencies) {}

  async execute(request: CityTipsRequest): Promise<GetCityTipsResult> {
    const { access, generator, cache, quota, links, now = () => new Date() } = this.deps;
    // Checked before anything is spent: outsiders must not burn AI calls on someone else's trip.
    if (!(await access.canSeeStop(request.tripId, request.stopId))) throw new NotFoundError();

    const inputHash = this.inputHash(request);
    const since = new Date(now().getTime() - CACHE_DAYS * 86_400_000);

    const stored = await cache.find(request.stopId, inputHash, since);
    if (stored) return { cached: true, tips: stored.tips };

    if (!(await quota.consume())) throw new QuotaExceededError();

    const { tips, model } = await generator.generate(request);
    const withLinks = attachLinks(tips, (query) => links.build(request.country, query));
    await cache.save({
      tripId: request.tripId,
      stopId: request.stopId,
      locale: request.locale,
      inputHash,
      model,
      tips: withLinks,
    });
    return { cached: false, tips: withLinks };
  }

  private inputHash(r: CityTipsRequest): string {
    const key = [
      'city-tips',
      CITY_TIPS_PROMPT_VERSION,
      this.deps.modelKey,
      r.city,
      r.country,
      r.startDate,
      r.endDate,
      [...r.interests].sort(),
      r.pace,
      r.locale,
    ];
    return createHash('sha256').update(JSON.stringify(key)).digest('hex');
  }
}

/** Shopping links come from our templates, never from the model, so they cannot be invented. */
function attachLinks(tips: CityTips, link: (query: string) => string): CityTipsWithLinks {
  const add = (list: CityTips['events']) =>
    list.map((t) => ({ ...t, buy_url: link(t.search_query) }));
  return {
    events: add(tips.events),
    tours_day_trips: add(tips.tours_day_trips),
    food: add(tips.food),
    shopping: add(tips.shopping),
  };
}
