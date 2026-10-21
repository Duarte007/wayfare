import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addMonths,
  firstDayOfWeek,
  lastOfMonth,
  monthsBetween,
  monthWeeks,
  weekdayOrder,
} from './month-grid';

describe('months', () => {
  it('adds months across years', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2027-03', -14)).toBe('2026-01');
  });

  it('knows the last day, leap years included', () => {
    expect(lastOfMonth('2028-02')).toBe('2028-02-29');
    expect(lastOfMonth('2027-02')).toBe('2027-02-28');
    expect(lastOfMonth('2026-12')).toBe('2026-12-31');
  });

  it('lists every month a trip touches', () => {
    expect(monthsBetween('2026-10-23', '2026-10-30')).toEqual(['2026-10']);
    expect(monthsBetween('2026-10-23', '2027-01-02')).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });
});

describe('monthWeeks', () => {
  it('starts on Monday and pads the edges', () => {
    // 1 June 2027 is a Tuesday.
    const weeks = monthWeeks('2027-06', 1);
    expect(weeks[0]).toEqual([null, '2027-06-01', ...[2, 3, 4, 5, 6].map((d) => `2027-06-0${d}`)]);
    expect(weeks.at(-1)).toEqual([
      '2027-06-28',
      '2027-06-29',
      '2027-06-30',
      null,
      null,
      null,
      null,
    ]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('starts on Sunday when the language does', () => {
    const weeks = monthWeeks('2027-06', 7);
    expect(weeks[0]!.slice(0, 3)).toEqual([null, null, '2027-06-01']);
  });

  it('needs no padding when the month starts on the first column', () => {
    // 1 February 2027 is a Monday; 28 days fill four rows exactly.
    expect(monthWeeks('2027-02', 1)).toHaveLength(4);
    expect(monthWeeks('2027-02', 1)[0]![0]).toBe('2027-02-01');
  });
});

describe('weekdayOrder', () => {
  it('rotates from the first day', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekdayOrder(7)).toEqual([7, 1, 2, 3, 4, 5, 6]);
    expect(weekdayOrder(6)).toEqual([6, 7, 1, 2, 3, 4, 5]);
  });
});

describe('firstDayOfWeek', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads the week start from Intl when supported', () => {
    const supported = 'getWeekInfo' in Intl.Locale.prototype || 'weekInfo' in Intl.Locale.prototype;
    if (!supported) return;
    expect(firstDayOfWeek('pt-BR')).toBe(7);
    expect(firstDayOfWeek('es')).toBe(1);
  });

  it('falls back to Monday without week info', () => {
    vi.spyOn(Intl.Locale.prototype, 'maximize').mockReturnValue({} as Intl.Locale);
    expect(firstDayOfWeek('pt-BR')).toBe(1);
  });

  it('falls back to Monday for an invalid language tag', () => {
    expect(firstDayOfWeek('not a tag!')).toBe(1);
  });
});
