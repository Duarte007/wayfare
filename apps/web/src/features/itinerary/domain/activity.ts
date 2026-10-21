import type { Activity, Stop, Visibility } from '@wayfare/shared';
import { isHttpUrl } from './url';

export interface ActivityInput {
  title: string;
  /** YYYY-MM-DD, or '' when not scheduled yet. */
  date: string;
  /** "HH:mm", or '' for any time that day. */
  time: string;
  needsBooking: boolean;
  booked: boolean;
  url: string;
  notes: string;
  /** Members it is for; empty means everyone. */
  assignees: string[];
  shared: boolean;
}

export type ActivityError = 'title_required' | 'outside_city' | 'url_invalid';

export const ACTIVITY_TITLE_MAX = 200;

export function emptyActivityInput(): ActivityInput {
  return {
    title: '',
    date: '',
    time: '',
    needsBooking: false,
    booked: false,
    url: '',
    notes: '',
    assignees: [],
    shared: true,
  };
}

export function activityToInput(activity: Activity): ActivityInput {
  return {
    title: activity.title,
    date: activity.date ?? '',
    time: activity.start_time?.slice(0, 5) ?? '',
    needsBooking: activity.needs_booking,
    booked: activity.booked,
    url: activity.url ?? '',
    notes: activity.notes ?? '',
    assignees: [...activity.assignees],
    shared: activity.visibility !== 'private',
  };
}

/** An activity can happen on any day you are in the city, departure day included. */
export function validateActivity(
  input: ActivityInput,
  stop: Pick<Stop, 'start_date' | 'end_date'>,
): ActivityError[] {
  const errors: ActivityError[] = [];
  if (!input.title.trim()) errors.push('title_required');
  if (input.date && (input.date < stop.start_date || input.date > stop.end_date))
    errors.push('outside_city');
  if (input.url.trim() && !isHttpUrl(input.url.trim())) errors.push('url_invalid');
  return errors;
}

export function buildActivity(
  input: ActivityInput,
  context: { id: string; tripId: string; stopId: string; createdBy: string },
  existing?: Activity,
): Activity {
  const optional = (v: string) => v.trim() || null;
  const visibility: Visibility = input.shared ? 'group' : 'private';
  return {
    ...(existing ?? { source: 'user' as const }),
    id: context.id,
    trip_id: context.tripId,
    stop_id: context.stopId,
    created_by: existing?.created_by ?? context.createdBy,
    title: input.title.trim().slice(0, ACTIVITY_TITLE_MAX),
    date: input.date || null,
    // A time only means something on a given day.
    start_time: input.date && input.time ? input.time : null,
    needs_booking: input.needsBooking,
    booked: input.needsBooking && input.booked,
    url: optional(input.url),
    notes: optional(input.notes),
    // Private items are only for whoever added them.
    assignees: input.shared ? [...new Set(input.assignees)].sort() : [],
    visibility,
  };
}

/** Ticks a booking off (or back on) without opening the form. */
export function setBooked(activity: Activity, booked: boolean): Activity {
  return { ...activity, needs_booking: activity.needs_booking || booked, booked };
}

/** Scheduled first (by day, then time; any-time before timed), then the rest by title. */
export function sortActivities(activities: readonly Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    if (a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    }
    const at = a.start_time ?? '';
    const bt = b.start_time ?? '';
    return at.localeCompare(bt) || a.title.localeCompare(b.title);
  });
}

/** For the timeline: how many activities, and how many still need booking. */
export function activityCounts(activities: readonly Activity[]): { total: number; toBook: number } {
  return {
    total: activities.length,
    toBook: activities.filter((a) => a.needs_booking && !a.booked).length,
  };
}
