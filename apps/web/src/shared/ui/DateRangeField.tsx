import type { Locale } from 'date-fns';
import { enUS, es, ja, ptBR, zhCN } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { useId, useState, useSyncExternalStore } from 'react';
import type { DateRange } from 'react-day-picker';
import { useTranslation } from 'react-i18next';
import { formatDateRange } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const LOCALES: Record<string, Locale> = { en: enUS, 'pt-BR': ptBR, es, ja, 'zh-CN': zhCN };

/** "2027-03-01" ↔ a local Date at midnight; the app stores plain calendar days, no time zone. */
function toDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function toIso(date: Date | undefined): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia('(min-width: 768px)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Two months side by side when there is room; one on phones. */
function useWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia('(min-width: 768px)').matches,
    () => false,
  );
}

interface DateRangeFieldProps {
  label: string;
  placeholder: string;
  /** YYYY-MM-DD or '' */
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  error?: string;
}

/** First and last day of something (a trip, a stay) picked on one calendar, in the app language. */
export function DateRangeField({
  label,
  placeholder,
  from,
  to,
  onChange,
  error,
}: DateRangeFieldProps) {
  const { i18n } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const wide = useWide();
  const selected: DateRange | undefined = from ? { from: toDate(from), to: toDate(to) } : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={cn(
              'h-11 w-full justify-start px-3 text-base font-normal',
              !from && 'text-muted-foreground',
            )}
          >
            <CalendarDays className="text-muted-foreground" aria-hidden />
            {from ? formatDateRange(from, to || from, i18n.language) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" aria-label={label}>
          <Calendar
            mode="range"
            locale={LOCALES[i18n.language] ?? enUS}
            numberOfMonths={wide ? 2 : 1}
            defaultMonth={selected?.from}
            selected={selected}
            onSelect={(range) => {
              onChange({ from: toIso(range?.from), to: toIso(range?.to) });
              if (range?.from && range.to && range.from.getTime() !== range.to.getTime()) {
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
