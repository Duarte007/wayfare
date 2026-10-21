import type { Stop } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import {
  addCity,
  changedStops,
  moveStop,
  nightsOf,
  removeStop,
  setNights,
  tripEndFor,
} from './itinerary-plan';

const START = '2026-10-23';
const base = (stops: { id: string; nights: number }[]): Stop[] =>
  stops.reduce<Stop[]>(
    (acc, s) =>
      addCity(acc, { stopId: s.id, tripId: 't', placeId: `p-${s.id}`, nights: s.nights }, START),
    [],
  );

// The reference trip: Beijing 10, Chengdu 4, Chongqing 3, Zhangjiajie 3, Shanghai 7.
const china = () =>
  base([
    { id: 'pek', nights: 10 },
    { id: 'ctu', nights: 4 },
    { id: 'ckg', nights: 3 },
    { id: 'dyg', nights: 3 },
    { id: 'sha', nights: 7 },
  ]);

const summary = (stops: Stop[]) =>
  stops.map((s) => `${s.id} ${s.start_date}→${s.end_date} #${s.position} c${s.color_index}`);

describe('itinerary plan', () => {
  it('chains cities from the first day like the reference trip (27 nights, ends 19/11)', () => {
    const stops = china();
    expect(summary(stops)).toEqual([
      'pek 2026-10-23→2026-11-02 #0 c0',
      'ctu 2026-11-02→2026-11-06 #1 c1',
      'ckg 2026-11-06→2026-11-09 #2 c2',
      'dyg 2026-11-09→2026-11-12 #3 c3',
      'sha 2026-11-12→2026-11-19 #4 c4',
    ]);
    expect(stops.reduce((n, s) => n + nightsOf(s), 0)).toBe(27);
  });

  it('changing nights shifts only the later cities', () => {
    const before = china();
    const after = setNights(before, 'ctu', 5, START);
    expect(after.find((s) => s.id === 'pek')?.end_date).toBe('2026-11-02');
    expect(after.find((s) => s.id === 'sha')?.end_date).toBe('2026-11-20');
    expect(changedStops(before, after).map((s) => s.id)).toEqual(['ctu', 'ckg', 'dyg', 'sha']);
  });

  it('moving a city re-chains dates and positions; edges change nothing', () => {
    const before = china();
    const after = moveStop(before, 'sha', -1, START);
    expect(after.map((s) => s.id)).toEqual(['pek', 'ctu', 'ckg', 'sha', 'dyg']);
    expect(after[3]).toMatchObject({
      start_date: '2026-11-09',
      end_date: '2026-11-16',
      position: 3,
    });
    expect(changedStops(before, moveStop(before, 'pek', -1, START))).toEqual([]);
  });

  it('removing a city closes the gap', () => {
    const after = removeStop(china(), 'ckg', START);
    expect(after.map((s) => s.id)).toEqual(['pek', 'ctu', 'dyg', 'sha']);
    expect(after.at(-1)?.end_date).toBe('2026-11-16');
  });

  it('the trip end only grows to fit the cities', () => {
    expect(tripEndFor(china(), '2026-11-19')).toBe('2026-11-19');
    expect(tripEndFor(setNights(china(), 'sha', 9, START), '2026-11-19')).toBe('2026-11-21');
    expect(tripEndFor(removeStop(china(), 'sha', START), '2026-11-19')).toBe('2026-11-19');
  });
});
