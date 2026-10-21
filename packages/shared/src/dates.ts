/**
 * Calendar-date helpers. Trip and stop dates are plain "YYYY-MM-DD" strings with no time zone,
 * so all arithmetic happens in UTC to avoid daylight-saving shifts.
 */

const DAY_MS = 86_400_000;

function toUtcMs(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid date: ${date}`);
  return ms;
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Every calendar date in [start, endExclusive). */
export function eachNight(start: string, endExclusive: string): string[] {
  const nights = daysBetween(start, endExclusive);
  return Array.from({ length: Math.max(0, nights) }, (_, i) => addDays(start, i));
}

export interface ChainedStop {
  start_date: string;
  end_date: string;
  nights: number;
}

/**
 * Lays stops end to end from the trip start: each stop departs on the day the next one begins.
 * Changing the nights of one stop shifts every later stop.
 */
export function chainStops(tripStart: string, nightsPerStop: readonly number[]): ChainedStop[] {
  let cursor = tripStart;
  return nightsPerStop.map((nights) => {
    if (!Number.isInteger(nights) || nights < 0) {
      throw new RangeError(`Nights must be a non-negative integer, got ${nights}`);
    }
    const start_date = cursor;
    const end_date = addDays(start_date, nights);
    cursor = end_date;
    return { start_date, end_date, nights };
  });
}

/** Day of week, 0 = Monday ... 6 = Sunday. */
export function isoWeekday(date: string): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7;
}
