import { Link, Outlet } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { CloudOff, CloudUpload, Luggage, Plane, Plus, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '@/shared/lib/online';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { useAuth } from '../../auth/application/AuthProvider';
import { useSync } from '../../sync/application/SyncProvider';

interface NavItem {
  to: '/' | '/profile';
  icon: LucideIcon;
  labelKey: 'trips' | 'profile';
}

const NAV: NavItem[] = [
  { to: '/', icon: Luggage, labelKey: 'trips' },
  { to: '/profile', icon: UserRound, labelKey: 'profile' },
];

/**
 * Signed-in layout: a sidebar on wide screens, a top bar plus a thumb-reachable tab bar on phones.
 * Pages render inside <main>; the shell owns navigation, the signed-in user and the offline state.
 */
export function AppShell() {
  const { t } = useTranslation('nav');
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-foreground px-4 py-3 font-semibold text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('skipToContent')}
      </a>
      <Sidebar />
      <MobileTopBar />
      <main id="main" tabIndex={-1} className="min-w-0 outline-none">
        <div className="mx-auto grid max-w-3xl gap-6 px-4 pt-4 pb-28 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
      <MobileTabBar />
    </div>
  );
}

function Brand() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 rounded-xl text-lg font-extrabold">
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Plane className="size-5" aria-hidden />
      </span>
      {t('appName')}
    </Link>
  );
}

function OfflineBadge() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <Badge variant="info" role="status">
      <CloudOff aria-hidden />
      {t('offline')}
    </Badge>
  );
}

/** Changes saved on the device that the server hasn't accepted yet. */
function PendingBadge() {
  const { t } = useTranslation();
  const { pending } = useSync();
  if (pending === 0) return null;
  return (
    <Badge variant="soft" role="status">
      <CloudUpload aria-hidden />
      {t('pendingChanges', { count: pending })}
    </Badge>
  );
}

function Sidebar() {
  const { t } = useTranslation('nav');
  const { t: tt } = useTranslation('trips');
  const { session } = useAuth();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r bg-card px-4 py-6 lg:flex">
      <div className="px-2">
        <Brand />
      </div>
      <Button asChild size="lg" className="w-full">
        <Link to="/trips/new">
          <Plus aria-hidden />
          {tt('newTrip')}
        </Link>
      </Button>
      <nav aria-label={t('mainMenu')} className="-mt-4">
        <ul className="grid gap-1">
          {NAV.map(({ to, icon: Icon, labelKey }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: true }}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
              >
                <Icon className="size-5" aria-hidden />
                {t(labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto grid gap-3">
        <OfflineBadge />
        <PendingBadge />
        {session ? (
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-lg border p-2.5 transition hover:bg-muted"
          >
            <UserAvatar
              name={session.displayName}
              email={session.email}
              imageUrl={session.avatarUrl}
            />
            <span className="grid min-w-0">
              <span className="truncate font-semibold">{session.displayName ?? session.email}</span>
              {session.displayName ? (
                <span className="truncate text-sm text-muted-foreground">{session.email}</span>
              ) : null}
            </span>
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

function MobileTopBar() {
  const { t } = useTranslation('nav');
  const { session } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-2 backdrop-blur pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
      <Brand />
      <div className="flex items-center gap-2">
        <OfflineBadge />
        {session ? (
          <Link
            to="/profile"
            aria-label={t('profile')}
            className="inline-flex size-11 items-center justify-center rounded-full"
          >
            <UserAvatar
              name={session.displayName}
              email={session.email}
              imageUrl={session.avatarUrl}
              size="sm"
            />
          </Link>
        ) : null}
      </div>
    </header>
  );
}

function MobileTabBar() {
  const { t } = useTranslation('nav');
  const { t: tt } = useTranslation('trips');
  const [trips, profile] = NAV as [NavItem, NavItem];
  return (
    <nav
      aria-label={t('mainMenu')}
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        <TabItem item={trips} label={t(trips.labelKey)} />
        <li>
          {/* The main action sits in the middle, raised, where the thumb rests. */}
          <Link
            to="/trips/new"
            className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-primary"
          >
            <span className="-mt-5 inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Plus className="size-6" aria-hidden />
            </span>
            {tt('newTrip')}
          </Link>
        </li>
        <TabItem item={profile} label={t(profile.labelKey)} />
      </ul>
    </nav>
  );
}

function TabItem({ item: { to, icon: Icon }, label }: { item: NavItem; label: string }) {
  return (
    <li>
      <Link
        to={to}
        activeOptions={{ exact: true }}
        className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground aria-[current=page]:text-primary"
      >
        <Icon className="size-6" aria-hidden />
        {label}
      </Link>
    </li>
  );
}
