import type { CityTipsRequest } from '@wayfare/shared';
import { AiUnavailableError } from '../../application/errors.js';
import type { GeneratedTips, TipsGenerator } from '../../application/ports.js';

/**
 * Tries each generator in order and returns the first answer (Claude, then Qwen).
 * Adding a provider means adding a generator to the list, not changing this class.
 */
export class FallbackTipsGenerator implements TipsGenerator {
  constructor(
    private readonly generators: readonly TipsGenerator[],
    private readonly onFallback: (error: unknown, index: number) => void = () => {},
  ) {
    if (generators.length === 0) throw new Error('At least one generator is required');
  }

  async generate(request: CityTipsRequest): Promise<GeneratedTips> {
    let lastError: unknown;
    for (const [index, generator] of this.generators.entries()) {
      try {
        return await generator.generate(request);
      } catch (error) {
        lastError = error;
        if (index < this.generators.length - 1) this.onFallback(error, index);
      }
    }
    throw new AiUnavailableError('Every AI provider failed', { cause: lastError });
  }
}
