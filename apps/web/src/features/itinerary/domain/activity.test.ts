import { activitySchema, type Activity } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import {
  activityCounts,
  activityToInput,
  buildActivity,
  emptyActivityInput,
  setBooked,
  sortActivities,
  validateActivity,
} from './activity';

const stop = { start_date: '2026-11-02', end_date: '2026-11-07' };
const context = {
  id: '7e572000-0000-4000-8000-000000000001',
  tripId: '7e571000-0000-4000-8000-000000000001',
  stopId: '7e573000-0000-4000-8000-000000000001',
  createdBy: '7e570000-0000-4000-8000-00000000a001',
};
const bia = '7e570000-0000-4000-8000-00000000b002';

describe('validateActivity', () => {
  it('needs a title', () => {
    expect(validateActivity(emptyActivityInput(), stop)).toEqual(['title_required']);
  });

  it('accepts any day in the city, departure day included', () => {
    const input = { ...emptyActivityInput(), title: 'Muralha', date: '2026-11-07' };
    expect(validateActivity(input, stop)).toEqual([]);
    expect(validateActivity({ ...input, date: '2026-11-08' }, stop)).toEqual(['outside_city']);
    expect(validateActivity({ ...input, date: '2026-11-01' }, stop)).toEqual(['outside_city']);
  });

  it('rejects links that are not http(s)', () => {
    const input = { ...emptyActivityInput(), title: 'x', url: 'javascript:alert(1)' };
    expect(validateActivity(input, stop)).toEqual(['url_invalid']);
  });
});

describe('buildActivity', () => {
  it('builds a schema-valid row with nulls for what is unknown', () => {
    const row = buildActivity({ ...emptyActivityInput(), title: '  Cidade Proibida ' }, context);
    expect(activitySchema.parse(row)).toMatchObject({
      title: 'Cidade Proibida',
      date: null,
      start_time: null,
      url: null,
      needs_booking: false,
      booked: false,
      assignees: [],
      visibility: 'group',
      source: 'user',
      created_by: context.createdBy,
    });
  });

  it('drops a time without a day and "booked" without booking', () => {
    const row = buildActivity(
      { ...emptyActivityInput(), title: 'x', time: '09:00', booked: true },
      context,
    );
    expect(row.start_time).toBeNull();
    expect(row.booked).toBe(false);
  });

  it('keeps assignees only on shared items', () => {
    const input = { ...emptyActivityInput(), title: 'x', assignees: [bia, bia] };
    expect(buildActivity(input, context).assignees).toEqual([bia]);
    expect(buildActivity({ ...input, shared: false }, context)).toMatchObject({
      assignees: [],
      visibility: 'private',
    });
  });

  it('round-trips through the form and keeps the creator and source on edit', () => {
    const existing: Activity = {
      ...buildActivity(
        {
          ...emptyActivityInput(),
          title: 'Show acrobático',
          date: '2026-11-03',
          time: '19:30',
          needsBooking: true,
          url: 'https://example.com/tickets',
        },
        { ...context, createdBy: bia },
      ),
      source: 'ai',
      start_time: '19:30:00',
    };
    const input = activityToInput(existing);
    expect(input).toMatchObject({ time: '19:30', needsBooking: true, booked: false });
    const edited = buildActivity({ ...input, booked: true }, context, existing);
    expect(edited).toMatchObject({
      created_by: bia,
      source: 'ai',
      booked: true,
      start_time: '19:30',
    });
  });
});

describe('timeline helpers', () => {
  const make = (title: string, date: string | null, time: string | null = null): Activity => ({
    ...buildActivity({ ...emptyActivityInput(), title }, context),
    date,
    start_time: time,
  });

  it('sorts by day and time, unscheduled last', () => {
    const list = [
      make('C', null),
      make('B', '2026-11-03', '10:00'),
      make('A', '2026-11-03'),
      make('D', '2026-11-02', '18:00'),
    ];
    expect(sortActivities(list).map((a) => a.title)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('counts what still needs booking and ticks bookings off', () => {
    const toBook = { ...make('Ingresso', null), needs_booking: true };
    expect(activityCounts([toBook, make('Passeio', null)])).toEqual({ total: 2, toBook: 1 });
    const booked = setBooked(toBook, true);
    expect(activityCounts([booked])).toEqual({ total: 1, toBook: 0 });
    expect(setBooked(booked, false)).toMatchObject({ needs_booking: true, booked: false });
  });
});
