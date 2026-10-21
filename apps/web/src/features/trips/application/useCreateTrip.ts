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
 * Form state for a new trip. Saving writes to the device first, so it works offline; the change
 * waits in the outbox until sync sends it.
 */
export function useCreateTrip() {
  const repository = useTripRepository();
  const { session } = useAuth();
  const [input, setInput] = useState<NewTripInput>({ name: '', startDate: '', endDate: '' });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = validateNewTrip(input);
  // Errors appear after the first submit, or as soon as the dates contradict each other.
  const visibleErrors: NewTripError[] = submitted
    ? errors
    : errors.filter((e) => e === 'end_before_start');

  const update = (patch: Partial<NewTripInput>) =>
    setInput((current) => ({ ...current, ...patch }));

  /** Resolves to the new trip's id, or null when the form is not valid yet. */
  const submit = async (): Promise<string | null> => {
    setSubmitted(true);
    if (errors.length > 0 || !session || saving) return null;
    setSaving(true);
    try {
      const trip = buildTrip(input, session.userId, crypto.randomUUID());
      await repository.save(trip);
      return trip.id;
    } finally {
      setSaving(false);
    }
  };

  return { input, update, errors: visibleErrors, saving, submit };
}
