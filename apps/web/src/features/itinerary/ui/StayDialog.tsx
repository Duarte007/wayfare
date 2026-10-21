import { daysBetween, type Stay, type Stop } from '@wayfare/shared';
import { BedDouble, Hash, Link2, Moon, Trash2 } from 'lucide-react';
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
import { DateRangeField } from '@/shared/ui/DateRangeField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
import { Separator } from '@/shared/ui/separator';
import { Field } from '@/shared/ui/ui';
import { labelFor } from '../../documents/domain/document-link';
import { EntityDocuments } from '../../documents/ui/EntityDocuments';
import { useStayForm } from '../application/useStayForm';
import { STAY_NAME_MAX, type StayError } from '../domain/stay';

const ERROR_KEYS = {
  name_required: 'stayErrorName',
  dates_required: 'stayErrorDates',
  no_nights: 'stayErrorNoNights',
  outside_city: 'stayErrorOutside',
  url_invalid: 'stayErrorUrl',
} as const satisfies Record<StayError, string>;

/** Add a stay to a city (no `existing`) or edit/remove one; `trigger` opens it. */
export function StayDialog({
  stop,
  city,
  existing,
  trigger,
}: {
  stop: Stop;
  city: string;
  existing?: Stay;
  trigger: ReactNode;
}) {
  const { t, i18n } = useTranslation('itinerary');
  const { t: tc } = useTranslation();
  const { t: tt } = useTranslation('trips');
  const [open, setOpen] = useState(false);
  const form = useStayForm(stop, existing);
  const notesId = useId();
  const sharedId = useId();
  const { input, update, errors } = form;

  const errorFor = (...codes: StayError[]) => {
    const code = errors.find((e) => codes.includes(e));
    return code ? t(ERROR_KEYS[code]) : undefined;
  };
  const nights =
    input.checkIn && input.checkOut > input.checkIn
      ? daysBetween(input.checkIn, input.checkOut)
      : null;

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
          <DialogTitle>{existing ? t('editStay') : t('addStayIn', { city })}</DialogTitle>
          <DialogDescription>
            {t('stayDatesHint', {
              range: new Intl.DateTimeFormat(i18n.language, {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              }).formatRange(
                new Date(`${stop.start_date}T00:00Z`),
                new Date(`${stop.end_date}T00:00Z`),
              ),
            })}
          </DialogDescription>
        </DialogHeader>
        {existing ? (
          <>
            {/* Outside the form: attaching opens dialogs with forms of their own. */}
            <EntityDocuments
              tripId={stop.trip_id}
              entity={{ type: 'stay', id: existing.id }}
              label={labelFor({ type: 'stay' })}
            />
            <Separator />
          </>
        ) : null}
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-5">
          <Field
            label={t('stayName')}
            icon={BedDouble}
            placeholder={t('stayNamePlaceholder')}
            value={input.name}
            onChange={(e) => update({ name: e.target.value })}
            error={errorFor('name_required')}
            maxLength={STAY_NAME_MAX}
            autoComplete="off"
            autoFocus={!existing}
          />
          <div className="grid gap-2">
            <DateRangeField
              label={t('stayDates')}
              placeholder={t('stayDates')}
              from={input.checkIn}
              to={input.checkOut}
              bounds={{ from: stop.start_date, to: stop.end_date }}
              onChange={({ from, to }) => update({ checkIn: from, checkOut: to })}
              error={errorFor('dates_required', 'no_nights', 'outside_city')}
            />
            {nights !== null ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Moon className="size-4" aria-hidden />
                {tt('nights', { count: nights })}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('bookingRef')}
              icon={Hash}
              value={input.bookingRef}
              onChange={(e) => update({ bookingRef: e.target.value })}
              maxLength={100}
              autoComplete="off"
            />
            <Field
              label={t('bookingUrl')}
              icon={Link2}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={input.bookingUrl}
              onChange={(e) => update({ bookingUrl: e.target.value })}
              error={errorFor('url_invalid')}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={notesId}>{t('notes')}</Label>
            <Textarea
              id={notesId}
              value={input.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder={t('stayNotesPlaceholder')}
              maxLength={5000}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
            <div className="grid gap-0.5">
              <Label htmlFor={sharedId}>{t('shareWithGroup')}</Label>
              <p className="text-sm text-muted-foreground">
                {input.shared ? t('sharedHint') : t('privateHint')}
              </p>
            </div>
            <Switch
              id={sharedId}
              checked={input.shared}
              onCheckedChange={(shared) => update({ shared })}
            />
          </div>
          <DialogFooter className="sm:justify-between">
            {existing ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive">
                    <Trash2 aria-hidden />
                    {t('removeStay')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('removeStayTitle', { name: existing.name })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{t('removeStayBody')}</AlertDialogDescription>
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
              {existing ? tc('save') : t('addStay')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
