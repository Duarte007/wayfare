import { describe, expect, it } from 'vitest';
import { defaultTimeZone, toZonedIso, zonedParts } from './timezone';

describe('timezone', () => {
  it('turns a local time into an instant with that zone offset', () => {
    expect(toZonedIso('2026-11-02', '08:30', 'Asia/Shanghai')).toBe('2026-11-02T08:30:00+08:00');
    expect(toZonedIso('2027-01-15', '23:05', 'America/Sao_Paulo')).toBe(
      '2027-01-15T23:05:00-03:00',
    );
    expect(toZonedIso('2026-11-02', '08:30', 'Asia/Kathmandu')).toBe('2026-11-02T08:30:00+05:45');
  });

  it('uses the offset in force on that date, across daylight saving', () => {
    expect(toZonedIso('2027-01-10', '12:00', 'Europe/Lisbon')).toBe('2027-01-10T12:00:00+00:00');
    expect(toZonedIso('2027-07-10', '12:00', 'Europe/Lisbon')).toBe('2027-07-10T12:00:00+01:00');
  });

  it('reads an instant back as wall-clock date and time in a zone', () => {
    expect(zonedParts('2026-11-02T08:30:00+08:00', 'Asia/Shanghai')).toEqual({
      date: '2026-11-02',
      time: '08:30',
    });
    expect(zonedParts('2026-11-02T08:30:00+08:00', 'Europe/Lisbon')).toEqual({
      date: '2026-11-02',
      time: '00:30',
    });
  });

  it('picks the main zone of a country', () => {
    expect(defaultTimeZone('CN')).toBe('Asia/Shanghai');
    expect(defaultTimeZone('pt')).toBe('Europe/Lisbon');
  });
});
