import type { Stay, Stop, Visibility } from '@wayfare/shared';

export interface StayInput {
  name: string;
  checkIn: string;
  checkOut: string;
  bookingRef: string;
  bookingUrl: string;
  notes: string;
  /** false keeps the stay private to whoever added it. */
  shared: boolean;
}

export type StayError =
  'name_required' | 'dates_required' | 'no_nights' | 'outside_city' | 'url_invalid';

export const STAY_NAME_MAX = 200;

/** A new stay covers the whole city by default, the most common case. */
export function emptyStayInput(stop: Pick<Stop, 'start_date' | 'end_date'>): StayInput {
  return {
    name: '',
    checkIn: stop.start_date,
    checkOut: stop.end_date,
    bookingRef: '',
    bookingUrl: '',
    notes: '',
    shared: true,
  };
}

export function stayToInput(stay: Stay): StayInput {
  return {
    name: stay.name,
    checkIn: stay.check_in,
    checkOut: stay.check_out,
    bookingRef: stay.booking_ref ?? '',
    bookingUrl: stay.booking_url ?? '',
    notes: stay.notes ?? '',
    shared: stay.visibility !== 'private',
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateStay(
  input: StayInput,
  stop: Pick<Stop, 'start_date' | 'end_date'>,
): StayError[] {
  const errors: StayError[] = [];
  if (!input.name.trim()) errors.push('name_required');
  if (!input.checkIn || !input.checkOut) errors.push('dates_required');
  else if (input.checkOut <= input.checkIn) errors.push('no_nights');
  else if (input.checkIn < stop.start_date || input.checkOut > stop.end_date)
    errors.push('outside_city');
  if (input.bookingUrl.trim() && !isHttpUrl(input.bookingUrl.trim())) errors.push('url_invalid');
  return errors;
}

/** Empty optional fields are stored as null, never as "". */
export function buildStay(
  input: StayInput,
  context: { id: string; tripId: string; stopId: string; createdBy: string },
  existing?: Stay,
): Stay {
  const optional = (v: string) => v.trim() || null;
  const visibility: Visibility = input.shared ? 'group' : 'private';
  return {
    ...(existing ?? { assignees: [] }),
    id: context.id,
    trip_id: context.tripId,
    stop_id: context.stopId,
    created_by: existing?.created_by ?? context.createdBy,
    name: input.name.trim().slice(0, STAY_NAME_MAX),
    check_in: input.checkIn,
    check_out: input.checkOut,
    booking_ref: optional(input.bookingRef),
    booking_url: optional(input.bookingUrl),
    notes: optional(input.notes),
    visibility,
  };
}
