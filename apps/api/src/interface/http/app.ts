import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { GetCityTips } from '../../application/get-city-tips.js';
import type { SearchPlaces } from '../../application/search-places.js';
import { errorHandler } from './error-handler.js';
import type { Authenticate } from './middleware/require-user.js';
import { aiRoutes } from './routes/ai-routes.js';
import { geoRoutes } from './routes/geo-routes.js';

export interface UseCases {
  getCityTips: Pick<GetCityTips, 'execute'>;
  searchPlaces: Pick<SearchPlaces, 'execute'>;
}

export interface AppDependencies {
  allowedOrigins: () => string[];
  authenticate: Authenticate;
  /** Use cases are built per request around the user's own database client (RLS). */
  useCasesFor: (db: SupabaseClient) => UseCases;
}

export function createApp(deps: AppDependencies) {
  const app = new Hono();
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin) => (deps.allowedOrigins().includes(origin) ? origin : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 86_400,
    }),
  );
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/ai', aiRoutes(deps));
  app.route('/geo', geoRoutes(deps));
  app.onError(errorHandler);
  return app;
}
