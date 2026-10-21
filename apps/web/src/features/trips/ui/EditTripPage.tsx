import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { IconTile } from '@/shared/ui/ui';
import { useTripDetails } from '../application/useTripDetails';
import { TripForm } from './TripForm';

export function EditTripPage() {
  const { t } = useTranslation('trips');
  const { t: tc } = useTranslation();
  const { tripId } = useParams({ strict: false }) as { tripId: string };
  const navigate = useNavigate();
  const details = useTripDetails(tripId);
  const back = { to: '/trips/$tripId', params: { tripId } } as const;

  if (details === undefined) {
    return (
      <p className="inline-flex items-center gap-2 text-muted-foreground" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {tc('loading')}
      </p>
    );
  }
  if (details === null) return <p className="text-muted-foreground">{t('notFound')}</p>;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
        <Link {...back}>
          <ArrowLeft aria-hidden />
          {details.trip.name}
        </Link>
      </Button>
      <header className="flex items-start gap-4">
        <IconTile icon={Pencil} />
        <h1 className="text-3xl font-extrabold tracking-tight">{t('editTrip')}</h1>
      </header>
      <TripForm
        existing={details.trip}
        submitLabel={t('saveChanges')}
        cancelTo={back}
        onSaved={() => void navigate(back)}
      />
    </>
  );
}
