import type { Trip } from '@wayfare/shared';
import { LogOut, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localToday } from '../../../shared/lib/dates';
import { LanguageSelect } from '../../../shared/ui/LanguageSelect';
import { Button } from '../../../shared/ui/ui';
import { useAuth } from '../../auth/application/AuthProvider';
import { useTrips } from '../application/TripsProvider';
import { summarizeTrip } from '../domain/trip-summary';

/** Reads only from the local store, so it renders the same in airplane mode. */
export function TripsPage() {
  const { t } = useTranslation('trips');
  const { t: tc } = useTranslation('common');
  const { signOut } = useAuth();
  const trips = useTrips();

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button variant="secondary" onClick={() => void signOut()} aria-label={tc('signOut')}>
          <LogOut className="size-5" aria-hidden />
        </Button>
      </header>

      {trips === undefined ? (
        <p className="text-muted">{tc('loading')}</p>
      ) : trips.length === 0 ? (
        <EmptyTrips />
      ) : (
        <ul className="grid gap-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </ul>
      )}

      <footer>
        <LanguageSelect />
      </footer>
    </main>
  );
}

function EmptyTrips() {
  const { t } = useTranslation('trips');
  return (
    <section className="grid justify-items-start gap-4 rounded-xl border border-dashed border-line p-6">
      <p className="text-muted">{t('empty')}</p>
      <Button>
        <span className="inline-flex items-center gap-2">
          <Plus className="size-5" aria-hidden /> {t('newTrip')}
        </span>
      </Button>
    </section>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const { t } = useTranslation('trips');
  const { nights, daysToGo } = summarizeTrip(trip, localToday());
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold">{trip.name}</h2>
      <p className="text-sm text-muted">
        {trip.start_date} – {trip.end_date} · {t('nights', { count: nights })}
        {daysToGo > 0 ? ` · ${t('daysToGo', { count: daysToGo })}` : ''}
      </p>
    </li>
  );
}
