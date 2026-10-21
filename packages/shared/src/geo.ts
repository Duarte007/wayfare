import { z } from 'zod';
import { localeSchema } from './schemas.js';

export const placeSearchRequestSchema = z.object({
  q: z.string().trim().min(2).max(100),
  locale: localeSchema,
});
export type PlaceSearchRequest = z.infer<typeof placeSearchRequestSchema>;

/** A city/town found by the place search, ready to become a `place` row. */
export const placeSuggestionSchema = z.object({
  /** In the user's language when known ("Pequim"), otherwise the local name. */
  name: z.string(),
  /** As written locally ("北京市"), when different from `name`. */
  name_local: z.string().nullable(),
  /** ISO 3166-1 alpha-2, upper case. */
  country_code: z.string().length(2),
  country: z.string().nullable(),
  region: z.string().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type PlaceSuggestion = z.infer<typeof placeSuggestionSchema>;

export const placeSearchResponseSchema = z.object({ places: z.array(placeSuggestionSchema) });
