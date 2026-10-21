import type { Activity, Stop } from '@wayfare/shared';
import { Link2, Sparkles, Trash2 } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { DateField } from '@/shared/ui/DateField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { Separator } from '@/shared/ui/separator';
import { Field } from '@/shared/ui/ui';
import { labelFor } from '../../documents/domain/document-link';
import { EntityDocuments } from '../../documents/ui/EntityDocuments';
import type { TripMember } from '../../members/domain/members';
import { useActivityForm } from '../application/useActivityForm';
import { ACTIVITY_TITLE_MAX, type ActivityError } from '../domain/activity';

const ERROR_KEYS = {
  title_required: 'activityErrorName',
  outside_city: 'activityErrorOutside',
  url_invalid: 'stayErrorUrl',
} as const satisfies Record<ActivityError, string>;

/** Add something to do in a city (no `existing`) or edit/remove one; `trigger` opens it. */
export function ActivityDialog({
  stop,
  city,
  members,
  currentUserId,
  existing,
  trigger,
}: {
  stop: Stop;
  city: string;
  /** Trip members; the "who is going" picker shows when there is more than one. */
  members: TripMember[];
  currentUserId: string | undefined;
  existing?: Activity;
  trigger: ReactNode;
}) {
  const { t } = useTranslation('itinerary');
  const { t: tc } = useTranslation();
  const [open, setOpen] = useState(false);
  const form = useActivityForm(stop, existing);
  const ids = {
    time: useId(),
    notes: useId(),
    shared: useId(),
    booking: useId(),
    booked: useId(),
    who: useId(),
  };
  const { input, update, errors } = form;

  const errorFor = (code: ActivityError) =>
    errors.includes(code) ? t(ERROR_KEYS[code]) : undefined;
  const memberName = (m: TripMember) =>
    m.userId === currentUserId ? t('you') : (m.name ?? t('unnamedMember'));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (await form.save()) setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{existing ? t('editActivity') : t('addActivityIn', { city })}</DialogTitle>
          <DialogDescription>{t('activityHint')}</DialogDescription>
        </DialogHeader>
        {existing ? (
          <>
            {/* Outside the form: attaching opens dialogs with forms of their own. */}
            <EntityDocuments
              tripId={existing.trip_id}
              entity={{ type: 'activity', id: existing.id }}
              label={labelFor({ type: 'activity' })}
            />
            <Separator />
          </>
        ) : null}
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-5">
          <Field
            label={t('activityName')}
            icon={Sparkles}
            placeholder={t('activityNamePlaceholder')}
            value={input.title}
            onChange={(e) => update({ title: e.target.value })}
            error={errorFor('title_required')}
            maxLength={ACTIVITY_TITLE_MAX}
            autoComplete="off"
            autoFocus={!existing}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <DateField
                label={t('day')}
                placeholder={t('noDate')}
                value={input.date}
                bounds={{ from: stop.start_date, to: stop.end_date }}
                clearLabel={t('clearDate')}
                onChange={(date) => update({ date, ...(date ? {} : { time: '' }) })}
              />
              {errorFor('outside_city') ? (
                <p className="text-sm font-medium text-destructive">{errorFor('outside_city')}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={ids.time}>{t('time')}</Label>
              <Input
                id={ids.time}
                type="time"
                value={input.time}
                disabled={!input.date}
                onChange={(e) => update({ time: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 rounded-lg border px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-0.5">
                <Label htmlFor={ids.booking}>{t('needsBooking')}</Label>
                <p className="text-sm text-muted-foreground">{t('needsBookingHint')}</p>
              </div>
              <Switch
                id={ids.booking}
                checked={input.needsBooking}
                onCheckedChange={(needsBooking) =>
                  update({ needsBooking, ...(needsBooking ? {} : { booked: false }) })
                }
              />
            </div>
            {input.needsBooking ? (
              <div className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={ids.booked}
                  checked={input.booked}
                  onCheckedChange={(booked) => update({ booked: booked === true })}
                />
                <Label htmlFor={ids.booked}>{t('booked')}</Label>
              </div>
            ) : null}
          </div>
          <Field
            label={t('activityUrl')}
            icon={Link2}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={input.url}
            onChange={(e) => update({ url: e.target.value })}
            error={errorFor('url_invalid')}
            autoComplete="off"
          />
          <div className="grid gap-2">
            <Label htmlFor={ids.notes}>{t('notes')}</Label>
            <Textarea
              id={ids.notes}
              value={input.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder={t('activityNotesPlaceholder')}
              maxLength={5000}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
            <div className="grid gap-0.5">
              <Label htmlFor={ids.shared}>{t('shareWithGroup')}</Label>
              <p className="text-sm text-muted-foreground">
                {input.shared ? t('sharedHint') : t('privateHint')}
              </p>
            </div>
            <Switch
              id={ids.shared}
              checked={input.shared}
              onCheckedChange={(shared) => update({ shared })}
            />
          </div>
          {input.shared && members.length > 1 ? (
            <div className="grid gap-2">
              <Label id={ids.who}>{t('forWhom')}</Label>
              <ToggleGroup
                type="multiple"
                variant="outline"
                aria-labelledby={ids.who}
                value={input.assignees}
                onValueChange={(assignees) => update({ assignees })}
                className="flex w-full flex-wrap justify-start"
              >
                {members.map((m) => (
                  <ToggleGroupItem key={m.userId} value={m.userId} className="px-4">
                    {memberName(m)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-sm text-muted-foreground">{t('forWhomHint')}</p>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            {existing ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive">
                    <Trash2 aria-hidden />
                    {t('removeActivity')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('removeActivityTitle', { name: existing.title })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{t('removeActivityBody')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => void form.remove().then(() => setOpen(false))}
                    >
                      {t('remove')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg" disabled={form.saving}>
              {existing ? tc('save') : t('addActivity')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
