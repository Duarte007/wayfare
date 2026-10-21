import { CalendarDays } from 'lucide-react';
import { useId, useState, useSyncExternalStore } from 'react';
import type { DateRange } from 'react-day-picker';
import { useTranslation } from 'react-i18next';
import { calendarLocale, dateToDay as toIso, dayToDate as toDate } from '@/shared/lib/calendar-day';
import { formatDateRange } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

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
  /** Only days inside this range can be picked (e.g. a stay inside its city's dates). */
  bounds?: { from: string; to: string };
}

/** First and last day of something (a trip, a stay) picked on one calendar, in the app language. */
export function DateRangeField({
  label,
  placeholder,
  from,
  to,
  onChange,
  error,
  bounds,
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
            locale={calendarLocale(i18n.language)}
            numberOfMonths={wide ? 2 : 1}
            defaultMonth={selected?.from ?? (bounds ? toDate(bounds.from) : undefined)}
            disabled={
              bounds ? [{ before: toDate(bounds.from)! }, { after: toDate(bounds.to)! }] : undefined
            }
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
