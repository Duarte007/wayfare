import type { Activity, Stop } from '@wayfare/shared';
import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import {
  activityToInput,
  buildActivity,
  emptyActivityInput,
  setBooked,
  validateActivity,
  type ActivityError,
  type ActivityInput,
} from '../domain/activity';
import { useItineraryDependencies } from './ItineraryProvider';

/** Add a thing to do in a city, or edit / remove `existing`. Offline-first. */
export function useActivityForm(stop: Stop, existing?: Activity) {
  const { repository } = useItineraryDependencies();
  const { session } = useAuth();
  const initial = () => (existing ? activityToInput(existing) : emptyActivityInput());
  const [input, setInput] = useState<ActivityInput>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = validateActivity(input, stop);
  const visibleErrors: ActivityError[] = submitted
    ? errors
    : errors.filter((e) => e !== 'title_required');

  const update = (patch: Partial<ActivityInput>) =>
    setInput((current) => ({ ...current, ...patch }));

  const reset = () => {
    setInput(initial());
    setSubmitted(false);
  };

  /** True when saved; false when the form still has errors. */
  const save = async (): Promise<boolean> => {
    setSubmitted(true);
    if (errors.length > 0 || !session || saving) return false;
    setSaving(true);
    try {
      const activity = buildActivity(
        input,
        {
          id: existing?.id ?? crypto.randomUUID(),
          tripId: stop.trip_id,
          stopId: stop.id,
          createdBy: session.userId,
        },
        existing,
      );
      await repository.apply({ activities: [activity] });
      return true;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (existing) await repository.apply({ removed: { activities: [existing.id] } });
  };

  return { input, update, errors: visibleErrors, saving, save, remove, reset };
}

/** Ticks a booking off straight from the timeline. */
export function useToggleBooked(): (activity: Activity, booked: boolean) => Promise<void> {
  const { repository } = useItineraryDependencies();
  return (activity, booked) => repository.apply({ activities: [setBooked(activity, booked)] });
}
