import { CalendarDays } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { calendarLocale, dateToDay, dayToDate } from '@/shared/lib/calendar-day';
import { cn } from '@/shared/lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/** One calendar day, picked on a calendar in the app language. */
export function DateField({
  label,
  placeholder,
  value,
  onChange,
  bounds,
}: {
  label: string;
  placeholder: string;
  /** YYYY-MM-DD or '' */
  value: string;
  onChange: (day: string) => void;
  bounds?: { from: string; to: string };
}) {
  const { i18n } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = dayToDate(value);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              'h-11 w-full justify-start px-3 text-base font-normal',
              !value && 'text-muted-foreground',
            )}
          >
            <CalendarDays className="text-muted-foreground" aria-hidden />
            {selected
              ? new Intl.DateTimeFormat(i18n.language, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(selected)
              : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" aria-label={label}>
          <Calendar
            mode="single"
            locale={calendarLocale(i18n.language)}
            defaultMonth={selected ?? (bounds ? dayToDate(bounds.from) : undefined)}
            disabled={
              bounds
                ? [{ before: dayToDate(bounds.from)! }, { after: dayToDate(bounds.to)! }]
                : undefined
            }
            selected={selected}
            onSelect={(day) => {
              if (!day) return;
              onChange(dateToDay(day));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
