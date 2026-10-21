import type { SupabaseClient } from '@supabase/supabase-js';
import type { TripAccess } from '../../application/ports.js';

/** Uses the caller's own client: RLS hides stops of trips they are not a member of. */
export class SupabaseTripAccess implements TripAccess {
  constructor(private readonly db: SupabaseClient) {}

  async canSeeStop(tripId: string, stopId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('stops')
      .select('id')
      .eq('id', stopId)
      .eq('trip_id', tripId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error('Trip access check failed', { cause: error });
    return data !== null;
  }
}
