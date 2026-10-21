import { Link, Outlet } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { CloudOff, Luggage, Plane, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../../shared/lib/online';
import { Avatar } from '../../../shared/ui/Avatar';
import { useAuth } from '../../auth/application/AuthProvider';

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
        className="sr-only z-50 rounded-xl bg-ink px-4 py-3 font-semibold text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
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
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent text-on-accent">
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
    <span
      role="status"
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-soft px-3 py-1 text-xs font-semibold text-sky"
    >
      <CloudOff className="size-3.5" aria-hidden />
      {t('offline')}
    </span>
  );
}

function Sidebar() {
  const { t } = useTranslation('nav');
  const { session } = useAuth();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-line bg-surface px-4 py-6 lg:flex">
      <div className="px-2">
        <Brand />
      </div>
      <nav aria-label={t('mainMenu')}>
        <ul className="grid gap-1">
          {NAV.map(({ to, icon: Icon, labelKey }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: true }}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold text-muted transition hover:bg-bg hover:text-ink aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent"
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
        {session ? (
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-2xl border border-line p-2.5 transition hover:border-ink"
          >
            <Avatar name={session.displayName} email={session.email} imageUrl={session.avatarUrl} />
            <span className="grid min-w-0">
              <span className="truncate font-semibold">{session.displayName ?? session.email}</span>
              {session.displayName ? (
                <span className="truncate text-sm text-muted">{session.email}</span>
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
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
      <Brand />
      <div className="flex items-center gap-2">
        <OfflineBadge />
        {session ? (
          <Link
            to="/profile"
            aria-label={t('profile')}
            className="inline-flex size-11 items-center justify-center rounded-full"
          >
            <Avatar
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
  return (
    <nav
      aria-label={t('mainMenu')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-2">
        {NAV.map(({ to, icon: Icon, labelKey }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true }}
              className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-muted aria-[current=page]:text-accent"
            >
              <Icon className="size-6" aria-hidden />
              {t(labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
