import type { Trip } from '@wayfare/shared';

export interface NewTripInput {
  name: string;
  /** YYYY-MM-DD, as given by <input type="date">. */
  startDate: string;
  endDate: string;
}

export type NewTripError =
  'name_required' | 'name_too_long' | 'dates_required' | 'end_before_start';

export const TRIP_NAME_MAX = 120;

/** Rules shared by the form (inline errors) and the save (never stores an invalid trip). */
export function validateNewTrip(input: NewTripInput): NewTripError[] {
  const errors: NewTripError[] = [];
  const name = input.name.trim();
  if (!name) errors.push('name_required');
  else if (name.length > TRIP_NAME_MAX) errors.push('name_too_long');
  if (!input.startDate || !input.endDate) errors.push('dates_required');
  else if (input.endDate < input.startDate) errors.push('end_before_start');
  return errors;
}

export function buildTrip(input: NewTripInput, ownerId: string, id: string): Trip {
  return {
    id,
    owner_id: ownerId,
    name: input.name.trim(),
    start_date: input.startDate,
    end_date: input.endDate,
  };
}
