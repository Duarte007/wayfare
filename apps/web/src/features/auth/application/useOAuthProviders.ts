import { useEffect, useState } from 'react';
import type { OAuthProvider } from '../domain/auth-service';
import { useAuth } from './AuthProvider';

/** Only providers that are switched on get a button, so nobody lands on a provider error page. */
export function useOAuthProviders(): OAuthProvider[] {
  const { service } = useAuth();
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  useEffect(() => {
    let active = true;
    void service.enabledProviders().then((list) => active && setProviders(list));
    return () => {
      active = false;
    };
  }, [service]);
  return providers;
}
