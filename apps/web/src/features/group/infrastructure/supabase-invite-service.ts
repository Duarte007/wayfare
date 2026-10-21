import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { InviteRole } from '../domain/group';
import {
  InviteError,
  type AcceptedInvite,
  type InviteFailure,
  type InviteService,
} from '../domain/group-ports';

/** Maps the SQL functions' errors: 42501 = not an owner/editor, P0002 = invalid/expired/used up. */
function failureOf(error: Pick<PostgrestError, 'code' | 'message'>): InviteFailure {
  if (error.code === '42501') return 'denied';
  if (error.code === 'P0002') return 'invalid';
  if (!navigator.onLine || /fetch|network|load failed/i.test(error.message)) return 'offline';
  return 'failed';
}

async function guarded<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof InviteError) throw error;
    throw new InviteError('offline');
  }
}

/** `create_trip_invite` / `accept_trip_invite` (security definer SQL functions), as the signed-in user. */
export class SupabaseInviteService implements InviteService {
  constructor(private readonly client: SupabaseClient) {}

  create(tripId: string, role: InviteRole): Promise<string> {
    return guarded(async () => {
      const { data, error } = await this.client.rpc('create_trip_invite', {
        p_trip_id: tripId,
        p_role: role,
      });
      if (error) throw new InviteError(failureOf(error));
      if (typeof data !== 'string') throw new InviteError('failed');
      return data;
    });
  }

  accept(token: string): Promise<AcceptedInvite> {
    return guarded(async () => {
      // accept_trip_invite ignores repeats, so tell "already in" apart by looking first.
      const before = await this.myTripIds();
      const { data, error } = await this.client.rpc('accept_trip_invite', { p_token: token });
      if (error) throw new InviteError(failureOf(error));
      if (typeof data !== 'string') throw new InviteError('failed');
      return { tripId: data, alreadyMember: before.has(data) };
    });
  }

  private async myTripIds(): Promise<Set<string>> {
    const { data: auth } = await this.client.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) throw new InviteError('denied');
    const { data, error } = await this.client
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', userId);
    if (error) throw new InviteError(failureOf(error));
    return new Set(data.map((m) => m.trip_id as string));
  }
}
