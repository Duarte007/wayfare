import type { Activity, Leg, Place, Stay, Stop } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import {
  buildLink,
  documentsLinkedTo,
  labelFor,
  linkCounts,
  linkTargets,
  targetsOf,
} from './document-link';

const base = { trip_id: 't', created_by: 'u', visibility: 'group' as const, assignees: [] };
const place = (id: string, name: string) => ({ id, trip_id: 't', name }) as Place;
const stop = (id: string, placeId: string, position: number) =>
  ({ id, trip_id: 't', place_id: placeId, position, start_date: '', end_date: '' }) as Stop;

const itinerary = {
  places: [place('p1', 'Beijing'), place('p2', 'Shanghai')],
  // Out of order on purpose: travel order comes from `position`.
  stops: [stop('s2', 'p2', 1), stop('s1', 'p1', 0)],
  stays: [
    { ...base, id: 'st2', stop_id: 's2', name: 'Bund Hotel', check_in: '2027-01-05' },
    { ...base, id: 'st1', stop_id: 's1', name: 'Lotus Inn', check_in: '2027-01-01' },
  ] as unknown as Stay[],
  legs: [
    {
      ...base,
      id: 'l1',
      from_stop_id: 's1',
      to_stop_id: 's2',
      mode: 'train',
      carrier: null,
      number: 'G1',
    },
  ] as unknown as Leg[],
  activities: [
    { ...base, id: 'a2', stop_id: 's1', title: 'Opera', date: null },
    { ...base, id: 'a1', stop_id: 's1', title: 'Great Wall', date: '2027-01-02' },
  ] as unknown as Activity[],
};

describe('linkTargets', () => {
  it('lists stays, legs and activities in travel order with their city', () => {
    expect(linkTargets(itinerary)).toEqual([
      { type: 'stay', id: 'st1', name: 'Lotus Inn', city: 'Beijing' },
      { type: 'stay', id: 'st2', name: 'Bund Hotel', city: 'Shanghai' },
      { type: 'leg', id: 'l1', from: 'Beijing', to: 'Shanghai', mode: 'train', service: 'G1' },
      { type: 'activity', id: 'a1', name: 'Great Wall', city: 'Beijing' },
      { type: 'activity', id: 'a2', name: 'Opera', city: 'Beijing' },
    ]);
  });
});

describe('labelFor', () => {
  it('picks the document type a stay, leg or activity implies', () => {
    expect(labelFor({ type: 'stay' })).toBe('stay');
    expect(labelFor({ type: 'activity' })).toBe('activity');
    expect(labelFor({ type: 'leg', mode: 'flight' })).toBe('flight');
    expect(labelFor({ type: 'leg', mode: 'train' })).toBe('train');
    expect(labelFor({ type: 'leg', mode: 'ferry' })).toBe('bus_ferry');
    expect(labelFor({ type: 'leg', mode: 'car' })).toBe('other');
  });
});

describe('links', () => {
  const links = [
    buildLink('d1', 't', { type: 'stay', id: 'st1' }),
    buildLink('d2', 't', { type: 'stay', id: 'st1' }),
    buildLink('d1', 't', { type: 'leg', id: 'l1' }),
    // Another member's private document: its link arrives, the document doesn't.
    buildLink('private', 't', { type: 'stay', id: 'st1' }),
    // Points at a stay that isn't on this device.
    buildLink('d1', 't', { type: 'stay', id: 'gone' }),
  ];
  const documents = [
    { id: 'd2', title: 'Voucher' },
    { id: 'd1', title: 'Booking' },
  ];

  it('builds the server row', () => {
    expect(links[0]).toEqual({
      document_id: 'd1',
      entity_type: 'stay',
      entity_id: 'st1',
      trip_id: 't',
    });
  });

  it('lists the documents of a stay that are on the device, by title', () => {
    expect(documentsLinkedTo(documents, links, { type: 'stay', id: 'st1' })).toEqual([
      { id: 'd1', title: 'Booking' },
      { id: 'd2', title: 'Voucher' },
    ]);
    expect(documentsLinkedTo(documents, links, { type: 'activity', id: 'a1' })).toEqual([]);
  });

  it('lists what a document is linked to, skipping what is no longer here', () => {
    expect(targetsOf('d1', links, linkTargets(itinerary)).map((t) => t.id)).toEqual(['st1', 'l1']);
  });

  it('counts documents per stay, leg or activity, ignoring ones not on the device', () => {
    const counts = linkCounts(documents, links);
    expect(counts.get('stay:st1')).toBe(2);
    expect(counts.get('leg:l1')).toBe(1);
    expect(counts.get('activity:a1')).toBeUndefined();
  });
});
