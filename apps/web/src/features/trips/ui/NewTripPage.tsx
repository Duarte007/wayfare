import { daysBetween } from '@wayfare/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, CalendarDays, Moon, PenLine, Plane } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, buttonClass, Field, IconTile } from '../../../shared/ui/ui';
import { useCreateTrip } from '../application/useCreateTrip';
import { TRIP_NAME_MAX, type NewTripError } from '../domain/new-trip';

const ERROR_KEYS = {
  name_required: 'errorNameRequired',
  name_too_long: 'errorNameTooLong',
  dates_required: 'errorDatesRequired',
  end_before_start: 'errorEndBeforeStart',
} as const satisfies Record<NewTripError, string>;

export function NewTripPage() {
  const { t } = useTranslation('trips');
  const { t: tn } = useTranslation('nav');
  const { t: tc } = useTranslation();
  const navigate = useNavigate();
  const { input, update, errors, saving, submit } = useCreateTrip();

  const errorFor = (...codes: NewTripError[]) => {
    const code = errors.find((e) => codes.includes(e));
    return code ? t(ERROR_KEYS[code], { max: TRIP_NAME_MAX }) : undefined;
  };
  const datesError = errorFor('dates_required', 'end_before_start');
  const nights =
    input.startDate && input.endDate && input.endDate >= input.startDate
      ? daysBetween(input.startDate, input.endDate)
      : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const id = await submit();
    if (id) await navigate({ to: '/' });
  };

  return (
    <>
      <Link to="/" className={buttonClass('link', 'w-fit gap-1.5 text-sm text-muted no-underline')}>
        <ArrowLeft className="size-4" aria-hidden />
        {tn('trips')}
      </Link>

      <header className="flex items-start gap-4">
        <IconTile icon={Plane} />
        <div className="grid gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('newTrip')}</h1>
          <p className="max-w-md text-muted">{t('newTripSubtitle')}</p>
        </div>
      </header>

      <form
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="grid gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-sm sm:p-6"
      >
        <Field
          label={t('tripName')}
          icon={PenLine}
          placeholder={t('tripNamePlaceholder')}
          value={input.name}
          onChange={(e) => update({ name: e.target.value })}
          error={errorFor('name_required', 'name_too_long')}
          maxLength={TRIP_NAME_MAX}
          autoComplete="off"
          autoFocus
        />

        <div className="grid gap-1.5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('startDate')}
              icon={CalendarDays}
              type="date"
              value={input.startDate}
              onChange={(e) => {
                const startDate = e.target.value;
                // Picking the first day also suggests it as the last, a common starting point.
                update(input.endDate ? { startDate } : { startDate, endDate: startDate });
              }}
              aria-invalid={datesError && !input.startDate ? true : undefined}
            />
            <Field
              label={t('endDate')}
              icon={CalendarDays}
              type="date"
              min={input.startDate || undefined}
              value={input.endDate}
              onChange={(e) => update({ endDate: e.target.value })}
              error={datesError}
            />
          </div>
          {nights !== null ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-muted">
              <Moon className="size-4" aria-hidden />
              {t('nights', { count: nights })}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" disabled={saving}>
            {t('createTrip')}
          </Button>
          <Link to="/" className={buttonClass('ghost')}>
            {tc('cancel')}
          </Link>
        </div>
      </form>
    </>
  );
}
