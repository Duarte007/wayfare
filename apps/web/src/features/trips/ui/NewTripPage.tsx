import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { IconTile } from '@/shared/ui/ui';
import { TripForm } from './TripForm';

export function NewTripPage() {
  const { t } = useTranslation('trips');
  const { t: tn } = useTranslation('nav');
  const navigate = useNavigate();

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

      <TripForm
        submitLabel={t('createTrip')}
        cancelTo={{ to: '/' }}
        // Straight into the new trip, where the next steps live.
        onSaved={(tripId) => void navigate({ to: '/trips/$tripId', params: { tripId } })}
      />
    </>
  );
}
