import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { GetCityTips } from './application/get-city-tips.js';
import { SearchPlaces } from './application/search-places.js';
import type { TipsGenerator } from './application/ports.js';
import { env } from './config/env.js';
import { ClaudeTipsGenerator } from './infrastructure/ai/claude-tips-generator.js';
import { FallbackTipsGenerator } from './infrastructure/ai/fallback-tips-generator.js';
import { CachedPlaceSearch } from './infrastructure/geo/cached-place-search.js';
import { NominatimPlaceSearch } from './infrastructure/geo/nominatim-place-search.js';
import { QwenTipsGenerator } from './infrastructure/ai/qwen-tips-generator.js';
import { TemplateBuyLinks } from './infrastructure/ai/template-buy-links.js';
import { SupabaseAiQuota } from './infrastructure/supabase/supabase-ai-quota.js';
import { SupabaseTipsCache } from './infrastructure/supabase/supabase-tips-cache.js';
import { SupabaseTripAccess } from './infrastructure/supabase/supabase-trip-access.js';
import { authenticate } from './infrastructure/supabase/user-client.js';
import type { AppDependencies } from './interface/http/app.js';

/** Composition root: the only place that knows which concrete adapters back each port. */

let tipsGenerator: TipsGenerator | undefined;

// One cache per warm function instance.
const placeSearch = new SearchPlaces(
  new CachedPlaceSearch(
    new NominatimPlaceSearch('Wayfare/1.0 (https://github.com/Duarte007/wayfare)'),
  ),
);

function buildTipsGenerator(): TipsGenerator {
  const config = env();
  const generators: TipsGenerator[] = [];
  if (config.ANTHROPIC_API_KEY) {
    generators.push(
      new ClaudeTipsGenerator(new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }), config.AI_MODEL),
    );
  }
  if (config.QWEN_API_KEY) {
    const qwen = new OpenAI({ apiKey: config.QWEN_API_KEY, baseURL: config.QWEN_BASE_URL });
    generators.push(new QwenTipsGenerator(qwen, config.QWEN_MODEL));
  }
  if (generators.length === 0) throw new Error('Configure ANTHROPIC_API_KEY and/or QWEN_API_KEY');
  return new FallbackTipsGenerator(generators, (error) =>
    console.warn('AI provider failed, trying the next one', error),
  );
}

export const dependencies: AppDependencies = {
  allowedOrigins: () => env().ALLOWED_ORIGINS.split(','),
  authenticate: (token) => authenticate(env().SUPABASE_URL, env().SUPABASE_ANON_KEY, token),
  useCasesFor: (db: SupabaseClient) => ({
    getCityTips: new GetCityTips({
      access: new SupabaseTripAccess(db),
      generator: (tipsGenerator ??= buildTipsGenerator()),
      cache: new SupabaseTipsCache(db),
      quota: new SupabaseAiQuota(db, env().AI_DAILY_QUOTA),
      links: new TemplateBuyLinks(),
      modelKey: env().AI_MODEL,
    }),
    searchPlaces: placeSearch,
  }),
};
