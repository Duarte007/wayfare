import { cityTipsSchema, type CityTips, type CityTipsRequest } from '@wayfare/shared';
import type OpenAI from 'openai';
import { z } from 'zod';
import { AiUnavailableError } from '../../application/errors.js';
import type { GeneratedTips, TipsGenerator } from '../../application/ports.js';
import { CITY_TIPS_SYSTEM, cityTipsUserMessage } from '../prompts/city-tips.js';

/**
 * Alibaba Qwen through its international, OpenAI-compatible endpoint. It has no web search here,
 * so it only suggests recurring, well-known events and never returns source URLs.
 */
const FALLBACK_RULES = `
You have no web search in this request. Only include events that recur every year on these dates and are well known; otherwise leave events empty. Set every source_url to null.
Answer with a single JSON object matching this JSON Schema, and nothing else:
${JSON.stringify(z.toJSONSchema(cityTipsSchema))}`;

export class QwenTipsGenerator implements TipsGenerator {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generate(request: CityTipsRequest): Promise<GeneratedTips> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CITY_TIPS_SYSTEM + FALLBACK_RULES },
        { role: 'user', content: cityTipsUserMessage(request) },
      ],
    });

    const text = completion.choices[0]?.message.content;
    if (!text) throw new AiUnavailableError('Qwen returned an empty response');
    const parsed = cityTipsSchema.safeParse(safeJson(text));
    if (!parsed.success)
      throw new AiUnavailableError('Qwen returned invalid tips', { cause: parsed.error });
    return { tips: withoutUrls(parsed.data), model: this.model };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function withoutUrls(tips: CityTips): CityTips {
  const strip = (list: CityTips['events']) => list.map((t) => ({ ...t, source_url: null }));
  return {
    events: strip(tips.events),
    tours_day_trips: strip(tips.tours_day_trips),
    food: strip(tips.food),
    shopping: strip(tips.shopping),
  };
}
