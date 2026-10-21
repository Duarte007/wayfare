import type { SupabaseClient } from '@supabase/supabase-js';
import type { CityTipsWithLinks, StoredTips, TipsCache } from '../../application/ports.js';

/** Stores tips in `ai_content`, which also syncs them to devices for offline reading. */
export class SupabaseTipsCache implements TipsCache {
  constructor(private readonly db: SupabaseClient) {}

  async find(stopId: string, inputHash: string, notOlderThan: Date): Promise<StoredTips | null> {
    const { data, error } = await this.db
      .from('ai_content')
      .select('payload')
      .eq('stop_id', stopId)
      .eq('kind', 'tips')
      .eq('input_hash', inputHash)
      .gte('generated_at', notOlderThan.toISOString())
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ payload: CityTipsWithLinks }>();
    if (error) throw new Error('Failed to read tips cache', { cause: error });
    return data ? { tips: data.payload } : null;
  }

  async save(entry: Parameters<TipsCache['save']>[0]): Promise<void> {
    const { error } = await this.db.from('ai_content').insert({
      id: crypto.randomUUID(),
      trip_id: entry.tripId,
      stop_id: entry.stopId,
      kind: 'tips',
      locale: entry.locale,
      input_hash: entry.inputHash,
      payload: entry.tips,
      model: entry.model,
    });
    if (error) throw new Error('Failed to store tips', { cause: error });
  }
}
