import type { SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { QuotaExceededError } from '../../application/errors.js';
import { createApp, type AppDependencies, type UseCases } from './app.js';

type Execute = UseCases['getCityTips']['execute'];
const emptyTips = { events: [], tours_day_trips: [], food: [], shopping: [] };

const validBody = {
  tripId: crypto.randomUUID(),
  stopId: crypto.randomUUID(),
  city: 'Beijing',
  country: 'CN',
  startDate: '2026-10-23',
  endDate: '2026-10-28',
  locale: 'en',
};

function deps(
  execute = vi.fn<Execute>(async () => ({ cached: true, tips: emptyTips })),
): AppDependencies {
  return {
    allowedOrigins: () => ['https://app.example.com'],
    authenticate: async (token) =>
      token === 'good' ? { user: { id: 'u1' } as User, db: {} as SupabaseClient } : null,
    useCasesFor: () => ({ getCityTips: { execute } }),
  };
}

const post = (app: ReturnType<typeof createApp>, body: unknown, token?: string) =>
  app.request('/ai/city-tips', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

describe('HTTP app', () => {
  it('serves /health', async () => {
    const res = await createApp(deps()).request('/health');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('rejects requests without a valid session', async () => {
    expect((await post(createApp(deps()), validBody)).status).toBe(401);
    expect((await post(createApp(deps()), validBody, 'bad')).status).toBe(401);
  });

  it('validates the body before running the use case', async () => {
    const execute = vi.fn<Execute>();
    const res = await post(createApp(deps(execute)), { city: 'x' }, 'good');
    expect(res.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('maps quota errors to 429', async () => {
    const execute = vi.fn<Execute>(async () => Promise.reject(new QuotaExceededError()));
    expect((await post(createApp(deps(execute)), validBody, 'good')).status).toBe(429);
  });

  it('returns the use case result', async () => {
    const res = await post(createApp(deps()), validBody, 'good');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cached: true, tips: emptyTips });
  });
});
