import type { Activity, Leg, Place, Stay, Stop } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { buildItinerary, type TripDetails } from '../../trips/domain/trip-overview';
import { dayPlan, daySummary, legDays, placeOn } from './day-plan';

const trip = {
  id: 't1',
  owner_id: 'u1',
  name: 'Test',
  start_date: '2027-05-30',
  end_date: '2027-06-08',
};

const place = (id: string, name: string): Place => ({
  id,
  trip_id: 't1',
  name,
  lat: 0,
  lng: 0,
  country_code: 'XX',
});

const stop = (id: string, position: number, start: string, end: string): Stop => ({
  id,
  trip_id: 't1',
  place_id: `p-${id}`,
  position,
  color_index: position,
  start_date: start,
  end_date: end,
  visibility: 'group',
  assignees: [],
});

const stay = (id: string, stopId: string, checkIn: string, checkOut: string): Stay => ({
  id,
  trip_id: 't1',
  stop_id: stopId,
  name: `Hotel ${id}`,
  check_in: checkIn,
  check_out: checkOut,
  visibility: 'group',
  assignees: [],
});

const leg = (id: string, from: string, to: string, extra: Partial<Leg> = {}): Leg => ({
  id,
  trip_id: 't1',
  from_stop_id: from,
  to_stop_id: to,
  mode: 'train',
  visibility: 'group',
  assignees: [],
  ...extra,
});

const activity = (
  id: string,
  stopId: string,
  date: string | null,
  time: string | null = null,
): Activity => ({
  id,
  trip_id: 't1',
  stop_id: stopId,
  title: `Activity ${id}`,
  date,
  start_time: time,
  needs_booking: false,
  booked: false,
  source: 'user',
  visibility: 'group',
  assignees: [],
});

// Alpha 3 nights (May 30 – Jun 2), Beta 3 nights (Jun 2 – 5), Gamma 3 nights (Jun 5 – 8).
const legs = [
  leg('l1', 'a', 'b', {
    mode: 'flight',
    depart_at: '2027-06-02T09:00:00+01:00',
    depart_tz: 'Europe/Lisbon',
    arrive_at: '2027-06-02T18:30:00+09:00',
    arrive_tz: 'Asia/Tokyo',
  }),
  leg('l2', 'b', 'c'),
];
const details: TripDetails = {
  trip,
  places: [place('p-a', 'Alpha'), place('p-b', 'Beta'), place('p-c', 'Gamma')],
  stops: [
    stop('b', 1, '2027-06-02', '2027-06-05'),
    stop('a', 0, '2027-05-30', '2027-06-02'),
    stop('c', 2, '2027-06-05', '2027-06-08'),
  ],
  stays: [stay('s1', 'a', '2027-05-30', '2027-06-02'), stay('s2', 'b', '2027-06-03', '2027-06-05')],
  legs,
  activities: [
    activity('x3', 'a', '2027-05-31', '18:00'),
    activity('x1', 'a', '2027-05-31', '09:30'),
    activity('x2', 'a', '2027-05-31'),
    activity('x4', 'a', null),
    activity('x5', 'b', '2027-06-02', '20:00'),
  ],
  documents: [],
  links: [],
};
const itinerary = buildItinerary(details);
const plan = (date: string) => dayPlan(itinerary, legs, trip, date);
const cityOf = (date: string) => {
  const p = placeOn(itinerary, trip, date);
  if (p.kind === 'city') return p.stop.place?.name;
  if (p.kind === 'travel') return `${p.from.place?.name}→${p.to.place?.name}`;
  return p.kind;
};

describe('placeOn', () => {
  it('puts a whole city day in that city', () => {
    expect(cityOf('2027-05-30')).toBe('Alpha');
    expect(cityOf('2027-06-01')).toBe('Alpha');
    expect(cityOf('2027-06-04')).toBe('Beta');
  });

  it('makes the departure day a travel day that overlaps the next city’s first day', () => {
    expect(cityOf('2027-06-02')).toBe('Alpha→Beta');
    expect(cityOf('2027-06-05')).toBe('Beta→Gamma');
  });

  it('keeps the last day in the last city (you leave the trip, not to another city)', () => {
    expect(cityOf('2027-06-08')).toBe('Gamma');
  });

  it('marks days outside the trip', () => {
    expect(cityOf('2027-05-29')).toBe('outside');
    expect(cityOf('2027-06-09')).toBe('outside');
  });

  it('marks trip days no city covers yet as free', () => {
    expect(placeOn([], trip, '2027-06-01')).toEqual({ kind: 'free' });
    const longer = { ...trip, end_date: '2027-06-10' };
    expect(placeOn(itinerary, longer, '2027-06-09')).toEqual({ kind: 'free' });
  });
});

describe('dayPlan', () => {
  it('numbers trip days from 1, and gives null outside the trip', () => {
    expect(plan('2027-05-30').tripDay).toBe(1);
    expect(plan('2027-06-08').tripDay).toBe(10);
    expect(plan('2027-05-29').tripDay).toBeNull();
  });

  it('crosses month boundaries without losing a day', () => {
    expect(plan('2027-05-31').tripDay).toBe(2);
    expect(plan('2027-06-01').tripDay).toBe(3);
    expect(cityOf('2027-05-31')).toBe('Alpha');
  });

  it('gives the stay for the night that starts that day (nights, not days)', () => {
    expect(plan('2027-05-30').stays.map((s) => [s.stay.id, s.checkIn])).toEqual([['s1', true]]);
    expect(plan('2027-06-01').stays.map((s) => [s.stay.id, s.checkIn])).toEqual([['s1', false]]);
    // Check-out day: that night is no longer in the Alpha hotel; Beta's starts a day later.
    expect(plan('2027-06-02').stays).toEqual([]);
    expect(plan('2027-06-03').stays.map((s) => s.stay.id)).toEqual(['s2']);
    expect(plan('2027-06-05').stays).toEqual([]);
  });

  it('has no night on the last day of the trip', () => {
    expect(plan('2027-06-08').stays).toEqual([]);
  });

  it('shows a leg on the local day it departs and arrives', () => {
    const day = plan('2027-06-02');
    expect(day.legs.map((l) => [l.leg.id, l.departs, l.arrives])).toEqual([['l1', true, true]]);
    expect(day.legs[0]!.from?.place?.name).toBe('Alpha');
    expect(day.legs[0]!.to?.place?.name).toBe('Beta');
  });

  it('puts a leg without times on the change day', () => {
    expect(plan('2027-06-05').legs.map((l) => [l.leg.id, l.departs, l.arrives])).toEqual([
      ['l2', true, true],
    ]);
    expect(plan('2027-06-04').legs).toEqual([]);
  });

  it('splits an overnight leg across the departure and arrival days', () => {
    const overnight = leg('l3', 'b', 'c', {
      depart_at: '2027-06-04T23:00:00+09:00',
      depart_tz: 'Asia/Tokyo',
      arrive_at: '2027-06-05T07:00:00+09:00',
      arrive_tz: 'Asia/Tokyo',
    });
    const before = dayPlan(itinerary, [overnight], trip, '2027-06-04').legs;
    const after = dayPlan(itinerary, [overnight], trip, '2027-06-05').legs;
    expect(before.map((l) => [l.departs, l.arrives])).toEqual([[true, false]]);
    expect(after.map((l) => [l.departs, l.arrives])).toEqual([[false, true]]);
  });

  it('reads leg days in each end’s time zone, not the device’s', () => {
    // 23:30 on the 1st in Lisbon is already the 2nd in Tokyo.
    const l = leg('l4', 'a', 'b', {
      depart_at: '2027-06-01T23:30:00+01:00',
      depart_tz: 'Europe/Lisbon',
      arrive_at: '2027-06-02T16:00:00+09:00',
      arrive_tz: 'Asia/Tokyo',
    });
    expect(legDays(l, itinerary[0], itinerary[1])).toEqual({
      depart: '2027-06-01',
      arrive: '2027-06-02',
    });
  });

  it('lists only that day’s activities, sorted (any time first, then by time)', () => {
    expect(plan('2027-05-31').activities.map((a) => a.id)).toEqual(['x2', 'x1', 'x3']);
    expect(plan('2027-06-01').activities).toEqual([]);
  });

  it('includes the next city’s activities on a travel day', () => {
    expect(plan('2027-06-02').activities.map((a) => a.id)).toEqual(['x5']);
  });

  it('has nothing for a day outside the trip', () => {
    const day = plan('2027-07-01');
    expect(day.place).toEqual({ kind: 'outside' });
    expect(day.stays).toEqual([]);
    expect(day.legs).toEqual([]);
    expect(day.activities).toEqual([]);
  });
});

describe('daySummary', () => {
  it('marks check-ins, transport modes and activity counts', () => {
    expect(daySummary(plan('2027-05-30'))).toMatchObject({
      checkIn: true,
      legModes: [],
      activityCount: 0,
    });
    expect(daySummary(plan('2027-06-02'))).toMatchObject({
      checkIn: false,
      legModes: ['flight'],
      activityCount: 1,
    });
    expect(daySummary(plan('2027-05-31')).activityCount).toBe(3);
  });
});
