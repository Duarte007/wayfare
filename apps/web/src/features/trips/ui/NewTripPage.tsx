import { daysBetween } from '@wayfare/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Moon, PenLine, Plane } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { DateRangeField } from '@/shared/ui/DateRangeField';
import { Field, IconTile } from '@/shared/ui/ui';
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
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
        <Link to="/">
          <ArrowLeft aria-hidden />
          {tn('trips')}
        </Link>
      </Button>

      <header className="flex items-start gap-4">
        <IconTile icon={Plane} />
        <div className="grid gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('newTrip')}</h1>
          <p className="max-w-md text-muted-foreground">{t('newTripSubtitle')}</p>
        </div>
      </header>

      <Card>
        <CardContent>
          <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-5">
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

            <div className="grid gap-2">
              <DateRangeField
                label={t('dates')}
                placeholder={t('datesPlaceholder')}
                from={input.startDate}
                to={input.endDate}
                onChange={({ from, to }) => update({ startDate: from, endDate: to })}
                error={datesError}
              />
              {nights !== null ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Moon className="size-4" aria-hidden />
                  {t('nights', { count: nights })}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" size="lg" disabled={saving}>
                {t('createTrip')}
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link to="/">{tc('cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
