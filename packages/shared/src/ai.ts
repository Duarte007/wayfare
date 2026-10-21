import { z } from 'zod';
import { isoDate, localeSchema } from './schemas.js';

/** Bump when the city-tips prompt changes; part of the result cache key. */
export const CITY_TIPS_PROMPT_VERSION = 1;

export const cityTipsRequestSchema = z.object({
  tripId: z.uuid(),
  stopId: z.uuid(),
  city: z.string().min(1).max(120),
  country: z.string().length(2),
  startDate: isoDate,
  endDate: isoDate,
  alreadyPlanned: z.array(z.string().max(200)).max(50).default([]),
  otherCities: z.array(z.string().max(120)).max(30).default([]),
  interests: z.array(z.string().max(40)).max(10).default([]),
  pace: z.enum(['relaxed', 'balanced', 'packed']).default('balanced'),
  party: z.number().int().min(1).max(20).default(1),
  locale: localeSchema,
});
export type CityTipsRequest = z.infer<typeof cityTipsRequestSchema>;

export const tipSchema = z.object({
  title: z.string(),
  title_local: z.string().nullable(),
  reason: z.string(),
  area: z.string().nullable(),
  duration: z.string().nullable(),
  price_range: z.string().nullable(),
  needs_booking: z.boolean(),
  booking_hint: z.string().nullable(),
  search_query: z.string(),
  /** Only URLs that came from web search results; the server drops anything else. */
  source_url: z.url().nullable(),
});
export type Tip = z.infer<typeof tipSchema>;

export const cityTipsSchema = z.object({
  events: z.array(tipSchema),
  tours_day_trips: z.array(tipSchema),
  food: z.array(tipSchema),
  shopping: z.array(tipSchema),
});
export type CityTips = z.infer<typeof cityTipsSchema>;
