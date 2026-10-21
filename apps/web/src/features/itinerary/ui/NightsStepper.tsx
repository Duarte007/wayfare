import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { MAX_NIGHTS, MIN_NIGHTS } from '../domain/itinerary-plan';

/** − n + with big touch targets; the count is announced when it changes. */
export function NightsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const { t } = useTranslation('itinerary');
  const { t: tt } = useTranslation('trips');
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label id={id}>{t('nights')}</Label>
      <div role="group" aria-labelledby={id} className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label={t('fewerNights')}
          disabled={value <= MIN_NIGHTS}
          onClick={() => onChange(Math.max(MIN_NIGHTS, value - 1))}
        >
          <Minus aria-hidden />
        </Button>
        <output aria-live="polite" className="min-w-24 text-center text-lg font-bold tabular-nums">
          {tt('nights', { count: value })}
        </output>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('moreNights')}
          disabled={value >= MAX_NIGHTS}
          onClick={() => onChange(Math.min(MAX_NIGHTS, value + 1))}
        >
          <Plus aria-hidden />
        </Button>
      </div>
    </div>
  );
}
