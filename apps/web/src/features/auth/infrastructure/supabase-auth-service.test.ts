import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseAuthService } from './supabase-auth-service';

const client = {} as SupabaseClient;
const settings = (fetch: typeof globalThis.fetch) =>
  new SupabaseAuthService(client, { url: 'https://auth.example.com', apiKey: 'k', fetch });

describe('SupabaseAuthService.enabledProviders', () => {
  beforeEach(() => localStorage.clear());

  it('lists only the providers the auth server has switched on', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ external: { google: true, apple: false, github: true, email: true } }),
    );
    expect(await settings(fetch).enabledProviders()).toEqual(['google']);
    expect(fetch).toHaveBeenCalledWith('https://auth.example.com/auth/v1/settings', {
      headers: { apikey: 'k' },
    });
  });

  it('falls back to the last known list offline, and to none if it never knew', async () => {
    const offline = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')));
    expect(await settings(offline).enabledProviders()).toEqual([]);
    await settings(
      vi.fn(async () => Response.json({ external: { apple: true } })),
    ).enabledProviders();
    expect(await settings(offline).enabledProviders()).toEqual(['apple']);
  });
});
