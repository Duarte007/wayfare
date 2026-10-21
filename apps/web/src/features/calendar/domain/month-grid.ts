import { addDays, daysBetween, isoWeekday } from '@wayfare/shared';

/** A month as "YYYY-MM". */
export type MonthKey = string;

/** ISO weekday: 1 = Monday … 7 = Sunday (the numbering `Intl.Locale#getWeekInfo` uses). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const monthOf = (date: string): MonthKey => date.slice(0, 7);

export function firstOfMonth(month: MonthKey): string {
  return `${month}-01`;
}

/** Adds whole months to a "YYYY-MM". */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function lastOfMonth(month: MonthKey): string {
  return addDays(firstOfMonth(addMonths(month, 1)), -1);
}

/** Every month touched by [start, end], in order. */
export function monthsBetween(start: string, end: string): MonthKey[] {
  const months: MonthKey[] = [];
  for (let m = monthOf(start); m <= monthOf(end); m = addMonths(m, 1)) months.push(m);
  return months;
}

/** The seven weekdays in column order, starting on `firstDay`. */
export function weekdayOrder(firstDay: Weekday): Weekday[] {
  return Array.from({ length: 7 }, (_, i) => (((firstDay - 1 + i) % 7) + 1) as Weekday);
}

/**
 * The month as rows of seven cells; `null` pads the first and last week so every day sits under
 * its weekday column.
 */
export function monthWeeks(month: MonthKey, firstDay: Weekday): (string | null)[][] {
  const first = firstOfMonth(month);
  const days = daysBetween(first, lastOfMonth(month)) + 1;
  const lead = (isoWeekday(first) + 1 - firstDay + 7) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

type WeekInfoLocale = Intl.Locale & {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
};

/**
 * The first day of the week for a language, from Intl where the platform supports it
 * (`getWeekInfo`, or the older `weekInfo` getter); Monday otherwise.
 */
export function firstDayOfWeek(language: string): Weekday {
  try {
    const locale = new Intl.Locale(language).maximize() as WeekInfoLocale;
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    const day = info?.firstDay;
    if (day && day >= 1 && day <= 7) return day as Weekday;
  } catch {
    // Unknown tag or no Intl.Locale: fall through.
  }
  return 1;
}
