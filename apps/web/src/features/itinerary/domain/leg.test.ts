import { legSchema, type Place, type Stop } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { buildLeg, emptyLegInput, legToInput, validateLeg } from './leg';

const place = (id: string, country: string): Place => ({
  id,
  trip_id: 't',
  name: id,
  lat: 0,
  lng: 0,
  country_code: country,
});
const stop = {
  id: 's1',
  trip_id: 't',
  place_id: 'pek',
  position: 0,
  color_index: 0,
  start_date: '2026-10-23',
  end_date: '2026-11-02',
  visibility: 'group',
  assignees: [],
} as Stop;
const ctx = {
  id: crypto.randomUUID(),
  tripId: crypto.randomUUID(),
  fromStopId: crypto.randomUUID(),
  toStopId: crypto.randomUUID(),
  createdBy: crypto.randomUUID(),
};

describe('leg rules', () => {
  it('defaults to the travel day, train within a country, flight across, local zones', () => {
    const domestic = emptyLegInput(
      { stop, place: place('pek', 'CN') },
      { place: place('ctu', 'CN') },
    );
    expect(domestic).toMatchObject({
      mode: 'train',
      departDate: '2026-11-02',
      departTz: 'Asia/Shanghai',
      arriveTz: 'Asia/Shanghai',
    });
    const abroad = emptyLegInput(
      { stop, place: place('sha', 'CN') },
      { place: place('lis', 'PT') },
    );
    expect(abroad).toMatchObject({
      mode: 'flight',
      departTz: 'Asia/Shanghai',
      arriveTz: 'Europe/Lisbon',
    });
  });

  it('compares arrival with departure across time zones', () => {
    const base = emptyLegInput({ stop, place: place('sha', 'CN') }, { place: place('lis', 'PT') });
    // 23:55 in Shanghai = 15:55 in Lisbon: arriving at 07:00 Lisbon the next day is fine…
    expect(
      validateLeg({ ...base, departTime: '23:55', arriveDate: '2026-11-03', arriveTime: '07:00' }),
    ).toEqual([]);
    // …but 15:00 Lisbon the same day is before take-off.
    expect(validateLeg({ ...base, departTime: '23:55', arriveTime: '15:00' })).toEqual([
      'arrive_before_depart',
    ]);
    expect(validateLeg({ ...base, number: 'X'.repeat(21) })).toEqual(['number_too_long']);
  });

  it('builds a schema-valid row; times stay empty until known; round-trips through the form', () => {
    const input = {
      ...emptyLegInput({ stop, place: place('pek', 'CN') }, { place: place('ctu', 'CN') }),
      mode: 'flight' as const,
      carrier: ' Air China ',
      number: 'ca1405',
      departTime: '08:30',
      arriveTime: '11:35',
      shared: false,
    };
    const leg = buildLeg(input, ctx);
    expect(leg).toMatchObject({
      carrier: 'Air China',
      number: 'CA1405',
      depart_at: '2026-11-02T08:30:00+08:00',
      depart_tz: 'Asia/Shanghai',
      arrive_at: '2026-11-02T11:35:00+08:00',
      visibility: 'private',
    });
    expect(legSchema.safeParse(leg).success).toBe(true);
    expect(buildLeg({ ...input, departTime: '', arriveTime: '' }, ctx)).toMatchObject({
      depart_at: null,
      depart_tz: null,
      arrive_at: null,
    });
    expect(legToInput(leg, input)).toMatchObject({
      departTime: '08:30',
      arriveTime: '11:35',
      number: 'CA1405',
      shared: false,
    });
  });
});
