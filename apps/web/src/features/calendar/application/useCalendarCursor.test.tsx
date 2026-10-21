import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Weekday } from '../domain/month-grid';
import { useCalendarCursor } from './useCalendarCursor';

const trip = { start_date: '2027-05-30', end_date: '2027-07-02' };

function setup(today = '2027-01-01', firstDay: Weekday = 1, range = trip) {
  return renderHook(({ r }) => useCalendarCursor(r, today, firstDay), {
    initialProps: { r: range },
  });
}

describe('useCalendarCursor', () => {
  it('starts on the first trip day when today is outside the trip', () => {
    const { result } = setup();
    expect(result.current.focused).toBe('2027-05-30');
    expect(result.current.month).toBe('2027-05');
    expect(result.current.months).toEqual(['2027-05', '2027-06', '2027-07']);
    expect(result.current.canPrevious).toBe(false);
    expect(result.current.canNext).toBe(true);
  });

  it('starts on today during the trip', () => {
    const { result } = setup('2027-06-15');
    expect(result.current.focused).toBe('2027-06-15');
    expect(result.current.month).toBe('2027-06');
  });

  it('moves by day and by week with the arrows, crossing into the next month', () => {
    const { result } = setup();
    act(() => void result.current.onKey('ArrowRight'));
    expect(result.current.focused).toBe('2027-05-31');
    act(() => void result.current.onKey('ArrowDown'));
    expect(result.current.focused).toBe('2027-06-07');
    expect(result.current.month).toBe('2027-06');
    act(() => void result.current.onKey('ArrowUp'));
    act(() => void result.current.onKey('ArrowLeft'));
    expect(result.current.focused).toBe('2027-05-30');
  });

  it('stays inside the trip’s months', () => {
    const { result } = setup();
    act(() => result.current.focus('2027-05-01'));
    act(() => void result.current.onKey('ArrowUp'));
    expect(result.current.focused).toBe('2027-05-01');
    act(() => result.current.focus('2027-07-31'));
    act(() => void result.current.onKey('ArrowRight'));
    expect(result.current.focused).toBe('2027-07-31');
    expect(result.current.canNext).toBe(false);
  });

  it('jumps to the edges of the week with Home and End, within the month', () => {
    // Wednesday 2 June 2027, weeks from Monday.
    const { result } = setup('2027-06-02');
    act(() => void result.current.onKey('Home'));
    expect(result.current.focused).toBe('2027-06-01'); // Monday 31 May is in another month
    act(() => void result.current.onKey('End'));
    expect(result.current.focused).toBe('2027-06-06');
  });

  it('follows a Sunday week start', () => {
    const { result } = setup('2027-06-09', 7);
    act(() => void result.current.onKey('Home'));
    expect(result.current.focused).toBe('2027-06-06');
    act(() => void result.current.onKey('End'));
    expect(result.current.focused).toBe('2027-06-12');
  });

  it('changes month keeping the day where it exists', () => {
    const { result } = setup();
    act(() => result.current.goToMonth(1));
    expect(result.current.focused).toBe('2027-06-30');
    act(() => void result.current.onKey('PageDown'));
    expect(result.current.focused).toBe('2027-07-30');
    act(() => void result.current.onKey('PageUp'));
    expect(result.current.month).toBe('2027-06');
  });

  it('ignores other keys', () => {
    const { result } = setup();
    let handled = true;
    act(() => {
      handled = result.current.onKey('a');
    });
    expect(handled).toBe(false);
    expect(result.current.focused).toBe('2027-05-30');
  });

  it('pulls the cursor back in when the trip gets shorter', () => {
    const { result, rerender } = setup('2027-07-01');
    expect(result.current.month).toBe('2027-07');
    rerender({ r: { start_date: '2027-05-30', end_date: '2027-06-10' } });
    expect(result.current.month).toBe('2027-06');
    expect(result.current.focused).toBe('2027-06-30');
  });
});
