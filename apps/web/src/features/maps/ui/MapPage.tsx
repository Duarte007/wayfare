import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, CloudOff, Loader2, Map as MapIcon, MapPinned, Route, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateRange } from '@/shared/lib/dates';
import { useOnline } from '@/shared/lib/online';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { IconTile } from '@/shared/ui/ui';
import { useTripDetails } from '../../trips/application/useTripDetails';
import { buildItinerary, type TripDetails } from '../../trips/domain/trip-overview';
import { useOfflineAreas } from '../application/useOfflineAreas';
import { boundsOf, mapPlaces, type MapPlace } from '../domain/map-places';
import { intersects, type BBox } from '../domain/tiles';
import { CityBadge, KIND_ICONS, PlaceList } from './PlaceList';
import { TripMap, type MapFocus } from './TripMap';

/** `/trips/$tripId/map`: the trip's places on a map, and each city's map for offline use. */
export function MapPage() {
  const { t } = useTranslation('trips');
  const { t: tc } = useTranslation();
  const { tripId } = useParams({ strict: false }) as { tripId: string };
  const details = useTripDetails(tripId);

  if (details === undefined) {
    return (
      <p className="inline-flex items-center gap-2 text-muted-foreground" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {tc('loading')}
      </p>
    );
  }
  if (details === null) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="grid justify-items-center gap-3 py-4 text-center">
          <IconTile icon={MapPinned} size="lg" />
          <h1 className="text-xl font-bold">{t('notFoundTitle')}</h1>
          <p className="max-w-sm text-muted-foreground">{t('notFound')}</p>
        </CardContent>
      </Card>
    );
  }
  return <TripMapScreen details={details} />;
}

function TripMapScreen({ details }: { details: TripDetails }) {
  const { t, i18n } = useTranslation('maps');
  const { trip } = details;
  const places = useMemo(() => mapPlaces(buildItinerary(details), details.places), [details]);
  const bounds = useMemo(() => boundsOf(places), [places]);
  const online = useOnline();
  const offlineAreas = useOfflineAreas(trip.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [visible, setVisible] = useState<BBox | null>(null);
  const selected = places.find((p) => p.id === selectedId) ?? null;

  const show = useCallback((place: MapPlace) => {
    setSelectedId(place.id);
    setFocus({ point: place, nonce: Date.now() });
    // The map is above the list; bring it into view on a phone.
    document.getElementById('trip-map')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const covered =
    visible !== null && (offlineAreas.areas ?? []).some((a) => intersects(a.bbox, visible));
  const notDownloaded = !online && visible !== null && offlineAreas.areas !== undefined && !covered;

  return (
    <>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit max-w-full text-muted-foreground"
      >
        <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
          <ArrowLeft aria-hidden />
          <span className="truncate">{trip.name}</span>
        </Link>
      </Button>

      <header className="flex min-w-0 items-start gap-4">
        <IconTile icon={MapIcon} tone="sky" />
        <div className="grid min-w-0 gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {formatDateRange(trip.start_date, trip.end_date, i18n.language)}
          </p>
        </div>
      </header>

      {!online ? (
        <Alert>
          <CloudOff aria-hidden />
          <AlertTitle>{t('offlineTitle')}</AlertTitle>
          <AlertDescription>{t('offlineBody')}</AlertDescription>
        </Alert>
      ) : null}

      {bounds === null ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="grid justify-items-center gap-2 text-center">
            <Route className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-semibold">{t('emptyTitle')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section id="trip-map" className="scroll-mt-4" aria-label={t('title')}>
            <TripMap
              places={places}
              bounds={bounds}
              selectedId={selectedId}
              focus={focus}
              label={t('mapLabel', { name: trip.name })}
              onSelect={setSelectedId}
              onMove={setVisible}
            >
              {notDownloaded ? (
                <div
                  role="status"
                  className="absolute inset-x-2 top-2 flex items-start gap-2 rounded-lg border bg-card/95 p-3 text-sm shadow-md sm:right-auto sm:max-w-sm"
                >
                  <CloudOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="grid gap-0.5">
                    <span className="font-semibold">{t('notDownloadedTitle')}</span>
                    <span className="text-muted-foreground">{t('notDownloadedBody')}</span>
                  </span>
                </div>
              ) : null}
              <div aria-live="polite" className="absolute inset-x-2 bottom-8">
                {selected ? (
                  <SelectedCard place={selected} onClose={() => setSelectedId(null)} />
                ) : null}
              </div>
            </TripMap>
          </section>

          <section className="grid gap-3" aria-labelledby="map-places-title">
            <div className="grid gap-1">
              <h2 id="map-places-title" className="text-lg font-bold">
                {t('placesTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('placesHint')}</p>
            </div>
            <PlaceList
              places={places}
              offline={!online}
              offlineAreas={offlineAreas}
              selectedId={selectedId}
              onShow={show}
            />
          </section>
        </>
      )}
    </>
  );
}

function SelectedCard({ place, onClose }: { place: MapPlace; onClose: () => void }) {
  const { t } = useTranslation('maps');
  const Icon = KIND_ICONS[place.kind];
  const kind = { city: 'kindCity', stay: 'kindStay', activity: 'kindActivity' } as const;
  return (
    <section
      aria-label={t('selectedTitle')}
      className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg sm:max-w-sm"
    >
      {place.kind === 'city' ? (
        <CityBadge place={place} />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
          <Icon className="size-4" />
        </span>
      )}
      <span className="grid min-w-0 flex-1">
        <span className="font-semibold break-words">{place.title}</span>
        <span className="text-sm text-muted-foreground">
          {place.kind === 'city'
            ? t('cityNumber', { number: place.cityNumber })
            : `${t(kind[place.kind])} · ${t('inCity', { city: place.cityName })}`}
        </span>
      </span>
      <Button variant="ghost" size="icon" aria-label={t('closeCard')} onClick={onClose}>
        <X aria-hidden />
      </Button>
    </section>
  );
}
