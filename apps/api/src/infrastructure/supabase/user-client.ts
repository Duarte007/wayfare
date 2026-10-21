import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export interface AuthenticatedUser {
  user: User;
  /** Acts as the user, so Row Level Security applies to every query. */
  db: SupabaseClient;
}

/** Verifies a Supabase access token; null when it is missing, invalid or expired. */
export async function authenticate(
  url: string,
  anonKey: string,
  accessToken: string,
): Promise<AuthenticatedUser | null> {
  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { user: data.user, db };
}
