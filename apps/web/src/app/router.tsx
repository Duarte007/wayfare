import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
  Outlet,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/application/AuthProvider';
import { NotFoundScreen, RouteError } from '../features/errors/ui/ErrorScreen';
import { UpdateBanner } from '../features/pwa/ui/UpdateBanner';
import { SignInPage } from '../features/auth/ui/SignInPage';
import { PendingInviteRedirect } from '../features/group/ui/PendingInviteRedirect';
import { AppShell } from '../features/shell/ui/AppShell';
import { TripsPage } from '../features/trips/ui/TripsPage';

// First load: the shell, sign-in and the trips list. Every other screen is its own chunk, fetched
// on demand (and precached by the service worker, so it still opens offline).
const ResetPasswordPage = lazyRouteComponent(
  () => import('../features/auth/ui/ResetPasswordPage'),
  'ResetPasswordPage',
);
const ChecklistPage = lazyRouteComponent(
  () => import('../features/checklist/ui/ChecklistPage'),
  'ChecklistPage',
);
const ProfilePage = lazyRouteComponent(
  () => import('../features/profile/ui/ProfilePage'),
  'ProfilePage',
);
const CalendarPage = lazyRouteComponent(
  () => import('../features/calendar/ui/CalendarPage'),
  'CalendarPage',
);
const DocumentsPage = lazyRouteComponent(
  () => import('../features/documents/ui/DocumentsPage'),
  'DocumentsPage',
);
const MapPage = lazyRouteComponent(() => import('../features/maps/ui/MapPage'), 'MapPage');
const InvitePage = lazyRouteComponent(
  () => import('../features/group/ui/InvitePage'),
  'InvitePage',
);
const EditTripPage = lazyRouteComponent(
  () => import('../features/trips/ui/EditTripPage'),
  'EditTripPage',
);
const NewTripPage = lazyRouteComponent(
  () => import('../features/trips/ui/NewTripPage'),
  'NewTripPage',
);
const TripPage = lazyRouteComponent(() => import('../features/trips/ui/TripPage'), 'TripPage');

/** Shown while a screen's chunk loads (only noticeable on a slow first visit). */
function RouteLoading() {
  const { t } = useTranslation();
  return <p className="p-6 text-muted-foreground">{t('loading')}</p>;
}

function Root() {
  const { loading } = useAuth();
  return (
    <>
      {loading ? <RouteLoading /> : <Outlet />}
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
      <PendingInviteRedirect>
        <AppShell />
      </PendingInviteRedirect>
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
    createRoute({
      getParentRoute: () => appRoute,
      path: '/trips/$tripId/checklist',
      component: ChecklistPage,
    }),
    createRoute({ getParentRoute: () => appRoute, path: '/trips/$tripId/map', component: MapPage }),
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
  createRoute({ getParentRoute: () => rootRoute, path: '/invite/$token', component: InvitePage }),
]);

export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteError,
  defaultPendingComponent: RouteLoading,
  // Fetch a screen's chunk as soon as a link to it is hovered or touched.
  defaultPreload: 'intent',
  defaultNotFoundComponent: NotFound,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
