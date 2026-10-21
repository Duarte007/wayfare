import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { cityTipsSchema, type CityTipsRequest } from '@wayfare/shared';
import { AiUnavailableError } from '../../application/errors.js';
import type { GeneratedTips, TipsGenerator } from '../../application/ports.js';
import { CITY_TIPS_SYSTEM, cityTipsUserMessage } from '../prompts/city-tips.js';

/** Server-side web search may pause a long turn; resume a few times before giving up. */
const MAX_RESUMES = 3;

export class ClaudeTipsGenerator implements TipsGenerator {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
  ) {}

  async generate(request: CityTipsRequest): Promise<GeneratedTips> {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: cityTipsUserMessage(request) },
    ];

    for (let attempt = 0; attempt <= MAX_RESUMES; attempt++) {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 16000,
        output_config: { effort: 'medium', format: zodOutputFormat(cityTipsSchema) },
        system: [{ type: 'text', text: CITY_TIPS_SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
        messages,
      });

      if (response.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: response.content });
        continue;
      }
      if (response.stop_reason === 'refusal')
        throw new AiUnavailableError('Claude declined the request');
      if (!response.parsed_output) {
        throw new AiUnavailableError(
          `Claude returned no valid tips (stop_reason: ${response.stop_reason})`,
        );
      }
      return { tips: response.parsed_output, model: this.model };
    }
    throw new AiUnavailableError('Claude did not finish generating tips');
  }
}
