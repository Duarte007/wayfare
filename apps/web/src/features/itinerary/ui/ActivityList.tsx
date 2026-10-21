import type { Activity, Stop } from '@wayfare/shared';
import { ExternalLink, Lock, Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { AttachedCount } from '../../documents/ui/AttachedCount';
import type { TripMember } from '../../members/domain/members';
import { useToggleBooked } from '../application/useActivityForm';
import { sortActivities } from '../domain/activity';
import { ActivityDialog } from './ActivityDialog';

/** A city's things to do on the timeline: tick bookings off, open one to edit, add more. */
export function ActivityList({
  stop,
  city,
  activities,
  members,
  currentUserId,
  documentCount,
}: {
  stop: Stop;
  city: string;
  activities: Activity[];
  members: TripMember[];
  currentUserId: string | undefined;
  /** Documents attached to an activity, for the paperclip. */
  documentCount?: (activityId: string) => number;
}) {
  const { t, i18n } = useTranslation('itinerary');
  const toggleBooked = useToggleBooked();
  const shared = { stop, city, members, currentUserId };

  const when = (a: Activity) => {
    if (!a.date) return null;
    const day = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${a.date}T00:00Z`));
    if (!a.start_time) return day;
    const time = new Intl.DateTimeFormat(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(`1970-01-01T${a.start_time.slice(0, 5)}:00Z`));
    return `${day} · ${time}`;
  };
  const forWhom = (a: Activity) => {
    if (a.assignees.length === 0) return null;
    const names = a.assignees.map((id) => {
      const m = members.find((x) => x.userId === id);
      return id === currentUserId ? t('you') : (m?.name ?? t('unnamedMember'));
    });
    return new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(names);
  };

  return (
    <ul className="grid min-w-0 gap-1.5">
      {sortActivities(activities).map((a) => {
        const meta = [when(a), forWhom(a)].filter(Boolean).join(' · ');
        return (
          <li key={a.id} className="flex min-w-0 items-center rounded-lg border">
            <span className="flex size-11 shrink-0 items-center justify-center">
              {a.needs_booking ? (
                <Checkbox
                  checked={a.booked}
                  aria-label={t('bookedNamed', { name: a.title })}
                  onCheckedChange={(booked) => void toggleBooked(a, booked === true)}
                />
              ) : (
                <Sparkles className="size-4 text-muted-foreground" aria-hidden />
              )}
            </span>
            <ActivityDialog
              {...shared}
              existing={a}
              trigger={
                <button
                  type="button"
                  aria-label={t('editActivityNamed', { name: a.title })}
                  className="grid min-h-11 min-w-0 flex-1 content-center gap-0.5 rounded-lg py-2 pr-3 text-left text-sm transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium">{a.title}</span>
                    {a.visibility === 'private' ? (
                      <Lock
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label={t('private')}
                      />
                    ) : null}
                    <AttachedCount
                      count={documentCount?.(a.id) ?? 0}
                      className="text-muted-foreground"
                    />
                  </span>
                  {meta || a.needs_booking ? (
                    <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      {meta ? <span>{meta}</span> : null}
                      {a.needs_booking ? (
                        <span
                          className={
                            a.booked ? 'font-medium text-success' : 'font-medium text-primary'
                          }
                        >
                          {a.booked ? t('booked') : t('needsBooking')}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              }
            />
            {a.url ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground"
              >
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('openLinkNamed', { name: a.title })}
                >
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            ) : null}
          </li>
        );
      })}
      <li>
        <ActivityDialog
          {...shared}
          trigger={
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
              <Plus aria-hidden />
              {t('addActivity')}
            </Button>
          }
        />
      </li>
    </ul>
  );
}
