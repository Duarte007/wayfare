import { Link } from '@tanstack/react-router';
import { Map as MapIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';

/** The itinerary header's way into the trip map. */
export function MapLink({ tripId }: { tripId: string }) {
  const { t } = useTranslation('maps');
  return (
    <Button asChild variant="outline">
      <Link to="/trips/$tripId/map" params={{ tripId }}>
        <MapIcon aria-hidden />
        <span className="sr-only sm:not-sr-only">{t('open')}</span>
      </Link>
    </Button>
  );
}
