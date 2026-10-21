import { describe, expect, it } from 'vitest';
import { buildItinerary, tripPhase, type TripDetails } from './trip-overview';

const trip = {
  id: 't',
  owner_id: 'o',
  name: 'China',
  start_date: '2026-10-23',
  end_date: '2026-11-19',
};
const place = (id: string, name: string) => ({
  id,
  trip_id: 't',
  name,
  lat: 0,
  lng: 0,
  country_code: 'CN',
});
const stop = (id: string, place_id: string, position: number, start: string, end: string) => ({
  id,
  trip_id: 't',
  place_id,
  position,
  start_date: start,
  end_date: end,
  color_index: position,
  visibility: 'group' as const,
  assignees: [],
});

function details(overrides: Partial<TripDetails> = {}): TripDetails {
  return {
    trip,
    places: [place('p1', 'Beijing'), place('p2', 'Chengdu')],
    // Saved out of order on purpose.
    stops: [
      stop('s2', 'p2', 1, '2026-11-02', '2026-11-06'),
      stop('s1', 'p1', 0, '2026-10-23', '2026-11-02'),
    ],
    stays: [],
    legs: [],
    activities: [],
    documents: [],
    links: [],
    ...overrides,
  };
}

describe('buildItinerary', () => {
  it('orders cities by position with their place, nights and the leg to the next city', () => {
    const leg = {
      id: 'l1',
      trip_id: 't',
      from_stop_id: 's1',
      to_stop_id: 's2',
      mode: 'flight' as const,
      visibility: 'group' as const,
      assignees: [],
    };
    const [first, second] = buildItinerary(details({ legs: [leg] }));
    expect(first?.place?.name).toBe('Beijing');
    expect(first?.nights).toBe(10);
    expect(first?.legToNext?.id).toBe('l1');
    expect(first?.isLast).toBe(false);
    expect(second?.place?.name).toBe('Chengdu');
    expect(second?.legToNext).toBeNull();
    expect(second?.isLast).toBe(true);
  });

  it('is empty for a trip without cities yet', () => {
    expect(buildItinerary(details({ stops: [] }))).toEqual([]);
  });
});

describe('tripPhase', () => {
  it('counts down before the trip, counts days during it, and ends after it', () => {
    expect(tripPhase(trip, '2026-10-21')).toEqual({ phase: 'upcoming', daysToGo: 2 });
    expect(tripPhase(trip, '2026-10-23')).toEqual({ phase: 'ongoing', day: 1, total: 28 });
    expect(tripPhase(trip, '2026-11-19')).toEqual({ phase: 'ongoing', day: 28, total: 28 });
    expect(tripPhase(trip, '2026-11-20')).toEqual({ phase: 'past' });
  });
});
