import type {
  Activity,
  DocumentLabel,
  DocumentLink,
  Leg,
  Place,
  Stay,
  Stop,
  TransportMode,
} from '@wayfare/shared';

/** What a document can be attached to from the app (a city's links aren't offered yet). */
export type LinkEntityType = Extract<DocumentLink['entity_type'], 'stay' | 'leg' | 'activity'>;

export interface LinkEntity {
  type: LinkEntityType;
  id: string;
}

/** A link as written: the server row also needs the trip (for its member policies). */
export interface NewDocumentLink extends DocumentLink {
  trip_id: string;
}

/** One stay, leg or activity of the trip, as the "Linked to" list shows it. */
export type LinkTarget =
  | { type: 'stay'; id: string; name: string; city: string }
  | {
      type: 'leg';
      id: string;
      from: string;
      to: string;
      mode: TransportMode;
      /** "Air China CA1234", "G1", or "" when not known yet. */
      service: string;
    }
  | { type: 'activity'; id: string; name: string; city: string };

export interface LinkableItinerary {
  stops: readonly Stop[];
  places: readonly Place[];
  stays: readonly Stay[];
  legs: readonly Leg[];
  activities: readonly Activity[];
}

export const LINK_GROUPS: readonly LinkEntityType[] = ['stay', 'leg', 'activity'];

/** Everything a document can be linked to, in travel order (cities, then dates). */
export function linkTargets(itinerary: LinkableItinerary): LinkTarget[] {
  const stops = [...itinerary.stops].sort((a, b) => a.position - b.position);
  const order = new Map(stops.map((s, i) => [s.id, i]));
  const cityOf = (stopId: string) => {
    const stop = stops.find((s) => s.id === stopId);
    return itinerary.places.find((p) => p.id === stop?.place_id)?.name ?? '—';
  };
  const byCity = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0);

  const stays = [...itinerary.stays]
    .sort((a, b) => byCity(a.stop_id, b.stop_id) || a.check_in.localeCompare(b.check_in))
    .map((s): LinkTarget => ({ type: 'stay', id: s.id, name: s.name, city: cityOf(s.stop_id) }));
  const legs = [...itinerary.legs]
    .sort((a, b) => byCity(a.from_stop_id, b.from_stop_id))
    .map((l): LinkTarget => ({
      type: 'leg',
      id: l.id,
      from: cityOf(l.from_stop_id),
      to: cityOf(l.to_stop_id),
      mode: l.mode,
      service: [l.carrier, l.number].filter(Boolean).join(' '),
    }));
  const activities = [...itinerary.activities]
    .sort(
      (a, b) =>
        byCity(a.stop_id, b.stop_id) ||
        (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
        a.title.localeCompare(b.title),
    )
    .map((a): LinkTarget => ({
      type: 'activity',
      id: a.id,
      name: a.title,
      city: cityOf(a.stop_id),
    }));
  return [...stays, ...legs, ...activities];
}

const MODE_LABELS: Record<TransportMode, DocumentLabel> = {
  flight: 'flight',
  train: 'train',
  bus: 'bus_ferry',
  ferry: 'bus_ferry',
  car: 'other',
  other: 'other',
};

/** The type a new document attached to this stay, leg or activity most likely has. */
export function labelFor(
  entity: { type: 'stay' | 'activity' } | { type: 'leg'; mode: TransportMode },
): DocumentLabel {
  if (entity.type === 'leg') return MODE_LABELS[entity.mode];
  return entity.type;
}

export function buildLink(documentId: string, tripId: string, entity: LinkEntity): NewDocumentLink {
  return {
    document_id: documentId,
    entity_type: entity.type,
    entity_id: entity.id,
    trip_id: tripId,
  };
}

export function isLinkedTo(link: DocumentLink, entity: LinkEntity): boolean {
  return link.entity_type === entity.type && link.entity_id === entity.id;
}

/**
 * The documents attached to a stay, leg or activity, by title. Links to documents that aren't on
 * this device (another member's private ones) are left out.
 */
export function documentsLinkedTo<D extends { id: string; title: string }>(
  documents: readonly D[],
  links: readonly DocumentLink[],
  entity: LinkEntity,
  locale?: string,
): D[] {
  const ids = new Set(links.filter((l) => isLinkedTo(l, entity)).map((l) => l.document_id));
  return documents
    .filter((d) => ids.has(d.id))
    .sort((a, b) => a.title.localeCompare(b.title, locale));
}

/** The document's links whose stay, leg or activity is still on the device, in travel order. */
export function targetsOf(
  documentId: string,
  links: readonly DocumentLink[],
  targets: readonly LinkTarget[],
): LinkTarget[] {
  const linked = links.filter((l) => l.document_id === documentId);
  return targets.filter((t) => linked.some((l) => isLinkedTo(l, t)));
}

/** How many documents each stay, leg or activity has (by `${type}:${id}`), for the timeline. */
export function linkCounts(
  documents: readonly { id: string }[],
  links: readonly DocumentLink[],
): Map<string, number> {
  const present = new Set(documents.map((d) => d.id));
  const counts = new Map<string, number>();
  for (const link of links) {
    if (!present.has(link.document_id)) continue;
    const key = `${link.entity_type}:${link.entity_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
