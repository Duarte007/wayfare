import type { Locale } from 'date-fns';
import { enUS, es, ja, ptBR, zhCN } from 'date-fns/locale';

/** Calendar locales for the five app languages (week start, month names). */
export const CALENDAR_LOCALES: Record<string, Locale> = {
  en: enUS,
  'pt-BR': ptBR,
  es,
  ja,
  'zh-CN': zhCN,
};

export const calendarLocale = (language: string): Locale => CALENDAR_LOCALES[language] ?? enUS;

/** "2027-03-01" ↔ a local Date at midnight; the app stores plain calendar days, no time zone. */
export function dayToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function dateToDay(date: Date | undefined): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
