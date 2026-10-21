import type { CityTips, CityTipsRequest } from '@wayfare/shared';
import { describe, expect, it, vi } from 'vitest';
import { AiUnavailableError } from '../../application/errors.js';
import { FallbackTipsGenerator } from './fallback-tips-generator.js';

const tips: CityTips = { events: [], tours_day_trips: [], food: [], shopping: [] };
const request = {} as CityTipsRequest;
const failing = { generate: async () => Promise.reject(new Error('overloaded')) };

describe('FallbackTipsGenerator', () => {
  it('returns the first provider that answers', async () => {
    const onFallback = vi.fn();
    const qwen = { generate: async () => ({ tips, model: 'qwen-plus' }) };
    const result = await new FallbackTipsGenerator([failing, qwen], onFallback).generate(request);
    expect(result.model).toBe('qwen-plus');
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it('reports the AI as unavailable, keeping the last error, when every provider fails', async () => {
    const error = await new FallbackTipsGenerator([failing, failing])
      .generate(request)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiUnavailableError);
    expect((error as AiUnavailableError).cause).toEqual(new Error('overloaded'));
  });

  it('requires at least one provider', () => {
    expect(() => new FallbackTipsGenerator([])).toThrow();
  });
});
