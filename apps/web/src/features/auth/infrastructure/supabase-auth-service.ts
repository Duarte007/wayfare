import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import { readPref, writePref } from '../../../shared/lib/storage';
import type {
  AuthFailure,
  AuthResult,
  AuthService,
  AuthSession,
  OAuthProvider,
} from '../domain/auth-service';

const PROVIDERS_KEY = 'wayfare.authProviders';
const KNOWN_PROVIDERS: readonly OAuthProvider[] = ['apple', 'google'];

function metadataString(session: Session, ...keys: string[]): string | null {
  const metadata = session.user.user_metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function toSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    // Google sends full_name/avatar_url, Apple sends name; our own form writes full_name.
    displayName: metadataString(session, 'full_name', 'name'),
    avatarUrl: metadataString(session, 'avatar_url', 'picture'),
    accessToken: session.access_token,
  };
}

function toFailure(error: AuthError): AuthFailure {
  if (error.code === 'invalid_credentials') return 'invalid_credentials';
  if (error.code === 'weak_password') return 'weak_password';
  if (error.name === 'AuthRetryableFetchError') return 'network';
  return 'unknown';
}

function result(
  error: AuthError | null,
  extra: { needsEmailConfirmation?: boolean } = {},
): AuthResult {
  return error ? { ok: false, reason: toFailure(error) } : { ok: true, ...extra };
}

/** Adapter from the AuthService port to Supabase Auth. */
export class SupabaseAuthService implements AuthService {
  constructor(
    private readonly client: SupabaseClient,
    /** Public auth settings (`GET /auth/v1/settings`) say which social providers are on. */
    private readonly settings: { url: string; apiKey: string; fetch?: typeof fetch },
  ) {}

  async enabledProviders(): Promise<OAuthProvider[]> {
    const doFetch = this.settings.fetch ?? fetch;
    try {
      const res = await doFetch(`${this.settings.url}/auth/v1/settings`, {
        headers: { apikey: this.settings.apiKey },
      });
      if (!res.ok) throw new Error(`settings ${res.status}`);
      const body = (await res.json()) as { external?: Record<string, boolean> };
      const enabled = KNOWN_PROVIDERS.filter((p) => body.external?.[p] === true);
      writePref(PROVIDERS_KEY, enabled.join(','));
      return enabled;
    } catch {
      // Offline: the last answer; never seen one → none (they need the network anyway).
      const saved = readPref(PROVIDERS_KEY);
      return saved
        ? (saved
            .split(',')
            .filter((p) => KNOWN_PROVIDERS.includes(p as OAuthProvider)) as OAuthProvider[])
        : [];
    }
  }

  async currentSession() {
    const { data } = await this.client.auth.getSession();
    return toSession(data.session);
  }

  onSessionChange(listener: (session: AuthSession | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) =>
      listener(toSession(session)),
    );
    return () => data.subscription.unsubscribe();
  }

  async signInWithPassword(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    return result(error);
  }

  async signUp(email: string, password: string, redirectTo: string) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    // With email confirmation on, there is no session until the link is clicked.
    return result(error, { needsEmailConfirmation: !error && !data.session });
  }

  async sendPasswordReset(email: string, redirectTo: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
    return result(error);
  }

  async updatePassword(password: string) {
    const { error } = await this.client.auth.updateUser({ password });
    return result(error);
  }

  async sendEmailCode(email: string) {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    return result(error);
  }

  async verifyEmailCode(email: string, code: string) {
    const { error } = await this.client.auth.verifyOtp({ email, token: code, type: 'email' });
    return result(error);
  }

  async signInWithProvider(provider: 'apple' | 'google', redirectTo: string) {
    const { error } = await this.client.auth.signInWithOAuth({ provider, options: { redirectTo } });
    return result(error);
  }

  async updateDisplayName(name: string) {
    // Metadata updates the session right away (offline-friendly); the profile row is what trip
    // mates read through RLS.
    const { data, error } = await this.client.auth.updateUser({ data: { full_name: name } });
    if (error) return result(error);
    const { error: profileError } = await this.client
      .from('profiles')
      .update({ display_name: name })
      .eq('id', data.user.id);
    return profileError
      ? { ok: false as const, reason: 'unknown' as const }
      : { ok: true as const };
  }

  async signOut() {
    await this.client.auth.signOut();
  }
}
