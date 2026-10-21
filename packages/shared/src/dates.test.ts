import { describe, expect, it } from 'vitest';
import { addDays, chainStops, daysBetween, eachNight, isoWeekday } from './dates.js';

describe('dates', () => {
  it('adds days across month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts nights', () => {
    expect(daysBetween('2026-10-23', '2026-11-19')).toBe(27);
    expect(eachNight('2026-10-23', '2026-10-26')).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(eachNight('2026-10-23', '2026-10-23')).toEqual([]);
  });

  it('chains stops end to end', () => {
    expect(chainStops('2026-10-23', [5, 4, 0])).toEqual([
      { start_date: '2026-10-23', end_date: '2026-10-28', nights: 5 },
      { start_date: '2026-10-28', end_date: '2026-11-01', nights: 4 },
      { start_date: '2026-11-01', end_date: '2026-11-01', nights: 0 },
    ]);
    expect(() => chainStops('2026-10-23', [-1])).toThrow(RangeError);
  });

  it('returns ISO weekday with Monday = 0', () => {
    expect(isoWeekday('2026-10-19')).toBe(0); // Monday
    expect(isoWeekday('2026-10-25')).toBe(6); // Sunday
  });
});
