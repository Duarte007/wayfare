import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiQuota } from '../../application/ports.js';

/** Daily per-user counter enforced atomically in Postgres (`consume_ai_quota`). */
export class SupabaseAiQuota implements AiQuota {
  constructor(
    private readonly db: SupabaseClient,
    private readonly dailyLimit: number,
  ) {}

  async consume(): Promise<boolean> {
    const { data, error } = await this.db.rpc('consume_ai_quota', { daily_limit: this.dailyLimit });
    if (error) throw new Error('Quota check failed', { cause: error });
    return data === true;
  }
}
