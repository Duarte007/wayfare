import type { MonthKey, Weekday } from '../domain/month-grid';

// Calendar days carry no time zone: read them as UTC midnight so they never shift a day.
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Tuesday, 2 June 2027" in the app language. */
export function longDate(date: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc(date));
}

/** "2 Jun", for a date next to a time. */
export function shortDate(date: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(utc(date));
}

export function monthTitle(month: MonthKey, language: string): string {
  return new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc(`${month}-01`));
}

/** Short and long weekday names; 1 January 2024 was a Monday (ISO weekday 1). */
export function weekdayName(day: Weekday, language: string): { short: string; long: string } {
  const date = utc(`2024-01-0${day}`);
  const name = (weekday: 'short' | 'long') =>
    new Intl.DateTimeFormat(language, { weekday, timeZone: 'UTC' }).format(date);
  return { short: name('short'), long: name('long') };
}
