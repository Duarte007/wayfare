import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/application/AuthProvider';
import { ResetPasswordPage } from '../features/auth/ui/ResetPasswordPage';
import { SignInPage } from '../features/auth/ui/SignInPage';
import { ProfilePage } from '../features/profile/ui/ProfilePage';
import { AppShell } from '../features/shell/ui/AppShell';
import { TripsPage } from '../features/trips/ui/TripsPage';

function Root() {
  const { loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <p className="p-6 text-muted">{t('loading')}</p>;
  return <Outlet />;
}

function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return session ? children : <Navigate to="/sign-in" />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return session ? <Navigate to="/" /> : children;
}

const rootRoute = createRootRoute({ component: Root });

// Pathless layout: every signed-in page shares the sidebar / tab bar.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: () => (
    <RequireSession>
      <AppShell />
    </RequireSession>
  ),
});

const routeTree = rootRoute.addChildren([
  appRoute.addChildren([
    createRoute({ getParentRoute: () => appRoute, path: '/', component: TripsPage }),
    createRoute({ getParentRoute: () => appRoute, path: '/profile', component: ProfilePage }),
  ]),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/sign-in',
    component: () => (
      <GuestOnly>
        <SignInPage />
      </GuestOnly>
    ),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/reset', component: ResetPasswordPage }),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
