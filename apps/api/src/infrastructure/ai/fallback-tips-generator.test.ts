import type { CityTips, CityTipsRequest } from '@wayfare/shared';
import { describe, expect, it, vi } from 'vitest';
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

  it('throws the last error when every provider fails', async () => {
    await expect(new FallbackTipsGenerator([failing, failing]).generate(request)).rejects.toThrow(
      'overloaded',
    );
  });

  it('requires at least one provider', () => {
    expect(() => new FallbackTipsGenerator([])).toThrow();
  });
});
