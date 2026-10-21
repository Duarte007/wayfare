import { zValidator } from '@hono/zod-validator';
import { placeSearchRequestSchema } from '@wayfare/shared';
import { Hono } from 'hono';
import type { AppDependencies } from '../app.js';
import { requireUser, type UserVariables } from '../middleware/require-user.js';

/** Signed-in only, so the endpoint can't be used as an open geocoding proxy. */
export function geoRoutes(deps: AppDependencies) {
  return new Hono<{ Variables: UserVariables }>()
    .use('*', requireUser(deps.authenticate))
    .get('/search', zValidator('query', placeSearchRequestSchema), async (c) => {
      const { searchPlaces } = deps.useCasesFor(c.get('auth').db);
      c.header('Cache-Control', 'private, max-age=86400');
      return c.json({ places: await searchPlaces.execute(c.req.valid('query')) });
    });
}
