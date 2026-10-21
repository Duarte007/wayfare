import { eachNight } from './dates.js';
import type { DocumentLink, DocumentLabel, Leg, Stay, Stop } from './schemas.js';

/**
 * "Still missing" items, computed on the device from the itinerary so they work offline and
 * can never go stale. Messages are translated in the UI from `kind` + `params`.
 */
export type Gap =
  | { kind: 'missing_stay'; stopId: string; nights: string[] }
  | { kind: 'missing_leg'; fromStopId: string; toStopId: string }
  | { kind: 'leg_without_ticket'; legId: string }
  | { kind: 'stay_without_voucher'; stayId: string }
  | { kind: 'missing_document'; label: Extract<DocumentLabel, 'passport' | 'insurance'> };

export interface GapInput {
  stops: readonly Pick<Stop, 'id' | 'start_date' | 'end_date' | 'position'>[];
  stays: readonly Pick<Stay, 'id' | 'stop_id' | 'check_in' | 'check_out'>[];
  legs: readonly Pick<Leg, 'id' | 'from_stop_id' | 'to_stop_id'>[];
  documents: readonly { id: string; label: DocumentLabel }[];
  links: readonly DocumentLink[];
}

export function computeGaps(input: GapInput): Gap[] {
  const gaps: Gap[] = [];
  const stops = [...input.stops].sort((a, b) => a.position - b.position);

  for (const stop of stops) {
    const covered = new Set(
      input.stays
        .filter((s) => s.stop_id === stop.id)
        .flatMap((s) => eachNight(s.check_in, s.check_out)),
    );
    const nights = eachNight(stop.start_date, stop.end_date).filter((n) => !covered.has(n));
    if (nights.length > 0) gaps.push({ kind: 'missing_stay', stopId: stop.id, nights });
  }

  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]!;
    const to = stops[i]!;
    const hasLeg = input.legs.some((l) => l.from_stop_id === from.id && l.to_stop_id === to.id);
    if (!hasLeg) gaps.push({ kind: 'missing_leg', fromStopId: from.id, toStopId: to.id });
  }

  const linked = (type: DocumentLink['entity_type'], id: string) =>
    input.links.some((l) => l.entity_type === type && l.entity_id === id);

  for (const leg of input.legs) {
    if (!linked('leg', leg.id)) gaps.push({ kind: 'leg_without_ticket', legId: leg.id });
  }
  for (const stay of input.stays) {
    if (!linked('stay', stay.id)) gaps.push({ kind: 'stay_without_voucher', stayId: stay.id });
  }

  for (const label of ['passport', 'insurance'] as const) {
    if (!input.documents.some((d) => d.label === label)) {
      gaps.push({ kind: 'missing_document', label });
    }
  }

  return gaps;
}
