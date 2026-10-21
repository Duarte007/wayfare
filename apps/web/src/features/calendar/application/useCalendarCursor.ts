import { addDays, isoWeekday } from '@wayfare/shared';
import { useState } from 'react';
import {
  addMonths,
  firstOfMonth,
  lastOfMonth,
  monthOf,
  monthsBetween,
  type MonthKey,
  type Weekday,
} from '../domain/month-grid';

export interface CalendarCursor {
  /** Every month the trip touches. */
  months: MonthKey[];
  /** The month on screen. */
  month: MonthKey;
  /** The day that holds keyboard focus (roving tabindex). */
  focused: string;
  canPrevious: boolean;
  canNext: boolean;
  focus: (date: string) => void;
  /** Moves a month back or forward, keeping the day of the month where it exists. */
  goToMonth: (delta: -1 | 1) => void;
  /** Applies a grid key (arrows, Home/End, PageUp/PageDown); false when the key isn't one. */
  onKey: (key: string) => boolean;
}

const clamp = (date: string, min: string, max: string) =>
  date < min ? min : date > max ? max : date;

/**
 * Which month is shown and which day has focus, kept inside the trip's months. Starts on today
 * when it falls in the trip, otherwise on the first day.
 */
export function useCalendarCursor(
  trip: { start_date: string; end_date: string },
  today: string,
  firstDay: Weekday,
): CalendarCursor {
  const months = monthsBetween(trip.start_date, trip.end_date);
  const min = firstOfMonth(months[0]!);
  const max = lastOfMonth(months.at(-1)!);
  const [state, setState] = useState(() =>
    today >= trip.start_date && today <= trip.end_date ? today : trip.start_date,
  );
  // The trip's dates can change while the page is open (edits sync in).
  const focused = clamp(state, min, max);
  const month = monthOf(focused);
  const focus = (date: string) => setState(clamp(date, min, max));

  const goToMonth = (delta: -1 | 1) => {
    const target = addMonths(month, delta);
    const day = Math.min(Number(focused.slice(8)), Number(lastOfMonth(target).slice(8)));
    focus(`${target}-${String(day).padStart(2, '0')}`);
  };

  const column = (isoWeekday(focused) + 1 - firstDay + 7) % 7;
  const moves: Record<string, () => void> = {
    ArrowLeft: () => focus(addDays(focused, -1)),
    ArrowRight: () => focus(addDays(focused, 1)),
    ArrowUp: () => focus(addDays(focused, -7)),
    ArrowDown: () => focus(addDays(focused, 7)),
    // Home/End stay in the month on screen, like the arrows of a date picker's week row.
    Home: () => focus(clamp(addDays(focused, -column), firstOfMonth(month), lastOfMonth(month))),
    End: () => focus(clamp(addDays(focused, 6 - column), firstOfMonth(month), lastOfMonth(month))),
    PageUp: () => goToMonth(-1),
    PageDown: () => goToMonth(1),
  };

  return {
    months,
    month,
    focused,
    canPrevious: month > months[0]!,
    canNext: month < months.at(-1)!,
    focus,
    goToMonth,
    onKey: (key) => {
      const move = moves[key];
      if (!move) return false;
      move();
      return true;
    },
  };
}
