import { layers, namedFlavor } from '@protomaps/basemaps';
import {
  addProtocol,
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type MapOptions,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 finds its worker next to its own file, which a bundler moves; point it at ours.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { MapPlace } from '../domain/map-places';
import type { MapRenderer, MapView, MapViewOptions } from '../domain/map-ports';
import { MAP_PROTOCOL, STYLE_URLS, type createOfflineLoader } from './offline-loader';

type Style = Exclude<MapOptions['style'], string | undefined>;

/** App language → the `name:<lang>` the Protomaps tiles carry. */
function labelLanguage(language: string): string {
  if (language.startsWith('zh')) return 'zh-Hans';
  return language.split('-')[0] ?? 'en';
}

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>';

function buildStyle(language: string, dark: boolean): Style {
  const flavor = dark ? 'dark' : 'light';
  return {
    version: 8,
    glyphs: STYLE_URLS.glyphs,
    sprite: STYLE_URLS.sprite(flavor),
    sources: {
      protomaps: {
        type: 'vector',
        tiles: [STYLE_URLS.tiles],
        // The basemap's deepest zoom; MapLibre overzooms past it.
        maxzoom: 15,
        attribution: ATTRIBUTION,
      },
    },
    layers: layers('protomaps', namedFlavor(flavor), { lang: labelLanguage(language) }),
  } as Style;
}

const KIND_SIZE = { city: 32, stay: 26, activity: 22 } as const;

/** A marker is a real button, so it can be reached by keyboard and has a name. */
function markerElement(place: MapPlace, selected: boolean, onSelect: (id: string) => void) {
  const button = document.createElement('button');
  button.type = 'button';
  const color = place.colorIndex % 8;
  const size = KIND_SIZE[place.kind];
  button.setAttribute('aria-label', place.title);
  button.setAttribute('aria-pressed', String(selected));
  button.dataset.kind = place.kind;
  // Tokens from styles.css: each city's soft fill and the ink that reads on it.
  Object.assign(button.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: place.kind === 'stay' ? '8px' : '9999px',
    background: place.kind === 'city' ? `var(--city-${color}-ink)` : `var(--city-${color})`,
    color: place.kind === 'city' ? `var(--city-${color})` : `var(--city-${color}-ink)`,
    border: `2px solid ${place.kind === 'city' ? 'var(--card)' : `var(--city-${color}-ink)`}`,
    boxShadow: selected
      ? '0 0 0 3px var(--ring), 0 1px 4px rgb(0 0 0 / 0.3)'
      : '0 1px 4px rgb(0 0 0 / 0.3)',
    font: '700 13px/1 system-ui, sans-serif',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    padding: '0',
  });
  // An invisible ring widens the touch target to 44px without a bigger dot.
  const hit = document.createElement('span');
  Object.assign(hit.style, { position: 'absolute', inset: `${(size - 44) / 2}px` });
  hit.setAttribute('aria-hidden', 'true');
  button.append(hit);
  if (place.kind === 'city') {
    const number = document.createElement('span');
    number.textContent = String(place.cityNumber);
    number.setAttribute('aria-hidden', 'true');
    button.append(number);
  }
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect(place.id);
  });
  return button;
}

let protocolRegistered = false;

/** MapLibre GL with the Protomaps basemap, every request answered by the offline loader. */
export class MapLibreRenderer implements MapRenderer {
  constructor(load: ReturnType<typeof createOfflineLoader>) {
    if (!protocolRegistered) {
      setWorkerUrl(workerUrl);
      addProtocol(MAP_PROTOCOL, async (params, abortController) => ({
        data: await load(params.url, abortController.signal),
      }));
      protocolRegistered = true;
    }
  }

  mount(container: HTMLElement, options: MapViewOptions): MapView {
    const map = new MapLibreMap({
      container,
      style: buildStyle(options.language, options.dark),
      center: [0, 20],
      zoom: 1,
      maxZoom: 18,
      attributionControl: false,
      // Chinese, Japanese and Korean labels use the device's fonts: no glyph downloads.
      localIdeographFontFamily: 'sans-serif',
      cooperativeGestures: false,
    });
    map.addControl(new AttributionControl({ compact: true }));
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    // Missing tiles offline are expected (the area isn't downloaded); the page says so instead.
    map.on('error', () => undefined);
    map.on('moveend', () => {
      const b = map.getBounds();
      options.onMove({
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      });
    });
    map.on('click', () => options.onSelect(null));
    // The canvas is the drawing surface; the places are listed beside it for screen readers.
    map.getCanvas().setAttribute('aria-label', options.ariaLabel);
    map.getCanvas().setAttribute('role', 'img');

    let markers: Marker[] = [];
    return {
      setPlaces(places, selectedId) {
        for (const m of markers) m.remove();
        // Cities on top of their stays and activities.
        const ordered = [...places].sort(
          (a, b) => Number(a.kind === 'city') - Number(b.kind === 'city'),
        );
        markers = ordered.map((place) =>
          new Marker({
            element: markerElement(place, place.id === selectedId, (id) => options.onSelect(id)),
          })
            .setLngLat([place.lng, place.lat])
            .addTo(map),
        );
      },
      fitTo(bbox) {
        const bounds = new LngLatBounds([bbox.west, bbox.south], [bbox.east, bbox.north]);
        map.fitBounds(bounds, { padding: 56, maxZoom: 12, duration: 0 });
      },
      flyTo(point) {
        map.flyTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 12) });
      },
      destroy() {
        map.remove();
      },
    };
  }
}
