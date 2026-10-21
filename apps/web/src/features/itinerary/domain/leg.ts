import type { Leg, Place, Stop, TRANSPORT_MODES, Visibility } from '@wayfare/shared';
import { defaultTimeZone, toZonedIso, zonedParts } from '../../../shared/lib/timezone';

export type TransportMode = (typeof TRANSPORT_MODES)[number];

export interface LegInput {
  mode: TransportMode;
  carrier: string;
  number: string;
  departDate: string;
  /** "HH:mm" or "" when not known yet. */
  departTime: string;
  departTz: string;
  arriveDate: string;
  arriveTime: string;
  arriveTz: string;
  bookingRef: string;
  shared: boolean;
}

export type LegError = 'arrive_before_depart' | 'number_too_long';

/**
 * A new leg: travel day = the day you leave the first city; flight between countries,
 * train within one (the usual choice); each end in its city's time zone.
 */
export function emptyLegInput(
  from: { stop: Stop; place?: Place },
  to: { place?: Place },
): LegInput {
  const sameCountry = from.place && to.place && from.place.country_code === to.place.country_code;
  return {
    mode: sameCountry ? 'train' : 'flight',
    carrier: '',
    number: '',
    departDate: from.stop.end_date,
    departTime: '',
    departTz: defaultTimeZone(from.place?.country_code),
    arriveDate: from.stop.end_date,
    arriveTime: '',
    arriveTz: defaultTimeZone(to.place?.country_code),
    bookingRef: '',
    shared: true,
  };
}

export function legToInput(leg: Leg, fallback: LegInput): LegInput {
  const end = (
    at: string | null | undefined,
    tz: string | null | undefined,
    fb: { date: string; tz: string },
  ) => {
    const zone = tz || fb.tz;
    if (!at) return { date: fb.date, time: '', tz: zone };
    const { date, time } = zonedParts(at, zone);
    return { date, time, tz: zone };
  };
  const depart = end(leg.depart_at, leg.depart_tz, {
    date: fallback.departDate,
    tz: fallback.departTz,
  });
  const arrive = end(leg.arrive_at, leg.arrive_tz, {
    date: fallback.arriveDate,
    tz: fallback.arriveTz,
  });
  return {
    mode: leg.mode,
    carrier: leg.carrier ?? '',
    number: leg.number ?? '',
    departDate: depart.date,
    departTime: depart.time,
    departTz: depart.tz,
    arriveDate: arrive.date,
    arriveTime: arrive.time,
    arriveTz: arrive.tz,
    bookingRef: leg.booking_ref ?? '',
    shared: leg.visibility !== 'private',
  };
}

const instant = (date: string, time: string, tz: string) =>
  date && time ? toZonedIso(date, time, tz) : null;

export function validateLeg(input: LegInput): LegError[] {
  const errors: LegError[] = [];
  if (input.number.trim().length > 20) errors.push('number_too_long');
  const depart = instant(input.departDate, input.departTime, input.departTz);
  const arrive = instant(input.arriveDate, input.arriveTime, input.arriveTz);
  if (depart && arrive && Date.parse(arrive) < Date.parse(depart))
    errors.push('arrive_before_depart');
  return errors;
}

export function buildLeg(
  input: LegInput,
  context: { id: string; tripId: string; fromStopId: string; toStopId: string; createdBy: string },
  existing?: Leg,
): Leg {
  const optional = (v: string) => v.trim() || null;
  const visibility: Visibility = input.shared ? 'group' : 'private';
  const departAt = instant(input.departDate, input.departTime, input.departTz);
  const arriveAt = instant(input.arriveDate, input.arriveTime, input.arriveTz);
  return {
    ...(existing ?? { assignees: [] }),
    id: context.id,
    trip_id: context.tripId,
    from_stop_id: context.fromStopId,
    to_stop_id: context.toStopId,
    created_by: existing?.created_by ?? context.createdBy,
    mode: input.mode,
    carrier: optional(input.carrier),
    number: optional(input.number.toUpperCase()),
    depart_at: departAt,
    depart_tz: departAt ? input.departTz : null,
    arrive_at: arriveAt,
    arrive_tz: arriveAt ? input.arriveTz : null,
    booking_ref: optional(input.bookingRef),
    visibility,
  };
}
