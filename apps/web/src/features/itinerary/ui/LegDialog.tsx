import type { Leg } from '@wayfare/shared';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Bus,
  Car,
  Clock,
  Hash,
  Plane,
  Route,
  Ship,
  TrainFront,
  Trash2,
} from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { allTimeZones } from '@/shared/lib/timezone';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { Field } from '@/shared/ui/ui';
import type { ItineraryStop } from '../../trips/domain/trip-overview';
import { useLegForm } from '../application/useLegForm';
import type { TransportMode } from '../domain/leg';

export const MODE_ICONS: Record<TransportMode, LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  bus: Bus,
  ferry: Ship,
  car: Car,
  other: Route,
};
const MODES = Object.keys(MODE_ICONS) as TransportMode[];

/** How you get from one city to the next; `trigger` is the chip on the timeline. */
export function LegDialog({
  from,
  to,
  existing,
  trigger,
}: {
  from: ItineraryStop;
  to: ItineraryStop;
  existing: Leg | null;
  trigger: ReactNode;
}) {
  const { t } = useTranslation('itinerary');
  const { t: tt } = useTranslation('trips');
  const { t: tc } = useTranslation();
  const [open, setOpen] = useState(false);
  const form = useLegForm(from, to, existing);
  const sharedId = useId();
  const modeId = useId();
  const { input, update, errors } = form;
  const fromName = from.place?.name ?? '—';
  const toName = to.place?.name ?? '—';
  // The travel day is around the change of city; allow a few days either side for night trains.
  const bounds = { from: from.stop.start_date, to: to.stop.end_date };

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
          <DialogTitle>{t('legTitle', { from: fromName, to: toName })}</DialogTitle>
          <DialogDescription>{t('legHint')}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-5">
          <div className="grid gap-2">
            <Label id={modeId}>{t('legMode')}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              aria-labelledby={modeId}
              value={input.mode}
              onValueChange={(mode) => mode && update({ mode: mode as TransportMode })}
              className="grid w-full grid-cols-3"
            >
              {MODES.map((mode) => {
                const Icon = MODE_ICONS[mode];
                return (
                  <ToggleGroupItem key={mode} value={mode} className="gap-1.5">
                    <Icon aria-hidden />
                    {tt(`mode_${mode}`)}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('carrier')}
              icon={Building2}
              placeholder={t('carrierPlaceholder')}
              value={input.carrier}
              onChange={(e) => update({ carrier: e.target.value })}
              maxLength={100}
              autoComplete="off"
            />
            <Field
              label={t('legNumber')}
              icon={Hash}
              placeholder="CA1405 · G8501"
              value={input.number}
              onChange={(e) => update({ number: e.target.value })}
              error={errors.includes('number_too_long') ? t('legErrorNumber') : undefined}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>
          <LegEnd
            title={t('departure', { city: fromName })}
            date={input.departDate}
            time={input.departTime}
            tz={input.departTz}
            bounds={bounds}
            onChange={(p) => update({ departDate: p.date, departTime: p.time, departTz: p.tz })}
          />
          <LegEnd
            title={t('arrival', { city: toName })}
            date={input.arriveDate}
            time={input.arriveTime}
            tz={input.arriveTz}
            bounds={bounds}
            error={errors.includes('arrive_before_depart') ? t('legErrorArrival') : undefined}
            onChange={(p) => update({ arriveDate: p.date, arriveTime: p.time, arriveTz: p.tz })}
          />
          <Field
            label={t('bookingRef')}
            icon={Hash}
            value={input.bookingRef}
            onChange={(e) => update({ bookingRef: e.target.value })}
            maxLength={100}
            autoComplete="off"
          />
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
                    {t('removeLeg')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('removeLegTitle', { from: fromName, to: toName })}
                    </AlertDialogTitle>
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
            <Button type="submit" size="lg" disabled={form.saving || errors.length > 0}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Day, local time and time zone of one end of the leg. */
function LegEnd({
  title,
  date,
  time,
  tz,
  bounds,
  error,
  onChange,
}: {
  title: string;
  date: string;
  time: string;
  tz: string;
  bounds: { from: string; to: string };
  error?: string;
  onChange: (p: { date: string; time: string; tz: string }) => void;
}) {
  const { t } = useTranslation('itinerary');
  const timeId = useId();
  const tzId = useId();
  const errorId = useId();
  return (
    <fieldset className="grid gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-bold">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <DateField
          label={t('day')}
          placeholder={t('day')}
          value={date}
          bounds={bounds}
          onChange={(d) => onChange({ date: d, time, tz })}
        />
        <div className="grid gap-2">
          <Label htmlFor={timeId}>{t('time')}</Label>
          <div className="relative">
            <Clock
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id={timeId}
              type="time"
              className="pl-9"
              value={time}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => onChange({ date, time: e.target.value, tz })}
            />
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={tzId}>{t('timeZone')}</Label>
        <Select value={tz} onValueChange={(zone) => onChange({ date, time, tz: zone })}>
          <SelectTrigger id={tzId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allTimeZones().map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
