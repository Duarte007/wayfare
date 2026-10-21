import { tripSchema } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { buildTrip, validateNewTrip } from './new-trip';

const valid = { name: '  Family holiday ', startDate: '2027-01-10', endDate: '2027-01-20' };

describe('validateNewTrip', () => {
  it('accepts a named trip with ordered dates, including a same-day trip', () => {
    expect(validateNewTrip(valid)).toEqual([]);
    expect(validateNewTrip({ ...valid, endDate: valid.startDate })).toEqual([]);
  });

  it('reports every problem at once', () => {
    expect(validateNewTrip({ name: '   ', startDate: '', endDate: '' })).toEqual([
      'name_required',
      'dates_required',
    ]);
    expect(validateNewTrip({ ...valid, endDate: '2027-01-09' })).toEqual(['end_before_start']);
    expect(validateNewTrip({ ...valid, name: 'x'.repeat(121) })).toEqual(['name_too_long']);
  });
});

describe('buildTrip', () => {
  it('produces a trip the shared schema accepts, with a trimmed name', () => {
    const trip = buildTrip(valid, crypto.randomUUID(), crypto.randomUUID());
    expect(trip.name).toBe('Family holiday');
    expect(tripSchema.safeParse(trip).success).toBe(true);
  });
});
