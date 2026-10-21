import type { ChecklistItem } from '@wayfare/shared';
import { Link, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  CircleAlert,
  Clock,
  ListChecks,
  Loader2,
  Lock,
  MapPinned,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localToday } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { IconTile } from '@/shared/ui/ui';
import { useAuth } from '../../auth/application/AuthProvider';
import { useTripMembers } from '../../members/application/MembersProvider';
import type { TripMember } from '../../members/domain/members';
import { useChecklist, useToggleDone, type ChecklistView } from '../application/useChecklist';
import { dueStatus, type ChecklistSection } from '../domain/checklist';
import { ChecklistItemDialog } from './ChecklistItemDialog';
import { SuggestionsDialog } from './SuggestionsDialog';

export function ChecklistPage() {
  const { t } = useTranslation('checklist');
  const { t: tc } = useTranslation();
  const { tripId } = useParams({ strict: false }) as { tripId: string };
  const view = useChecklist(tripId);

  if (view === undefined) {
    return (
      <p className="inline-flex items-center gap-2 text-muted-foreground" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {tc('loading')}
      </p>
    );
  }
  if (view === null) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="grid justify-items-center gap-3 py-4 text-center">
          <IconTile icon={MapPinned} size="lg" />
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <p className="max-w-sm text-muted-foreground">{t('notFound')}</p>
        </CardContent>
      </Card>
    );
  }
  return <Checklist view={view} />;
}

function Checklist({ view }: { view: ChecklistView }) {
  const { t } = useTranslation('checklist');
  const { session } = useAuth();
  const members = useTripMembers(view.trip.id);
  const { trip, items, progress, suggestions } = view;
  const shared = { tripId: trip.id, items, members, currentUserId: session?.userId };

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
        <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
          <ArrowLeft aria-hidden />
          {t('backToTrip')}
        </Link>
      </Button>

      <header className="grid gap-4 sm:flex sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <IconTile icon={ListChecks} />
          <div className="grid min-w-0 gap-1">
            <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
            <p className="break-words text-muted-foreground">
              {trip.name}
              {progress.total > 0
                ? ` · ${t('progress', { done: progress.done, total: progress.total })}`
                : null}
            </p>
          </div>
        </div>
        {items.length > 0 ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {suggestions.items.length > 0 && !suggestions.prominent ? (
              <SuggestionsDialog
                view={view}
                trigger={
                  <Button variant="outline">
                    <Sparkles aria-hidden />
                    {t('suggestOpen')}
                  </Button>
                }
              />
            ) : null}
            <ChecklistItemDialog
              {...shared}
              trigger={
                <Button>
                  <Plus aria-hidden />
                  {t('addItem')}
                </Button>
              }
            />
          </div>
        ) : null}
      </header>

      {progress.total > 0 ? (
        <div
          role="progressbar"
          aria-label={t('progress', { done: progress.done, total: progress.total })}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-success transition-[width]"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="grid justify-items-center gap-3 py-4 text-center">
            <ListChecks className="size-8 text-muted-foreground" aria-hidden />
            <h2 className="font-semibold">{t('emptyTitle')}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">{t('emptyBody')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.items.length > 0 ? (
                <SuggestionsDialog
                  view={view}
                  trigger={
                    <Button>
                      <Sparkles aria-hidden />
                      {t('suggestOpen')}
                    </Button>
                  }
                />
              ) : null}
              <ChecklistItemDialog
                {...shared}
                trigger={
                  <Button variant="outline">
                    <Plus aria-hidden />
                    {t('addItem')}
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {suggestions.prominent ? (
            <Card className="gap-3 border-primary/40 bg-accent py-4 shadow-none">
              <CardContent className="grid gap-3 px-4 sm:flex sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Sparkles className="mt-0.5 size-5 shrink-0 text-accent-foreground" aria-hidden />
                  <div className="grid gap-0.5">
                    <p className="font-semibold text-accent-foreground">
                      {t('suggestBanner', { count: suggestions.items.length })}
                    </p>
                    <p className="text-sm text-foreground">{t('suggestBannerBody')}</p>
                  </div>
                </div>
                <SuggestionsDialog
                  view={view}
                  trigger={<Button className="shrink-0">{t('suggestOpen')}</Button>}
                />
              </CardContent>
            </Card>
          ) : null}
          {view.sections.map((section) => (
            <SectionCard key={section.group} section={section} shared={shared} />
          ))}
        </>
      )}
    </>
  );
}

interface Shared {
  tripId: string;
  items: ChecklistItem[];
  members: TripMember[];
  currentUserId: string | undefined;
}

function SectionCard({ section, shared }: { section: ChecklistSection; shared: Shared }) {
  const { t } = useTranslation('checklist');
  const name = t(`groups.${section.group}`);
  const done = section.items.filter((i) => i.done).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-baseline gap-2">
            {name}
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              {done}/{section.items.length}
            </span>
          </h2>
        </CardTitle>
        <CardAction>
          <ChecklistItemDialog
            {...shared}
            group={section.group}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="-mt-2 -mr-2 text-muted-foreground"
                aria-label={t('addItemTo', { name })}
              >
                <Plus aria-hidden />
              </Button>
            }
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="grid min-w-0 gap-1.5">
          {section.items.map((item) => (
            <ItemRow key={item.id} item={item} shared={shared} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ItemRow({ item, shared }: { item: ChecklistItem; shared: Shared }) {
  const { t, i18n } = useTranslation('checklist');
  const toggleDone = useToggleDone();
  const status = dueStatus(item, localToday());
  const { members, currentUserId } = shared;

  const due = item.due_date
    ? t('dueOn', {
        date: new Intl.DateTimeFormat(i18n.language, {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(`${item.due_date}T00:00Z`)),
      })
    : null;
  const forWhom =
    item.assignees.length > 0
      ? new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
          item.assignees.map((id) =>
            id === currentUserId
              ? t('you')
              : (members.find((m) => m.userId === id)?.name ?? t('unnamedMember')),
          ),
        )
      : null;

  return (
    <li
      className={cn(
        'flex min-w-0 items-center rounded-lg border',
        status === 'overdue' && 'border-destructive/60',
        status === 'soon' && 'border-primary/50',
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center">
        <Checkbox
          checked={item.done}
          aria-label={t('doneNamed', { name: item.title })}
          onCheckedChange={(done) => void toggleDone(item, done === true)}
        />
      </span>
      <ChecklistItemDialog
        {...shared}
        existing={item}
        trigger={
          <button
            type="button"
            aria-label={t('editItemNamed', { name: item.title })}
            className="grid min-h-11 min-w-0 flex-1 content-center gap-0.5 rounded-lg py-2 pr-3 text-left text-sm transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex min-w-0 items-start gap-1.5">
              <span
                className={cn(
                  'min-w-0 font-medium break-words',
                  item.done && 'text-muted-foreground line-through',
                )}
              >
                {item.title}
              </span>
              {item.visibility === 'private' ? (
                <Lock
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-label={t('private')}
                />
              ) : null}
            </span>
            {due || forWhom ? (
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {status === 'overdue' ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                    <CircleAlert className="size-3.5" aria-hidden />
                    {t('overdue')} · {due}
                  </span>
                ) : status === 'soon' ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-primary">
                    <Clock className="size-3.5" aria-hidden />
                    {t('dueSoon')} · {due}
                  </span>
                ) : due ? (
                  <span>{due}</span>
                ) : null}
                {forWhom ? <span>{forWhom}</span> : null}
              </span>
            ) : null}
          </button>
        }
      />
    </li>
  );
}
