import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TripDetails } from '../../trips/domain/trip-overview';
import { addCity } from '../domain/itinerary-plan';
import type { ItineraryChange } from '../domain/itinerary-ports';
import { ItineraryProvider } from './ItineraryProvider';
import { useItineraryEditor } from './useItineraryEditor';

const trip = {
  id: 't',
  owner_id: 'o',
  name: 'Lisboa',
  start_date: '2027-05-01',
  end_date: '2027-05-05',
};
const stops = addCity(
  addCity([], { stopId: 's1', tripId: 't', placeId: 'p1', nights: 2 }, trip.start_date),
  { stopId: 's2', tripId: 't', placeId: 'p2', nights: 2 },
  trip.start_date,
);
const details: TripDetails = {
  trip,
  places: [],
  stops,
  stays: [
    {
      id: 'h1',
      trip_id: 't',
      stop_id: 's2',
      name: 'Hotel',
      check_in: '2027-05-03',
      check_out: '2027-05-05',
      visibility: 'group',
      assignees: [],
    },
  ],
  legs: [
    {
      id: 'l1',
      trip_id: 't',
      from_stop_id: 's1',
      to_stop_id: 's2',
      mode: 'train',
      visibility: 'group',
      assignees: [],
    },
  ],
  activities: [],
  documents: [],
  links: [],
};

function setup() {
  const apply = vi.fn(async (_change: ItineraryChange) => {});
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ItineraryProvider repository={{ apply }} placeSearch={{ search: vi.fn() }}>
      {children}
    </ItineraryProvider>
  );
  const { result } = renderHook(() => useItineraryEditor(details), { wrapper });
  return { apply, editor: result.current };
}

describe('useItineraryEditor', () => {
  it('adds a city after the last one with its place, stretching the trip end', async () => {
    const { apply, editor } = setup();
    expect(editor.previewAdd(3)).toEqual({
      start: '2027-05-05',
      end: '2027-05-08',
      newTripEnd: '2027-05-08',
    });
    await editor.addCity(
      {
        name: 'Porto',
        name_local: null,
        country_code: 'PT',
        country: 'Portugal',
        region: null,
        lat: 41.15,
        lng: -8.61,
      },
      3,
    );
    const change = apply.mock.calls[0]![0];
    expect(change.places?.[0]).toMatchObject({ name: 'Porto', country_code: 'PT', trip_id: 't' });
    expect(change.stops).toHaveLength(1);
    expect(change.stops?.[0]).toMatchObject({
      place_id: change.places?.[0]?.id,
      position: 2,
      start_date: '2027-05-05',
    });
    expect(change.trip?.end_date).toBe('2027-05-08');
  });

  it('removing a city also removes its stays and the legs touching it', async () => {
    const { apply, editor } = setup();
    await editor.remove('s2');
    expect(apply.mock.calls[0]![0].removed).toEqual({
      activities: [],
      stays: ['h1'],
      legs: ['l1'],
      stops: ['s2'],
    });
    expect(apply.mock.calls[0]![0].trip).toBeUndefined();
  });

  it('saves only the cities whose dates or order changed', async () => {
    const { apply, editor } = setup();
    await editor.move('s2', -1);
    expect(apply.mock.calls[0]![0].stops?.map((s) => s.id).sort()).toEqual(['s1', 's2']);
    await editor.setNights('s2', 3);
    expect(apply.mock.calls[1]![0].stops?.map((s) => s.id)).toEqual(['s2']);
  });
});
