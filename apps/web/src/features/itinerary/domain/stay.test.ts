import { staySchema } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { buildStay, emptyStayInput, stayToInput, validateStay } from './stay';

const stop = { start_date: '2026-10-23', end_date: '2026-11-02' };
const valid = { ...emptyStayInput(stop), name: '  Beijing Seeyou Youth Hostel ' };

describe('stay rules', () => {
  it('defaults to the whole city, shared with the group', () => {
    expect(emptyStayInput(stop)).toMatchObject({
      checkIn: '2026-10-23',
      checkOut: '2026-11-02',
      shared: true,
    });
    expect(validateStay(valid, stop)).toEqual([]);
  });

  it('needs a name, at least one night, dates inside the city and a real link', () => {
    expect(validateStay({ ...valid, name: ' ' }, stop)).toEqual(['name_required']);
    expect(validateStay({ ...valid, checkOut: valid.checkIn }, stop)).toEqual(['no_nights']);
    expect(validateStay({ ...valid, checkOut: '2026-11-03' }, stop)).toEqual(['outside_city']);
    expect(validateStay({ ...valid, checkIn: '' }, stop)).toEqual(['dates_required']);
    expect(validateStay({ ...valid, bookingUrl: 'javascript:alert(1)' }, stop)).toEqual([
      'url_invalid',
    ]);
    expect(validateStay({ ...valid, bookingUrl: 'https://booking.com/x' }, stop)).toEqual([]);
  });

  it('builds a row the shared schema accepts, nulls for empty fields, private when not shared', () => {
    const ctx = {
      id: crypto.randomUUID(),
      tripId: crypto.randomUUID(),
      stopId: crypto.randomUUID(),
      createdBy: crypto.randomUUID(),
    };
    const stay = buildStay({ ...valid, shared: false, bookingRef: ' ABC123 ' }, ctx);
    expect(stay).toMatchObject({
      name: 'Beijing Seeyou Youth Hostel',
      booking_ref: 'ABC123',
      booking_url: null,
      notes: null,
      visibility: 'private',
      created_by: ctx.createdBy,
    });
    expect(staySchema.safeParse(stay).success).toBe(true);
    // Editing keeps who created it and round-trips through the form.
    const edited = buildStay(
      { ...stayToInput(stay), name: 'Novo nome' },
      { ...ctx, createdBy: 'someone-else' },
      stay,
    );
    expect(edited.created_by).toBe(ctx.createdBy);
    expect(stayToInput(edited).shared).toBe(false);
  });
});
