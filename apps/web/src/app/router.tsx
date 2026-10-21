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
import { NotFoundScreen, RouteError } from '../features/errors/ui/ErrorScreen';
import { UpdateBanner } from '../features/pwa/ui/UpdateBanner';
import { ResetPasswordPage } from '../features/auth/ui/ResetPasswordPage';
import { SignInPage } from '../features/auth/ui/SignInPage';
import { ProfilePage } from '../features/profile/ui/ProfilePage';
import { CalendarPage } from '../features/calendar/ui/CalendarPage';
import { DocumentsPage } from '../features/documents/ui/DocumentsPage';
import { AppShell } from '../features/shell/ui/AppShell';
import { EditTripPage } from '../features/trips/ui/EditTripPage';
import { NewTripPage } from '../features/trips/ui/NewTripPage';
import { TripPage } from '../features/trips/ui/TripPage';
import { TripsPage } from '../features/trips/ui/TripsPage';

function Root() {
  const { loading } = useAuth();
  const { t } = useTranslation();
  return (
    <>
      {loading ? <p className="p-6 text-muted-foreground">{t('loading')}</p> : <Outlet />}
      <UpdateBanner />
    </>
  );
}

/** Unknown URL: inside the app shell when signed in, on its own page otherwise. */
function NotFound() {
  const { session } = useAuth();
  if (session) {
    return (
      <AppShell>
        <NotFoundScreen signedIn />
      </AppShell>
    );
  }
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md content-center px-4 py-10">
      <NotFoundScreen signedIn={false} />
    </main>
  );
}

function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return session ? children : <Navigate to="/sign-in" />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return session ? <Navigate to="/" /> : children;
}

const rootRoute = createRootRoute({ component: Root, notFoundComponent: NotFound });

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
    createRoute({ getParentRoute: () => appRoute, path: '/trips/new', component: NewTripPage }),
    createRoute({ getParentRoute: () => appRoute, path: '/trips/$tripId', component: TripPage }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/trips/$tripId/edit',
      component: EditTripPage,
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/trips/$tripId/documents',
      component: DocumentsPage,
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/trips/$tripId/calendar',
      component: CalendarPage,
    }),
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

export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: NotFound,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
