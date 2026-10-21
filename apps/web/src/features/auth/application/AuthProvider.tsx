import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthService, AuthSession } from '../domain/auth-service';

interface AuthState {
  service: AuthService;
  session: AuthSession | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface AuthProviderProps {
  service: AuthService;
  /** Clears data stored on this device after sign-out. */
  onSignedOut?: () => Promise<void>;
  children: ReactNode;
}

export function AuthProvider({ service, onSignedOut, children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void service.currentSession().then((current) => {
      if (!active) return;
      setSession(current);
      setLoading(false);
    });
    const unsubscribe = service.onSessionChange(setSession);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [service]);

  const signOut = async () => {
    await service.signOut();
    await onSignedOut?.();
  };

  return (
    <AuthContext.Provider value={{ service, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
