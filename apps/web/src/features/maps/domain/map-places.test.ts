import type { Activity, Place, Stay, Stop, Trip } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { buildItinerary, type TripDetails } from '../../trips/domain/trip-overview';
import { boundsOf, mapPlaces } from './map-places';

const trip: Trip = {
  id: 't1',
  owner_id: 'u1',
  name: 'Teste',
  start_date: '2027-05-01',
  end_date: '2027-05-10',
};
const place = (id: string, name: string, lng: number, lat: number): Place => ({
  id,
  trip_id: 't1',
  name,
  lng,
  lat,
  country_code: 'XX',
});
const stop = (id: string, placeId: string, position: number, colorIndex: number): Stop => ({
  id,
  trip_id: 't1',
  place_id: placeId,
  position,
  color_index: colorIndex,
  start_date: '2027-05-01',
  end_date: '2027-05-05',
  visibility: 'group',
  assignees: [],
});
const stay = (id: string, stopId: string, placeId?: string): Stay => ({
  id,
  trip_id: 't1',
  stop_id: stopId,
  place_id: placeId ?? null,
  name: `Hotel ${id}`,
  check_in: '2027-05-01',
  check_out: '2027-05-05',
  visibility: 'group',
  assignees: [],
});
const activity = (id: string, stopId: string, placeId?: string): Activity => ({
  id,
  trip_id: 't1',
  stop_id: stopId,
  place_id: placeId ?? null,
  title: `Visit ${id}`,
  needs_booking: false,
  booked: false,
  source: 'user',
  visibility: 'group',
  assignees: [],
});

function details(patch: Partial<TripDetails>): TripDetails {
  return {
    trip,
    places: [],
    stops: [],
    stays: [],
    legs: [],
    activities: [],
    documents: [],
    links: [],
    ...patch,
  };
}

describe('mapPlaces', () => {
  it('numbers cities in travel order and adds stays and activities that have a place', () => {
    const d = details({
      places: [
        place('pa', 'A-ville', 10, 50),
        place('pb', 'B-town', 20, 40),
        place('ph', 'Hotel spot', 10.01, 50.01),
        place('pm', 'Museum', 20.02, 40.02),
      ],
      // Saved out of order on purpose.
      stops: [stop('s2', 'pb', 1, 3), stop('s1', 'pa', 0, 5)],
      stays: [stay('h1', 's1', 'ph'), stay('h2', 's2')],
      activities: [activity('a1', 's2', 'pm'), activity('a2', 's1')],
    });
    const result = mapPlaces(buildItinerary(d), d.places);
    expect(result.map((p) => [p.kind, p.id, p.cityNumber, p.colorIndex])).toEqual([
      ['city', 's1', 1, 5],
      ['stay', 'h1', 1, 5],
      ['city', 's2', 2, 3],
      ['activity', 'a1', 2, 3],
    ]);
    expect(result[1]).toMatchObject({ title: 'Hotel h1', cityName: 'A-ville', lng: 10.01 });
  });

  it('leaves out a city whose place is not on the device yet', () => {
    const d = details({ places: [], stops: [stop('s1', 'missing', 0, 0)] });
    expect(mapPlaces(buildItinerary(d), d.places)).toEqual([]);
  });
});

describe('boundsOf', () => {
  it('wraps every point, or is null with nothing to show', () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        { lng: 10, lat: 50 },
        { lng: 20, lat: 40 },
      ]),
    ).toEqual({ west: 10, east: 20, south: 40, north: 50 });
  });
});
