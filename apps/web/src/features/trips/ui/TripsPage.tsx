import type { Trip } from '@wayfare/shared';
import {
  CalendarDays,
  ChevronRight,
  Hourglass,
  Loader2,
  Luggage,
  MapPinned,
  Moon,
  Plus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDateRange, localToday } from '../../../shared/lib/dates';
import { Button, IconTile } from '../../../shared/ui/ui';
import { useAuth } from '../../auth/application/AuthProvider';
import { useTrips } from '../application/TripsProvider';
import { summarizeTrip } from '../domain/trip-summary';

/** Reads only from the local store, so it renders the same in airplane mode. */
export function TripsPage() {
  const { t } = useTranslation('trips');
  const { t: tc } = useTranslation('common');
  const { session } = useAuth();
  const trips = useTrips();
  const firstName = session?.displayName?.split(/\s+/)[0];

  return (
    <>
      <header className="grid gap-1">
        <p className="text-sm font-medium text-muted">
          {firstName ? t('welcomeName', { name: firstName }) : t('welcome')}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('greeting')}</h1>
      </header>

      {trips === undefined ? (
        <p className="inline-flex items-center gap-2 text-muted" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          {tc('loading')}
        </p>
      ) : trips.length === 0 ? (
        <EmptyTrips />
      ) : (
        <section className="grid gap-3" aria-labelledby="trips-heading">
          <div className="flex items-center justify-between">
            <h2 id="trips-heading" className="text-lg font-bold">
              {t('title')}
            </h2>
            <Button icon={<Plus className="size-5" />}>{t('newTrip')}</Button>
          </div>
          <ul className="grid gap-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function EmptyTrips() {
  const { t } = useTranslation('trips');
  return (
    <section className="grid justify-items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-6 py-10 text-center">
      <IconTile icon={Luggage} size="lg" />
      <div className="grid gap-1">
        <h2 className="text-xl font-bold">{t('emptyTitle')}</h2>
        <p className="max-w-xs text-muted">{t('empty')}</p>
      </div>
      <Button icon={<Plus className="size-5" />}>{t('newTrip')}</Button>
    </section>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const { t, i18n } = useTranslation('trips');
  const { nights, daysToGo } = summarizeTrip(trip, localToday());
  return (
    <li>
      <article className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-sm">
        <IconTile icon={MapPinned} tone="sky" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h3 className="truncate text-lg font-bold">{trip.name}</h3>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" aria-hidden />
              {formatDateRange(trip.start_date, trip.end_date, i18n.language)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Moon className="size-4" aria-hidden />
              {t('nights', { count: nights })}
            </span>
          </p>
          {daysToGo > 0 ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
              <Hourglass className="size-3.5" aria-hidden />
              {t('daysToGo', { count: daysToGo })}
            </span>
          ) : null}
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </article>
    </li>
  );
}
