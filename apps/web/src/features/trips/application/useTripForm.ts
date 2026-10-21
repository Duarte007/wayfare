import type { Trip } from '@wayfare/shared';
import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import {
  buildTrip,
  validateNewTrip,
  type NewTripError,
  type NewTripInput,
} from '../domain/new-trip';
import { useTripRepository } from './TripsProvider';

/**
 * Form state to create a trip, or to edit `existing`. Saving writes to the device first, so it
 * works offline; the change waits in the outbox until sync sends it.
 */
export function useTripForm(existing?: Trip) {
  const repository = useTripRepository();
  const { session } = useAuth();
  const [input, setInput] = useState<NewTripInput>({
    name: existing?.name ?? '',
    startDate: existing?.start_date ?? '',
    endDate: existing?.end_date ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = validateNewTrip(input);
  // Errors appear after the first submit, or as soon as the dates contradict each other.
  const visibleErrors: NewTripError[] = submitted
    ? errors
    : errors.filter((e) => e === 'end_before_start');

  const update = (patch: Partial<NewTripInput>) =>
    setInput((current) => ({ ...current, ...patch }));

  /** Resolves to the trip's id, or null when the form is not valid yet. */
  const submit = async (): Promise<string | null> => {
    setSubmitted(true);
    if (errors.length > 0 || !session || saving) return null;
    setSaving(true);
    try {
      // Editing keeps the id and the owner; only the trip's own fields change.
      const trip = existing
        ? { ...existing, ...buildTrip(input, existing.owner_id, existing.id) }
        : buildTrip(input, session.userId, crypto.randomUUID());
      await repository.save(trip);
      return trip.id;
    } finally {
      setSaving(false);
    }
  };

  return { input, update, errors: visibleErrors, saving, submit };
}
