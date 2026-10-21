import { randomUUID } from 'node:crypto';
import type { Row } from './backend.ts';

/** "YYYY-MM-DD" for today plus `days`, in UTC (dates have no time zone). */
export function isoDay(days: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A planned trip as the server would hold it: two cities (3 + 2 nights), a stay in the first,
 * a train between them, one activity still to book and one checklist item. The screens that only
 * need "a trip with something in it" (smoke, click audit, axe) start from this.
 */
export function plannedTrip(ownerId: string, name = 'Viagem de teste') {
  const tripId = randomUUID();
  const [lisbonPlace, portoPlace, lisbon, porto] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const start = 30;
  const rows: Record<string, Row[]> = {
    trips: [
      {
        id: tripId,
        owner_id: ownerId,
        name,
        start_date: isoDay(start),
        end_date: isoDay(start + 5),
      },
    ],
    places: [
      {
        id: lisbonPlace,
        trip_id: tripId,
        name: 'Lisboa',
        lat: 38.7223,
        lng: -9.1393,
        country_code: 'PT',
      },
      {
        id: portoPlace,
        trip_id: tripId,
        name: 'Porto',
        lat: 41.1496,
        lng: -8.611,
        country_code: 'PT',
      },
    ],
    stops: [
      {
        id: lisbon,
        trip_id: tripId,
        place_id: lisbonPlace,
        start_date: isoDay(start),
        end_date: isoDay(start + 3),
        position: 0,
        color_index: 0,
      },
      {
        id: porto,
        trip_id: tripId,
        place_id: portoPlace,
        start_date: isoDay(start + 3),
        end_date: isoDay(start + 5),
        position: 1,
        color_index: 1,
      },
    ],
    stays: [
      {
        id: randomUUID(),
        trip_id: tripId,
        stop_id: lisbon,
        name: 'Hotel do Rio',
        check_in: isoDay(start),
        check_out: isoDay(start + 3),
      },
    ],
    legs: [
      { id: randomUUID(), trip_id: tripId, from_stop_id: lisbon, to_stop_id: porto, mode: 'train' },
    ],
    activities: [
      {
        id: randomUUID(),
        trip_id: tripId,
        stop_id: lisbon,
        title: 'Museu do Azulejo',
        date: isoDay(start + 1),
        start_time: '10:00',
        needs_booking: true,
        booked: false,
      },
    ],
    checklist_items: [
      {
        id: randomUUID(),
        trip_id: tripId,
        group_key: 'documents',
        title: 'Passaporte válido',
        position: 0,
      },
    ],
  };
  return { tripId, rows };
}
