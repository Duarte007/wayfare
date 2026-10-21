import {
  AlertCircle,
  BedDouble,
  CircleCheck,
  Download,
  MapPin,
  Ticket,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { cityFill, cityInk } from '../../calendar/ui/city-colors';
import { formatSize } from '../../documents/ui/document-display';
import type { OfflineAreas } from '../application/useOfflineAreas';
import type { MapPlace, MapPlaceKind } from '../domain/map-places';

export const KIND_ICONS: Record<MapPlaceKind, LucideIcon> = {
  city: MapPin,
  stay: BedDouble,
  activity: Ticket,
};

const ERROR_KEYS = {
  failed: 'errorFailed',
  no_space: 'errorNoSpace',
  too_large: 'errorTooLarge',
} as const;

export function CityBadge({ place, className }: { place: MapPlace; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
        cityFill(place.colorIndex),
        cityInk(place.colorIndex),
        className,
      )}
      aria-hidden
    >
      {place.cityNumber}
    </span>
  );
}

interface PlaceListProps {
  places: readonly MapPlace[];
  offline: boolean;
  offlineAreas: OfflineAreas;
  selectedId: string | null;
  onShow: (place: MapPlace) => void;
}

/**
 * Every place on the map as a list (the canvas is invisible to screen readers), with each
 * city's offline download next to it.
 */
export function PlaceList({ places, offline, offlineAreas, selectedId, onShow }: PlaceListProps) {
  const cities = places.filter((p) => p.kind === 'city');
  return (
    <ol className="grid gap-3">
      {cities.map((city) => (
        <CityRow
          key={city.id}
          city={city}
          inside={places.filter((p) => p.kind !== 'city' && p.stopId === city.stopId)}
          offline={offline}
          offlineAreas={offlineAreas}
          selectedId={selectedId}
          onShow={onShow}
        />
      ))}
    </ol>
  );
}

function CityRow({
  city,
  inside,
  offline,
  offlineAreas,
  selectedId,
  onShow,
}: {
  city: MapPlace;
  /** The city's stays and activities that have a place. */
  inside: MapPlace[];
} & Omit<PlaceListProps, 'places'>) {
  const { t, i18n } = useTranslation('maps');
  const size = (bytes: number) => formatSize(bytes, i18n.language);
  const area = offlineAreas.areas?.find((a) => a.placeId === city.placeId);
  const active = offlineAreas.active?.placeId === city.placeId ? offlineAreas.active : null;
  const busy = offlineAreas.active !== null;
  const error = offlineAreas.error?.placeId === city.placeId ? offlineAreas.error.kind : null;
  const { planFor } = offlineAreas;
  // Planning lists ~700 tiles: once per city, not on every progress tick.
  const estimate = useMemo(() => planFor(city).estimatedBytes, [planFor, city]);

  let status: string;
  if (area) status = t('downloaded', { size: size(area.bytes) });
  else if (active)
    status = t('downloading', {
      done: active.progress.done,
      total: active.progress.total,
      size: size(active.progress.bytes),
    });
  else status = offline ? t('notDownloadedTitle') : t('estimate', { size: size(estimate) });

  return (
    <li className="grid gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onShow(city)}
          aria-label={t('showOnMap', { name: city.title })}
          aria-pressed={selectedId === city.id}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <CityBadge place={city} />
          <span className="grid min-w-0">
            <span className="font-semibold break-words">{city.title}</span>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              {area ? <CircleCheck className="size-4 text-success" aria-hidden /> : null}
              {status}
            </span>
          </span>
        </button>
        {area ? (
          <Button
            variant="ghost"
            aria-label={t('removeLabel', { name: city.title })}
            onClick={() => void offlineAreas.remove(city.placeId)}
          >
            <Trash2 aria-hidden />
            <span className="sr-only sm:not-sr-only">{t('remove')}</span>
          </Button>
        ) : active ? (
          <Button variant="outline" onClick={offlineAreas.cancel}>
            <X aria-hidden />
            {t('cancel')}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={offline || busy}
            aria-label={offline ? undefined : t('downloadLabel', { name: city.title })}
            onClick={() => void offlineAreas.download(city)}
          >
            <Download aria-hidden />
            {offline ? t('needsConnection') : t('download')}
          </Button>
        )}
      </div>
      {active ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={t('downloadLabel', { name: city.title })}
          aria-valuemin={0}
          aria-valuemax={active.progress.total}
          aria-valuenow={active.progress.done}
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width]"
            style={{
              width: `${(active.progress.done / Math.max(1, active.progress.total)) * 100}%`,
            }}
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="inline-flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {t(ERROR_KEYS[error])}
        </p>
      ) : null}
      {inside.length > 0 ? (
        <ul className="grid gap-1 border-t pt-2">
          {inside.map((place) => {
            const Icon = KIND_ICONS[place.kind];
            return (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => onShow(place)}
                  aria-pressed={selectedId === place.id}
                  className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg px-1 text-left text-sm hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 break-words">{place.title}</span>
                  <span className="sr-only">
                    {' · '}
                    {t(place.kind === 'stay' ? 'kindStay' : 'kindActivity')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
