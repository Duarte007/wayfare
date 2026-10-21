import { computeGaps, daysBetween, type Gap, type Leg, type Trip } from '@wayfare/shared';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  BedDouble,
  BookUser,
  Bus,
  CalendarDays,
  Car,
  CircleCheck,
  FileText,
  Hourglass,
  Loader2,
  Lock,
  MapPin,
  MapPinned,
  Moon,
  Pencil,
  Plane,
  Plus,
  Route,
  Ship,
  ShieldAlert,
  Sparkles,
  Ticket,
  Trash2,
  TrainFront,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateRange, localToday } from '@/shared/lib/dates';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { IconTile } from '@/shared/ui/ui';
import { activityCounts } from '../../itinerary/domain/activity';
import { ActivityList } from '../../itinerary/ui/ActivityList';
import { AddCityDialog } from '../../itinerary/ui/AddCityDialog';
import { CityActionsMenu } from '../../itinerary/ui/CityActionsMenu';
import { LegDialog } from '../../itinerary/ui/LegDialog';
import { StayDialog } from '../../itinerary/ui/StayDialog';
import { formatZonedTime } from '@/shared/lib/timezone';
import { useAuth } from '../../auth/application/AuthProvider';
import { useTripMembers } from '../../members/application/MembersProvider';
import type { TripMember } from '../../members/domain/members';
import { useRemoveTrip, useTripDetails } from '../application/useTripDetails';
import {
  buildItinerary,
  tripPhase,
  type ItineraryStop,
  type TripDetails,
} from '../domain/trip-overview';

export function TripPage() {
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
      <>
        <BackToTrips />
        <Card className="border-dashed shadow-none">
          <CardContent className="grid justify-items-center gap-3 py-4 text-center">
            <IconTile icon={MapPinned} size="lg" />
            <h1 className="text-xl font-bold">{t('notFoundTitle')}</h1>
            <p className="max-w-sm text-muted-foreground">{t('notFound')}</p>
          </CardContent>
        </Card>
      </>
    );
  }
  return <TripOverview details={details} />;
}

function BackToTrips() {
  const { t } = useTranslation('nav');
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
      <Link to="/">
        <ArrowLeft aria-hidden />
        {t('trips')}
      </Link>
    </Button>
  );
}

function TripOverview({ details }: { details: TripDetails }) {
  const { t, i18n } = useTranslation('trips');
  const { t: tn } = useTranslation('nav');
  const { t: tcal } = useTranslation('calendar');
  const { trip } = details;
  const { session } = useAuth();
  const members = useTripMembers(trip.id);
  const itinerary = buildItinerary(details);
  const nightsTotal = itinerary.length ? itinerary.reduce((sum, s) => sum + s.nights, 0) : null;

  return (
    <>
      <BackToTrips />

      <header className="grid gap-4 sm:flex sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <IconTile icon={MapPinned} tone="sky" />
          <div className="grid min-w-0 gap-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight break-words">{trip.name}</h1>
            <p className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {formatDateRange(trip.start_date, trip.end_date, i18n.language)}
            </p>
            <PhaseBadge trip={trip} />
          </div>
        </div>
        <TripActions trip={trip} />
      </header>

      <section aria-label={t('summary')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={MapPin} value={itinerary.length} labelKey="statCities" />
        <Stat
          icon={Moon}
          value={nightsTotal ?? daysBetween(trip.start_date, trip.end_date)}
          labelKey="statNights"
        />
        <Stat icon={BedDouble} value={details.stays.length} labelKey="statStays" />
        <Stat icon={FileText} value={details.documents.length} labelKey="statDocuments" />
      </section>

      <MissingCard details={details} itinerary={itinerary} />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{tn('itinerary')}</h2>
          </CardTitle>
          {itinerary.length > 0 ? (
            <CardAction className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/trips/$tripId/calendar" params={{ tripId: trip.id }}>
                  <CalendarDays aria-hidden />
                  <span className="sr-only sm:not-sr-only">{tcal('open')}</span>
                </Link>
              </Button>
              <AddCityDialog details={details} />
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {itinerary.length === 0 ? (
            <div className="grid justify-items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
              <Route className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-semibold">{t('itineraryEmptyTitle')}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{t('itineraryEmpty')}</p>
              <AddCityDialog details={details} first />
            </div>
          ) : (
            <ol className="grid min-w-0">
              {itinerary.map((item, index) => (
                <ItineraryItem
                  key={item.stop.id}
                  item={item}
                  next={itinerary[index + 1]}
                  members={members}
                  currentUserId={session?.userId}
                  actions={
                    <CityActionsMenu
                      details={details}
                      item={item}
                      index={index}
                      count={itinerary.length}
                    />
                  }
                />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PhaseBadge({ trip }: { trip: Trip }) {
  const { t } = useTranslation('trips');
  const phase = tripPhase(trip, localToday());
  if (phase.phase === 'upcoming') {
    return (
      <Badge variant="soft">
        <Hourglass aria-hidden />
        {t('daysToGo', { count: phase.daysToGo })}
      </Badge>
    );
  }
  if (phase.phase === 'ongoing') {
    return (
      <Badge>
        <Sparkles aria-hidden />
        {t('dayOf', { day: phase.day, total: phase.total })}
      </Badge>
    );
  }
  return <Badge variant="secondary">{t('tripPast')}</Badge>;
}

function TripActions({ trip }: { trip: Trip }) {
  const { t } = useTranslation('trips');
  const { t: tc } = useTranslation();
  const { session } = useAuth();
  const removeTrip = useRemoveTrip();
  const navigate = useNavigate();
  // The server only lets the owner delete a trip; members just don't see the button.
  const isOwner = session?.userId === trip.owner_id;

  return (
    <div className="flex shrink-0 gap-2">
      <Button asChild variant="outline">
        <Link to="/trips/$tripId/edit" params={{ tripId: trip.id }}>
          <Pencil aria-hidden />
          {t('edit')}
        </Link>
      </Button>
      {isOwner ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive" aria-label={t('deleteTrip')}>
              <Trash2 aria-hidden />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deleteTitle', { name: trip.name })}</AlertDialogTitle>
              <AlertDialogDescription>{t('deleteBody')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() =>
                  void removeTrip(trip).then(() => navigate({ to: '/', replace: true }))
                }
              >
                <Trash2 aria-hidden />
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  labelKey,
}: {
  icon: LucideIcon;
  value: number;
  labelKey: 'statCities' | 'statNights' | 'statStays' | 'statDocuments';
}) {
  const { t } = useTranslation('trips');
  return (
    <Card className="gap-1 py-4">
      <CardContent className="grid gap-1 px-4">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
        <p>
          <span className="block text-2xl font-extrabold tabular-nums">{value}</span>
          <span className="text-sm text-muted-foreground">{t(labelKey, { count: value })}</span>
        </p>
      </CardContent>
    </Card>
  );
}

const GAP_ICONS: Record<Gap['kind'], LucideIcon> = {
  missing_stay: BedDouble,
  missing_leg: Route,
  leg_without_ticket: Ticket,
  stay_without_voucher: FileText,
  activity_to_book: Ticket,
  missing_document: BookUser,
};

/** "What's still missing", computed on the device from the itinerary (works offline). */
function MissingCard({ details, itinerary }: { details: TripDetails; itinerary: ItineraryStop[] }) {
  const { t } = useTranslation('trips');
  const { t: tg } = useTranslation('gaps');
  const { t: tl } = useTranslation('labels');
  const gaps = computeGaps(details);
  const cityOf = (stopId: string) =>
    itinerary.find((s) => s.stop.id === stopId)?.place?.name ?? '?';
  const legName = (leg: Leg | undefined) =>
    leg ? `${cityOf(leg.from_stop_id)} → ${cityOf(leg.to_stop_id)}` : '?';

  const describe = (gap: Gap): string => {
    switch (gap.kind) {
      case 'missing_stay':
        return tg('missing_stay', { count: gap.nights.length, city: cityOf(gap.stopId) });
      case 'missing_leg':
        return tg('missing_leg', { from: cityOf(gap.fromStopId), to: cityOf(gap.toStopId) });
      case 'leg_without_ticket':
        return tg('leg_without_ticket', {
          leg: legName(details.legs.find((l) => l.id === gap.legId)),
        });
      case 'stay_without_voucher':
        return tg('stay_without_voucher', {
          stay: details.stays.find((s) => s.id === gap.stayId)?.name ?? tl('stay'),
        });
      case 'activity_to_book':
        return tg('activity_to_book', {
          activity:
            details.activities.find((a) => a.id === gap.activityId)?.title ?? tl('activity'),
        });
      case 'missing_document':
        return tg(`missing_document_${gap.label}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="inline-flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" aria-hidden />
            {t('missingTitle')}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {gaps.length === 0 ? (
          <p className="inline-flex items-center gap-2 font-semibold text-success">
            <CircleCheck className="size-5" aria-hidden />
            {t('allSet')}
          </p>
        ) : (
          <ul className="grid gap-2">
            {gaps.map((gap, i) => {
              const Icon = GAP_ICONS[gap.kind];
              return (
                <li
                  key={`${gap.kind}-${i}`}
                  className="flex items-start gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {describe(gap)}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const MODE_ICONS: Record<Leg['mode'], LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  bus: Bus,
  ferry: Ship,
  car: Car,
  other: Route,
};

function legSummary(leg: Leg, t: (key: string) => string, locale: string): string {
  const times =
    leg.depart_at && leg.depart_tz
      ? `${formatZonedTime(leg.depart_at, leg.depart_tz, locale)}${
          leg.arrive_at && leg.arrive_tz
            ? ` → ${formatZonedTime(leg.arrive_at, leg.arrive_tz, locale)}`
            : ''
        }`
      : null;
  return [t(`mode_${leg.mode}`), [leg.carrier, leg.number].filter(Boolean).join(' '), times]
    .filter(Boolean)
    .join(' · ');
}

function ItineraryItem({
  item,
  next,
  members,
  currentUserId,
  actions,
}: {
  item: ItineraryStop;
  next: ItineraryStop | undefined;
  members: TripMember[];
  currentUserId: string | undefined;
  actions: ReactNode;
}) {
  const { t, i18n } = useTranslation('trips');
  const { t: ti } = useTranslation('itinerary');
  const { stop, place, nights, stays, activities, legToNext, isLast } = item;
  const city = place?.name ?? '—';
  const ModeIcon = legToNext ? MODE_ICONS[legToNext.mode] : Route;
  const counts = activityCounts(activities);

  return (
    <li className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
      {/* Timeline rail: a dot per city, a line down to the next one. */}
      <div className="flex flex-col items-center">
        <span
          className="mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-primary bg-card"
          aria-hidden
        />
        {isLast ? null : <span className="w-px flex-1 bg-border" aria-hidden />}
      </div>
      <div className={isLast ? 'grid min-w-0 gap-2' : 'grid min-w-0 gap-2 pb-6'}>
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
            <h3 className="text-lg font-bold">{place?.name ?? '—'}</h3>
            {place?.name_local ? (
              <span className="text-muted-foreground" lang="und">
                {place.name_local}
              </span>
            ) : null}
          </div>
          <div className="-mt-2 -mr-2 shrink-0">{actions}</div>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" aria-hidden />
            {formatDateRange(stop.start_date, stop.end_date, i18n.language)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Moon className="size-4" aria-hidden />
            {t('nights', { count: nights })}
          </span>
          {counts.total > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-4" aria-hidden />
              {t('activities', { count: counts.total })}
              {counts.toBook > 0 ? (
                <span className="font-medium text-primary">
                  · {t('toBook', { count: counts.toBook })}
                </span>
              ) : null}
            </span>
          ) : null}
        </p>
        <ul className="grid min-w-0 gap-1.5">
          {stays.map((stay) => (
            // Long hotel names truncate; on phones the dates go under the name.
            <li key={stay.id} className="min-w-0">
              <StayDialog
                stop={stop}
                city={city}
                existing={stay}
                trigger={
                  <button
                    type="button"
                    aria-label={ti('editStayNamed', { name: stay.name })}
                    className="flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <BedDouble className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="grid min-w-0 flex-1 gap-0.5 sm:flex sm:items-center sm:justify-between sm:gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium">{stay.name}</span>
                        {stay.visibility === 'private' ? (
                          <Lock
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-label={ti('private')}
                          />
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground sm:shrink-0 sm:text-sm">
                        {formatDateRange(stay.check_in, stay.check_out, i18n.language)}
                      </span>
                    </span>
                  </button>
                }
              />
            </li>
          ))}
          <li>
            <StayDialog
              stop={stop}
              city={city}
              trigger={
                <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
                  <Plus aria-hidden />
                  {ti('addStay')}
                </Button>
              }
            />
          </li>
        </ul>
        <ActivityList
          stop={stop}
          city={city}
          activities={activities}
          members={members}
          currentUserId={currentUserId}
        />
        {next ? (
          <LegDialog
            from={item}
            to={next}
            existing={legToNext}
            trigger={
              <button
                type="button"
                className={
                  legToNext
                    ? 'inline-flex w-fit max-w-full min-w-0 items-center gap-2 rounded-full bg-sky-soft px-3 py-1.5 text-left text-sm font-medium text-sky transition hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'
                    : 'inline-flex w-fit items-center gap-2 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'
                }
              >
                <ModeIcon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">
                  {legToNext ? legSummary(legToNext, t, i18n.language) : t('noLeg')}
                </span>
              </button>
            }
          />
        ) : null}
      </div>
    </li>
  );
}
