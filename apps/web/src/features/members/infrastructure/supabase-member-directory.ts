import type { MemberRole } from '@wayfare/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WayfareDB } from '../../../shared/infrastructure/db';
import {
  sortMembers,
  type MemberDirectory,
  type MemberRemoval,
  type TripMember,
} from '../domain/members';

const cacheKey = (tripId: string) => `members.${tripId}`;

/** Reads members through the user's session (RLS: only trip mates), cached in Dexie `meta`. */
export class SupabaseMemberDirectory implements MemberDirectory {
  constructor(
    private readonly client: SupabaseClient,
    private readonly db: WayfareDB,
  ) {}

  async cached(tripId: string): Promise<TripMember[]> {
    const entry = await this.db.meta.get(cacheKey(tripId));
    if (!entry) return [];
    try {
      return JSON.parse(entry.value) as TripMember[];
    } catch {
      return [];
    }
  }

  async refresh(tripId: string): Promise<TripMember[] | null> {
    try {
      const rows = await this.client
        .from('trip_members')
        .select('user_id, role')
        .eq('trip_id', tripId);
      if (rows.error) return null;
      const ids = rows.data.map((r) => r.user_id as string);
      // trip_members and profiles both point at auth.users, so they can't be embedded in one query.
      const profiles = ids.length
        ? await this.client.from('profiles').select('id, display_name').in('id', ids)
        : { data: [], error: null };
      if (profiles.error) return null;
      const names = new Map(
        (profiles.data ?? []).map((p) => [
          p.id as string,
          (p.display_name as string | null) ?? null,
        ]),
      );
      const members = sortMembers(
        rows.data.map((r) => ({
          userId: r.user_id as string,
          role: r.role as MemberRole,
          name: names.get(r.user_id as string) ?? null,
        })),
      );
      await this.db.meta.put({ key: cacheKey(tripId), value: JSON.stringify(members) });
      return members;
    } catch {
      return null;
    }
  }

  async remove(tripId: string, userId: string): Promise<MemberRemoval> {
    try {
      // RLS ("members: owner manages") lets the owner remove anyone and anyone leave.
      const { error } = await this.client
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', userId);
      if (error) return isNetworkError(error.message) ? 'offline' : 'failed';
      const cached = await this.cached(tripId);
      await this.db.meta.put({
        key: cacheKey(tripId),
        value: JSON.stringify(cached.filter((m) => m.userId !== userId)),
      });
      return 'removed';
    } catch {
      return 'offline';
    }
  }
}

/** supabase-js reports a fetch that never reached the server as an error with this message. */
function isNetworkError(message: string): boolean {
  return /fetch|network|load failed/i.test(message) || !navigator.onLine;
}
