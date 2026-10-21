import { Loader2, MapPinned } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMapsDependencies } from '../application/MapsProvider';
import type { MapPlace } from '../domain/map-places';
import type { MapView } from '../domain/map-ports';
import type { BBox, LngLat } from '../domain/tiles';

/** The trip's colour scheme, as styles.css resolves it. */
function prefersDark(): boolean {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export interface MapFocus {
  point: LngLat;
  /** Changes on every request, so tapping the same place twice flies there again. */
  nonce: number;
}

interface TripMapProps {
  places: readonly MapPlace[];
  bounds: BBox;
  selectedId: string | null;
  focus: MapFocus | null;
  label: string;
  onSelect: (id: string | null) => void;
  onMove: (visible: BBox) => void;
  /** Shown over the map (the "not downloaded" notice, the selected place). */
  children?: ReactNode;
}

/** The interactive map; the library loads on demand and is mounted once per page. */
export function TripMap({
  places,
  bounds,
  selectedId,
  focus,
  label,
  onSelect,
  onMove,
  children,
}: TripMapProps) {
  const { t, i18n } = useTranslation('maps');
  const { loadRenderer } = useMapsDependencies();
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<MapView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  // Latest callbacks and fit target, read by the map without remounting it.
  const latest = useRef({ onSelect, onMove, bounds });
  useEffect(() => {
    latest.current = { onSelect, onMove, bounds };
  });

  const language = i18n.language;
  useEffect(() => {
    let cancelled = false;
    loadRenderer()
      .then((renderer) => {
        if (cancelled || !container.current) return;
        view.current = renderer.mount(container.current, {
          language,
          dark: prefersDark(),
          ariaLabel: label,
          onSelect: (id) => latest.current.onSelect(id),
          onMove: (visible) => latest.current.onMove(visible),
        });
        view.current.fitTo(latest.current.bounds);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
      view.current?.destroy();
      view.current = null;
    };
  }, [loadRenderer, language, label]);

  useEffect(() => {
    if (state === 'ready') view.current?.setPlaces(places, selectedId);
  }, [state, places, selectedId]);

  useEffect(() => {
    if (state === 'ready' && focus) view.current?.flyTo(focus.point);
  }, [state, focus]);

  return (
    <div className="relative h-[55dvh] min-h-72 overflow-hidden rounded-xl border bg-muted">
      {/* Sized, not absolutely placed: MapLibre makes its container `position: relative`. */}
      <div ref={container} className="size-full" />
      {state === 'loading' ? (
        <p
          role="status"
          className="absolute inset-0 grid place-content-center justify-items-center gap-2 text-muted-foreground"
        >
          <Loader2 className="size-6 animate-spin" aria-hidden />
          {t('loadingMap')}
        </p>
      ) : null}
      {state === 'failed' ? (
        <div
          role="alert"
          className="absolute inset-0 grid place-content-center justify-items-center gap-2 p-6 text-center text-muted-foreground"
        >
          <MapPinned className="size-8" aria-hidden />
          <p className="max-w-xs">{t('mapFailed')}</p>
        </div>
      ) : null}
      {state === 'ready' ? children : null}
    </div>
  );
}
