/** Today's calendar date on this device, as "YYYY-MM-DD" (local time, not UTC). */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Formats a date-only range in the user's language, e.g. "Oct 23 – Nov 19, 2026" or
 * "23 de out. – 19 de nov. de 2026". Dates are read as UTC so they never shift a day.
 */
export function formatDateRange(start: string, end: string, locale: string): string {
  const toDate = (d: string) => new Date(`${d}T00:00:00Z`);
  const format = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return format.formatRange(toDate(start), toDate(end));
}
