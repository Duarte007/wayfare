import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Model for tips and summaries; overridable without a deploy. */
  AI_MODEL: z.string().default('claude-opus-5-5'),
  /** Fallback model (Alibaba Qwen, OpenAI-compatible international endpoint). Optional. */
  QWEN_API_KEY: z.string().min(1).optional(),
  QWEN_BASE_URL: z.url().default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  QWEN_MODEL: z.string().default('qwen-plus'),
  AI_DAILY_QUOTA: z.coerce.number().int().positive().default(20),
  /** Comma-separated origins allowed to call the API, e.g. https://app.example.com */
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Parsed once; a missing variable fails loudly instead of at the first request that needs it. */
export function env(): Env {
  cached ??= envSchema.parse(process.env);
  return cached;
}
