import { daysBetween, type Trip } from '@wayfare/shared';
import { Link } from '@tanstack/react-router';
import { Moon, PenLine } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { DateRangeField } from '@/shared/ui/DateRangeField';
import { Field } from '@/shared/ui/ui';
import { useTripForm } from '../application/useTripForm';
import { TRIP_NAME_MAX, type NewTripError } from '../domain/new-trip';

const ERROR_KEYS = {
  name_required: 'errorNameRequired',
  name_too_long: 'errorNameTooLong',
  dates_required: 'errorDatesRequired',
  end_before_start: 'errorEndBeforeStart',
} as const satisfies Record<NewTripError, string>;

/** Name and dates of a trip; used to create one and to edit one. */
export function TripForm({
  existing,
  submitLabel,
  cancelTo,
  onSaved,
}: {
  existing?: Trip;
  submitLabel: string;
  cancelTo: { to: '/' } | { to: '/trips/$tripId'; params: { tripId: string } };
  onSaved: (tripId: string) => void;
}) {
  const { t } = useTranslation('trips');
  const { t: tc } = useTranslation();
  const { input, update, errors, saving, submit } = useTripForm(existing);

  const errorFor = (...codes: NewTripError[]) => {
    const code = errors.find((e) => codes.includes(e));
    return code ? t(ERROR_KEYS[code], { max: TRIP_NAME_MAX }) : undefined;
  };
  const nights =
    input.startDate && input.endDate && input.endDate >= input.startDate
      ? daysBetween(input.startDate, input.endDate)
      : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const id = await submit();
    if (id) onSaved(id);
  };

  return (
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
            autoFocus={!existing}
          />

          <div className="grid gap-2">
            <DateRangeField
              label={t('dates')}
              placeholder={t('datesPlaceholder')}
              from={input.startDate}
              to={input.endDate}
              onChange={({ from, to }) => update({ startDate: from, endDate: to })}
              error={errorFor('dates_required', 'end_before_start')}
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
              {submitLabel}
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link {...cancelTo}>{tc('cancel')}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
