import type { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { ja } from 'date-fns/locale/ja';
import { ptBR } from 'date-fns/locale/pt-BR';
import { zhCN } from 'date-fns/locale/zh-CN';
import type { ComponentProps } from 'react';
import { Calendar } from './calendar';

/** Calendar locales for the five app languages (week start, month names). */
const CALENDAR_LOCALES: Record<string, Locale> = {
  en: enUS,
  'pt-BR': ptBR,
  es,
  ja,
  'zh-CN': zhCN,
};

export type LocalizedCalendarProps = ComponentProps<typeof Calendar> & { language: string };

/**
 * The shadcn Calendar in the app language. It is the heavy part of a date field (react-day-picker
 * and the date-fns locales), so `LazyCalendar` loads this module only when a picker opens.
 */
export default function LocalizedCalendar({ language, ...props }: LocalizedCalendarProps) {
  return <Calendar locale={CALENDAR_LOCALES[language] ?? enUS} {...props} />;
}
