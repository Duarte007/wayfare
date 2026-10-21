/**
 * Time zones for travel times, with the platform's Intl only (works offline). A leg's departure
 * is "08:30 in Asia/Shanghai": stored as an ISO instant with that zone's offset plus the zone id,
 * shown back in that zone wherever the reader is.
 */

/** Main zone per country; for multi-zone countries the most visited one (editable in the UI). */
const COUNTRY_ZONES: Record<string, string> = {
  AE: 'Asia/Dubai',
  AR: 'America/Argentina/Buenos_Aires',
  AT: 'Europe/Vienna',
  AU: 'Australia/Sydney',
  BE: 'Europe/Brussels',
  BG: 'Europe/Sofia',
  BO: 'America/La_Paz',
  BR: 'America/Sao_Paulo',
  CA: 'America/Toronto',
  CH: 'Europe/Zurich',
  CL: 'America/Santiago',
  CN: 'Asia/Shanghai',
  CO: 'America/Bogota',
  CR: 'America/Costa_Rica',
  CU: 'America/Havana',
  CZ: 'Europe/Prague',
  DE: 'Europe/Berlin',
  DK: 'Europe/Copenhagen',
  DO: 'America/Santo_Domingo',
  EC: 'America/Guayaquil',
  EE: 'Europe/Tallinn',
  EG: 'Africa/Cairo',
  ES: 'Europe/Madrid',
  FI: 'Europe/Helsinki',
  FR: 'Europe/Paris',
  GB: 'Europe/London',
  GR: 'Europe/Athens',
  GT: 'America/Guatemala',
  HK: 'Asia/Hong_Kong',
  HR: 'Europe/Zagreb',
  HU: 'Europe/Budapest',
  ID: 'Asia/Jakarta',
  IE: 'Europe/Dublin',
  IL: 'Asia/Jerusalem',
  IN: 'Asia/Kolkata',
  IS: 'Atlantic/Reykjavik',
  IT: 'Europe/Rome',
  JO: 'Asia/Amman',
  JP: 'Asia/Tokyo',
  KE: 'Africa/Nairobi',
  KH: 'Asia/Phnom_Penh',
  KR: 'Asia/Seoul',
  LA: 'Asia/Vientiane',
  LK: 'Asia/Colombo',
  LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg',
  LV: 'Europe/Riga',
  MA: 'Africa/Casablanca',
  MO: 'Asia/Macau',
  MT: 'Europe/Malta',
  MV: 'Indian/Maldives',
  MX: 'America/Mexico_City',
  MY: 'Asia/Kuala_Lumpur',
  NL: 'Europe/Amsterdam',
  NO: 'Europe/Oslo',
  NP: 'Asia/Kathmandu',
  NZ: 'Pacific/Auckland',
  PA: 'America/Panama',
  PE: 'America/Lima',
  PH: 'Asia/Manila',
  PL: 'Europe/Warsaw',
  PT: 'Europe/Lisbon',
  PY: 'America/Asuncion',
  QA: 'Asia/Qatar',
  RO: 'Europe/Bucharest',
  RS: 'Europe/Belgrade',
  RU: 'Europe/Moscow',
  SA: 'Asia/Riyadh',
  SE: 'Europe/Stockholm',
  SG: 'Asia/Singapore',
  SI: 'Europe/Ljubljana',
  SK: 'Europe/Bratislava',
  TH: 'Asia/Bangkok',
  TN: 'Africa/Tunis',
  TR: 'Europe/Istanbul',
  TW: 'Asia/Taipei',
  TZ: 'Africa/Dar_es_Salaam',
  UA: 'Europe/Kyiv',
  US: 'America/New_York',
  UY: 'America/Montevideo',
  VE: 'America/Caracas',
  VN: 'Asia/Ho_Chi_Minh',
  ZA: 'Africa/Johannesburg',
};

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function defaultTimeZone(countryCode: string | undefined): string {
  return (countryCode && COUNTRY_ZONES[countryCode.toUpperCase()]) || deviceTimeZone();
}

export function allTimeZones(): string[] {
  return Intl.supportedValuesOf('timeZone');
}

/** Offset in minutes of `timeZone` at the instant `ms`. */
function offsetMinutes(timeZone: string, ms: number): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(ms))
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = name?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0; // "GMT" exactly
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === '-' ? -minutes : minutes;
}

const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');

/**
 * "2026-11-02" + "08:30" in "Asia/Shanghai" → "2026-11-02T08:30:00+08:00".
 * Re-checks the offset at the resulting instant, so times next to a DST change are right.
 */
export function toZonedIso(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let offset = offsetMinutes(timeZone, wall);
  offset = offsetMinutes(timeZone, wall - offset * 60_000);
  const sign = offset < 0 ? '-' : '+';
  return `${date}T${time}:00${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}

/** The wall-clock date and time of an instant in `timeZone`. */
export function zonedParts(iso: string, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** "08:30" in the zone of the place, in the reader's language. */
export function formatZonedTime(iso: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}
