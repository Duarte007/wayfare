import { daysBetween } from '@wayfare/shared';
import { Link, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPinned,
  Route,
  Plane,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateRange, localToday } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { IconTile } from '@/shared/ui/ui';
import { useTripDetails } from '../../trips/application/useTripDetails';
import {
  buildItinerary,
  type ItineraryStop,
  type TripDetails,
} from '../../trips/domain/trip-overview';
import { useCalendarCursor } from '../application/useCalendarCursor';
import { dayPlan, daySummary } from '../domain/day-plan';
import { firstDayOfWeek } from '../domain/month-grid';
import { cityFill, cityInk, shortName, travelFill } from './city-colors';
import { DayPlanDialog } from './DayPlanDialog';
import { monthTitle } from './format';
import { MonthGrid } from './MonthGrid';

/** `/trips/$tripId/calendar`: the trip month by month, each city's days in its colour. */
export function CalendarPage() {
  const { t } = useTranslation('trips');
  const { t: tc } = useTranslation();
  const { tripId } = useParams({ strict: false }) as { tripId: string };
  const details = useTripDetails(tripId);

  if (details === undefined) {
    return (
      <p className="inline-flex items-center gap-2 text-muted-foreground" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {tc('loading')}
      </p>
    );
  }
  if (details === null) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="grid justify-items-center gap-3 py-4 text-center">
          <IconTile icon={MapPinned} size="lg" />
          <h1 className="text-xl font-bold">{t('notFoundTitle')}</h1>
          <p className="max-w-sm text-muted-foreground">{t('notFound')}</p>
        </CardContent>
      </Card>
    );
  }
  return <TripCalendar details={details} />;
}

function TripCalendar({ details }: { details: TripDetails }) {
  const { t, i18n } = useTranslation('calendar');
  const { trip } = details;
  const language = i18n.language;
  const today = localToday();
  const firstDay = firstDayOfWeek(language);
  const itinerary = useMemo(() => buildItinerary(details), [details]);
  const cursor = useCalendarCursor(trip, today, firstDay);
  const [opened, setOpened] = useState<{ date: string; open: boolean } | null>(null);
  const titleId = useId();
  const totalDays = daysBetween(trip.start_date, trip.end_date) + 1;
  const planOf = (date: string) => dayPlan(itinerary, details.legs, trip, date);

  return (
    <>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit max-w-full text-muted-foreground"
      >
        <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
          <ArrowLeft aria-hidden />
          <span className="truncate">{trip.name}</span>
        </Link>
      </Button>

      <header className="flex min-w-0 items-start gap-4">
        <IconTile icon={CalendarDays} tone="sky" />
        <div className="grid min-w-0 gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {formatDateRange(trip.start_date, trip.end_date, language)}
          </p>
        </div>
      </header>

      <Card className="gap-3 py-4">
        <CardContent className="grid gap-3 px-2 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            {cursor.months.length > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('previousMonth')}
                disabled={!cursor.canPrevious}
                onClick={() => cursor.goToMonth(-1)}
              >
                <ChevronLeft aria-hidden />
              </Button>
            ) : null}
            <h2
              id={titleId}
              aria-live="polite"
              className="flex-1 text-center text-lg font-bold first-letter:uppercase"
            >
              {monthTitle(cursor.month, language)}
            </h2>
            {cursor.months.length > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('nextMonth')}
                disabled={!cursor.canNext}
                onClick={() => cursor.goToMonth(1)}
              >
                <ChevronRight aria-hidden />
              </Button>
            ) : null}
          </div>
          <MonthGrid
            month={cursor.month}
            titleId={titleId}
            firstDay={firstDay}
            focused={cursor.focused}
            today={today}
            summaryOf={(date) => daySummary(planOf(date))}
            onKey={cursor.onKey}
            onFocusDay={cursor.focus}
            onOpen={(date) => {
              cursor.focus(date);
              setOpened({ date, open: true });
            }}
          />
        </CardContent>
      </Card>

      {itinerary.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="grid justify-items-center gap-2 text-center">
            <Route className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-semibold">{t('emptyTitle')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <Legend itinerary={itinerary} />
      )}

      <DayPlanDialog
        plan={opened ? planOf(opened.date) : null}
        open={opened?.open ?? false}
        trip={trip}
        tripId={trip.id}
        totalDays={totalDays}
        onClose={() => setOpened((o) => (o ? { ...o, open: false } : o))}
      />
    </>
  );
}

function Legend({ itinerary }: { itinerary: ItineraryStop[] }) {
  const { t, i18n } = useTranslation('calendar');
  const swatch =
    'inline-flex h-7 min-w-10 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-bold';
  const first = itinerary[0]!.stop.color_index;
  const second = itinerary[1]?.stop.color_index ?? first;
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="grid content-start gap-2">
        <h2 className="text-sm font-bold">{t('legend')}</h2>
        <ul className="grid gap-2">
          {itinerary.map(({ stop, place }) => (
            <li key={stop.id} className="flex min-w-0 items-center gap-3 text-sm">
              <span
                className={cn(swatch, cityFill(stop.color_index), cityInk(stop.color_index))}
                aria-hidden
              >
                {shortName(place?.name)}
              </span>
              <span className="grid min-w-0">
                <span className="font-semibold break-words">{place?.name ?? '—'}</span>
                <span className="text-muted-foreground">
                  {formatDateRange(stop.start_date, stop.end_date, i18n.language)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid content-start gap-2">
        <h2 className="text-sm font-bold">{t('keyTitle')}</h2>
        <ul className="grid gap-2 text-sm">
          <li className="flex items-center gap-3">
            <span
              className={cn(swatch, 'text-foreground')}
              style={travelFill(first, second)}
              aria-hidden
            >
              →
            </span>
            {t('keyTravelDay')}
          </li>
          <li className="flex items-center gap-3">
            <span className={cn(swatch, 'bg-muted')} aria-hidden>
              <BedDouble className="size-4" />
            </span>
            {t('keyCheckIn')}
          </li>
          <li className="flex items-center gap-3">
            <span className={cn(swatch, 'bg-muted')} aria-hidden>
              <Plane className="size-4" />
            </span>
            {t('keyTransport')}
          </li>
          <li className="flex items-center gap-3">
            <span className={cn(swatch, 'bg-muted')} aria-hidden>
              <span className="size-1.5 rounded-full bg-current" />
            </span>
            {t('keyActivities')}
          </li>
        </ul>
      </div>
    </section>
  );
}
