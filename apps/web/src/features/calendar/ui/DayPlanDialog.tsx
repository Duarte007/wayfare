import { Link } from '@tanstack/react-router';
import { BedDouble, Clock, MapPin, Route, Sparkles, Ticket } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatZonedTime, zonedParts } from '@/shared/lib/timezone';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import type { DayLeg, DayPlan, TripRange } from '../domain/day-plan';
import { cityFill, cityInk, travelFill } from './city-colors';
import { longDate, shortDate } from './format';
import { MODE_ICONS } from './MonthGrid';

/** The plan of one calendar day: where you are, where you sleep, transport and activities. */
export function DayPlanDialog({
  plan,
  open,
  trip,
  tripId,
  totalDays,
  onClose,
}: {
  /** The day shown; kept while the sheet animates closed. */
  plan: DayPlan | null;
  open: boolean;
  trip: TripRange;
  tripId: string;
  totalDays: number;
  onClose: () => void;
}) {
  const { t: tc, i18n } = useTranslation();
  return (
    <Dialog open={open && plan !== null} onOpenChange={(next) => (next ? null : onClose())}>
      {plan ? (
        <DialogContent
          closeLabel={tc('close')}
          className="gap-5"
          // The dialog has no trigger: hand focus back to the day it was opened from.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.querySelector<HTMLElement>(`[data-date="${plan.date}"]`)?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{longDate(plan.date, i18n.language)}</DialogTitle>
            <DialogDescription asChild>
              <div className="grid gap-2">
                <PlaceLine plan={plan} />
                {plan.tripDay ? <PlanDayOf day={plan.tripDay} total={totalDays} /> : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          {plan.place.kind === 'outside' ? null : (
            <>
              <Tonight plan={plan} isLastDay={plan.date === trip.end_date} />
              <Transport plan={plan} />
              <Activities plan={plan} />
            </>
          )}
          <DialogFooter>
            <PlanFooter tripId={tripId} />
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function PlanDayOf({ day, total }: { day: number; total: number }) {
  const { t } = useTranslation('calendar');
  return <span>{t('dayOfTrip', { day, total })}</span>;
}

function PlanFooter({ tripId }: { tripId: string }) {
  const { t } = useTranslation('calendar');
  return (
    <Button asChild variant="outline">
      <Link to="/trips/$tripId" params={{ tripId }}>
        <Route aria-hidden />
        {t('openItinerary')}
      </Link>
    </Button>
  );
}

function PlaceLine({ plan }: { plan: DayPlan }) {
  const { t } = useTranslation('calendar');
  const { place } = plan;
  const chip =
    'inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold';
  if (place.kind === 'city') {
    const color = place.stop.stop.color_index;
    return (
      <span className={cn(chip, cityFill(color), cityInk(color))}>
        <MapPin className="size-4" aria-hidden />
        {place.stop.place?.name ?? '?'}
      </span>
    );
  }
  if (place.kind === 'travel') {
    return (
      <span
        className={cn(chip, 'text-foreground')}
        style={travelFill(place.from.stop.color_index, place.to.stop.color_index)}
      >
        <Route className="size-4" aria-hidden />
        {t('travelDay', { from: place.from.place?.name, to: place.to.place?.name })}
      </span>
    );
  }
  return <span>{t(place.kind === 'free' ? 'free' : 'outside')}</span>;
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Clock;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <h3 className="inline-flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

const empty = 'text-sm text-muted-foreground';
const row = 'grid gap-0.5 rounded-lg border px-3 py-2 text-sm';

function Tonight({ plan, isLastDay }: { plan: DayPlan; isLastDay: boolean }) {
  const { t } = useTranslation('calendar');
  return (
    <Section icon={BedDouble} title={t('tonight')}>
      {plan.stays.length === 0 ? (
        <p className={empty}>{isLastDay ? t('lastDay') : t('noStay')}</p>
      ) : (
        <ul className="grid gap-2">
          {plan.stays.map(({ stay, checkIn }) => (
            <li key={stay.id} className={cn(row, 'flex items-center justify-between gap-2')}>
              <span className="min-w-0 font-medium break-words">{stay.name}</span>
              {checkIn ? <Badge variant="info">{t('checkInToday')}</Badge> : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Transport({ plan }: { plan: DayPlan }) {
  const { t } = useTranslation('calendar');
  if (plan.legs.length === 0 && plan.place.kind !== 'travel') return null;
  return (
    <Section icon={Route} title={t('transportTitle')}>
      {plan.legs.length === 0 ? (
        <p className={empty}>{t('noLeg')}</p>
      ) : (
        <ul className="grid gap-2">
          {plan.legs.map((dayLeg) => (
            <LegRow key={dayLeg.leg.id} dayLeg={dayLeg} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function LegRow({ dayLeg }: { dayLeg: DayLeg }) {
  const { t, i18n } = useTranslation('calendar');
  const { t: tt } = useTranslation('trips');
  const { leg, from, to, departs, arrives } = dayLeg;
  const language = i18n.language;
  const Icon = MODE_ICONS[leg.mode];

  const end = (
    at: string | null | undefined,
    tz: string | null | undefined,
    today: boolean,
    sameDay: string,
    otherDay: string,
  ) => {
    if (!at || !tz) return null;
    const time = formatZonedTime(at, tz, language);
    return today
      ? t(sameDay, { time })
      : t(otherDay, { time, date: shortDate(zonedParts(at, tz).date, language) });
  };
  const times = [
    end(leg.depart_at, leg.depart_tz, departs, 'departs', 'departedOn'),
    end(leg.arrive_at, leg.arrive_tz, arrives, 'arrives', 'arrivesOn'),
  ].filter(Boolean);

  return (
    <li className={row}>
      <span className="inline-flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0 text-sky" aria-hidden />
        {t('route', { from: from?.place?.name ?? '?', to: to?.place?.name ?? '?' })}
      </span>
      <span className="text-muted-foreground">
        {[tt(`mode_${leg.mode}`), [leg.carrier, leg.number].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(' · ')}
      </span>
      {times.length ? (
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <Clock className="size-3.5 text-muted-foreground" aria-hidden />
          {times.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      ) : null}
    </li>
  );
}

function Activities({ plan }: { plan: DayPlan }) {
  const { t } = useTranslation('calendar');
  return (
    <Section icon={Sparkles} title={t('activitiesTitle')}>
      {plan.activities.length === 0 ? (
        <p className={empty}>{t('noActivities')}</p>
      ) : (
        <ul className="grid gap-2">
          {plan.activities.map((activity) => (
            <li key={activity.id} className={cn(row, 'grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2')}>
              <span className="font-semibold tabular-nums text-muted-foreground">
                {activity.start_time ? activity.start_time.slice(0, 5) : t('anyTime')}
              </span>
              <span className="grid gap-1">
                <span className="font-medium break-words">{activity.title}</span>
                {activity.needs_booking && !activity.booked ? (
                  <Badge variant="soft">
                    <Ticket aria-hidden />
                    {t('toBook')}
                  </Badge>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
