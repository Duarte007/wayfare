import { createClient } from '@supabase/supabase-js';

/**
 * Points at our own auth domain (Supabase custom domain), never *.supabase.co,
 * so sign-in keeps working where a third-party domain is blocked.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
