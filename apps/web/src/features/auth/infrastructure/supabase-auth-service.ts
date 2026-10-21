import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import type { AuthFailure, AuthResult, AuthService, AuthSession } from '../domain/auth-service';

function toSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
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
  constructor(private readonly client: SupabaseClient) {}

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

  async signOut() {
    await this.client.auth.signOut();
  }
}
