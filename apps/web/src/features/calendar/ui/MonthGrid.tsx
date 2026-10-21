import type { Leg } from '@wayfare/shared';
import type { LucideIcon } from 'lucide-react';
import { BedDouble, Bus, Car, Plane, Route, Ship, TrainFront } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { DaySummary } from '../domain/day-plan';
import { monthWeeks, weekdayOrder, type MonthKey, type Weekday } from '../domain/month-grid';
import { cityFill, cityInk, shortName, travelFill } from './city-colors';
import { longDate, weekdayName } from './format';

export const MODE_ICONS: Record<Leg['mode'], LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  bus: Bus,
  ferry: Ship,
  car: Car,
  other: Route,
};

/**
 * One month of the trip as a grid of day buttons. Arrow keys, Home/End and PageUp/PageDown move
 * the focus (one tab stop for the whole grid); Enter or a tap opens the day.
 */
export function MonthGrid({
  month,
  titleId,
  firstDay,
  focused,
  today,
  summaryOf,
  onKey,
  onFocusDay,
  onOpen,
}: {
  month: MonthKey;
  /** Id of the visible month heading, which names the grid. */
  titleId: string;
  firstDay: Weekday;
  focused: string;
  today: string;
  summaryOf: (date: string) => DaySummary;
  onKey: (key: string) => boolean;
  /** Keeps the cursor on the day that has focus, however it got there (tap, Tab, script). */
  onFocusDay: (date: string) => void;
  onOpen: (date: string) => void;
}) {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const gridRef = useRef<HTMLTableElement>(null);
  const moveFocus = useRef(false);

  // Only follow the cursor with DOM focus after a key press, never on first render.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused, month]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (onKey(event.key)) {
      event.preventDefault();
      moveFocus.current = true;
    }
  };

  return (
    <table
      ref={gridRef}
      role="grid"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        const date = (event.target as HTMLElement).dataset.date;
        if (date) onFocusDay(date);
      }}
      className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1"
    >
      <thead>
        <tr>
          {weekdayOrder(firstDay).map((day) => {
            const name = weekdayName(day, language);
            return (
              <th
                key={day}
                scope="col"
                abbr={name.long}
                className="pb-1 text-xs font-semibold text-muted-foreground"
              >
                {name.short}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {monthWeeks(month, firstDay).map((week) => (
          <tr key={week.find(Boolean)}>
            {week.map((date, i) =>
              date ? (
                <td key={date} className="p-0">
                  <DayButton
                    summary={summaryOf(date)}
                    tabbable={date === focused}
                    isToday={date === today}
                    language={language}
                    onOpen={onOpen}
                  />
                </td>
              ) : (
                <td key={`pad-${i}`} aria-hidden className="p-0" />
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayButton({
  summary,
  tabbable,
  isToday,
  language,
  onOpen,
}: {
  summary: DaySummary;
  tabbable: boolean;
  isToday: boolean;
  language: string;
  onOpen: (date: string) => void;
}) {
  const { t } = useTranslation('calendar');
  const { date, place, checkIn, legModes, activityCount } = summary;

  let fill = 'bg-muted/60 text-muted-foreground';
  let style;
  let label: string | undefined;
  let where: string;
  if (place.kind === 'city') {
    fill = cn(cityFill(place.stop.stop.color_index), 'text-foreground');
    label = shortName(place.stop.place?.name);
    where = place.stop.place?.name ?? '?';
  } else if (place.kind === 'travel') {
    fill = 'text-foreground';
    style = travelFill(place.from.stop.color_index, place.to.stop.color_index);
    label = `${shortName(place.from.place?.name).slice(0, 1)}→${shortName(place.to.place?.name).slice(0, 1)}`;
    where = t('travelDay', { from: place.from.place?.name, to: place.to.place?.name });
  } else if (place.kind === 'free') {
    fill = 'border border-dashed bg-card text-foreground';
    where = t('free');
  } else {
    where = t('outside');
  }

  const ariaLabel = [
    longDate(date, language),
    where,
    checkIn ? t('checkIn') : null,
    legModes.length ? t('transport') : null,
    activityCount ? t('activities', { count: activityCount }) : null,
    isToday ? t('today') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      data-date={date}
      tabIndex={tabbable ? 0 : -1}
      aria-label={ariaLabel}
      aria-current={isToday ? 'date' : undefined}
      onClick={() => onOpen(date)}
      style={style}
      className={cn(
        'relative flex h-14 w-full min-w-11 flex-col justify-between overflow-hidden rounded-md p-1 text-left transition hover:brightness-95 focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none sm:h-16 sm:p-1.5',
        fill,
        isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
      )}
    >
      <span className="flex items-start justify-between gap-0.5" aria-hidden>
        <span
          className={cn(
            'text-sm leading-none tabular-nums',
            isToday ? 'font-extrabold' : 'font-semibold',
          )}
        >
          {Number(date.slice(8))}
        </span>
        <span className="flex items-center gap-px">
          {checkIn ? (
            // Phones have room for one marker next to the number: transport wins.
            <BedDouble className={cn('size-3', legModes.length && 'hidden sm:block')} />
          ) : null}
          {legModes.slice(0, 1).map((mode) => {
            const Icon = MODE_ICONS[mode];
            return <Icon key={mode} className="size-3" />;
          })}
        </span>
      </span>
      <span className="flex items-end justify-between gap-0.5" aria-hidden>
        {label ? (
          <span
            className={cn(
              'truncate text-[11px] leading-none font-bold',
              place.kind === 'city' ? cityInk(place.stop.stop.color_index) : null,
            )}
          >
            {label}
          </span>
        ) : (
          <span />
        )}
        {activityCount ? <span className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      </span>
    </button>
  );
}
