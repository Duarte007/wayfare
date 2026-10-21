import type { Leg } from '@wayfare/shared';
import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import type { ItineraryStop } from '../../trips/domain/trip-overview';
import { buildLeg, emptyLegInput, legToInput, validateLeg, type LegInput } from '../domain/leg';
import { useItineraryDependencies } from './ItineraryProvider';

/** How you get from `from` to `to`: add, edit or remove the leg between two cities. */
export function useLegForm(from: ItineraryStop, to: ItineraryStop, existing?: Leg | null) {
  const { repository } = useItineraryDependencies();
  const { session } = useAuth();
  const initial = () => {
    const blank = emptyLegInput({ stop: from.stop, place: from.place }, { place: to.place });
    return existing ? legToInput(existing, blank) : blank;
  };
  const [input, setInput] = useState<LegInput>(initial);
  const [saving, setSaving] = useState(false);
  const errors = validateLeg(input);

  const update = (patch: Partial<LegInput>) => setInput((current) => ({ ...current, ...patch }));

  const save = async (): Promise<boolean> => {
    if (errors.length > 0 || !session || saving) return false;
    setSaving(true);
    try {
      const leg = buildLeg(
        input,
        {
          id: existing?.id ?? crypto.randomUUID(),
          tripId: from.stop.trip_id,
          fromStopId: from.stop.id,
          toStopId: to.stop.id,
          createdBy: session.userId,
        },
        existing ?? undefined,
      );
      await repository.apply({ legs: [leg] });
      return true;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (existing) await repository.apply({ removed: { legs: [existing.id] } });
  };

  return { input, update, errors, saving, save, remove, reset: () => setInput(initial()) };
}
