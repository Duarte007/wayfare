import type { Stay, Stop } from '@wayfare/shared';
import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import {
  buildStay,
  emptyStayInput,
  stayToInput,
  validateStay,
  type StayError,
  type StayInput,
} from '../domain/stay';
import { useItineraryDependencies } from './ItineraryProvider';

/** Form state to add a stay to a city, or to edit / remove `existing`. Offline-first. */
export function useStayForm(stop: Stop, existing?: Stay) {
  const { repository } = useItineraryDependencies();
  const { session } = useAuth();
  const [input, setInput] = useState<StayInput>(
    existing ? stayToInput(existing) : emptyStayInput(stop),
  );
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = validateStay(input, stop);
  const visibleErrors: StayError[] = submitted ? errors : errors.filter((e) => e === 'url_invalid');

  const update = (patch: Partial<StayInput>) => setInput((current) => ({ ...current, ...patch }));

  const reset = () => {
    setInput(existing ? stayToInput(existing) : emptyStayInput(stop));
    setSubmitted(false);
  };

  /** True when saved; false when the form still has errors. */
  const save = async (): Promise<boolean> => {
    setSubmitted(true);
    if (errors.length > 0 || !session || saving) return false;
    setSaving(true);
    try {
      const stay = buildStay(
        input,
        {
          id: existing?.id ?? crypto.randomUUID(),
          tripId: stop.trip_id,
          stopId: stop.id,
          createdBy: session.userId,
        },
        existing,
      );
      await repository.apply({ stays: [stay] });
      return true;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (existing) await repository.apply({ removed: { stays: [existing.id] } });
  };

  return { input, update, errors: visibleErrors, saving, save, remove, reset };
}
