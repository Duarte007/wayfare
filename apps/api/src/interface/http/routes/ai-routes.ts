import { zValidator } from '@hono/zod-validator';
import { cityTipsRequestSchema } from '@wayfare/shared';
import { Hono } from 'hono';
import type { AppDependencies } from '../app.js';
import { requireUser, type UserVariables } from '../middleware/require-user.js';

/** Thin controllers: validate input, call one use case, shape the response. */
export function aiRoutes(deps: AppDependencies) {
  return new Hono<{ Variables: UserVariables }>()
    .use('*', requireUser(deps.authenticate))
    .post('/city-tips', zValidator('json', cityTipsRequestSchema), async (c) => {
      const { getCityTips } = deps.useCasesFor(c.get('auth').db);
      return c.json(await getCityTips.execute(c.req.valid('json')));
    });
}
