/** Auth port: the UI and hooks depend on this contract, never on the Supabase SDK. */

export type OAuthProvider = 'apple' | 'google';

export interface AuthSession {
  userId: string;
  email: string | null;
  /** From the profile or the identity provider (Google/Apple); null until the user sets one. */
  displayName: string | null;
  avatarUrl: string | null;
  accessToken: string;
}

export type AuthFailure = 'invalid_credentials' | 'weak_password' | 'network' | 'unknown';

export type AuthResult =
  { ok: true; needsEmailConfirmation?: boolean } | { ok: false; reason: AuthFailure };

export interface AuthService {
  /** Reads the stored session without a network call, so it resolves offline. */
  currentSession(): Promise<AuthSession | null>;
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;

  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string, redirectTo: string): Promise<AuthResult>;
  sendPasswordReset(email: string, redirectTo: string): Promise<AuthResult>;
  updatePassword(password: string): Promise<AuthResult>;
  sendEmailCode(email: string): Promise<AuthResult>;
  verifyEmailCode(email: string, code: string): Promise<AuthResult>;
  signInWithProvider(provider: OAuthProvider, redirectTo: string): Promise<AuthResult>;
  /** Social providers switched on in the auth server; the last known list when offline. */
  enabledProviders(): Promise<OAuthProvider[]>;
  /** Name shown to trip mates. */
  updateDisplayName(name: string): Promise<AuthResult>;
  signOut(): Promise<void>;
}
