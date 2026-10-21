import type { ChecklistGroup, ChecklistItem } from '@wayfare/shared';
import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import {
  buildChecklistItem,
  checklistItemToInput,
  emptyChecklistInput,
  nextPosition,
  validateChecklistItem,
  type ChecklistItemError,
  type ChecklistItemInput,
} from '../domain/checklist';
import { useChecklistRepository } from './ChecklistProvider';

/** Add a to-do to a trip's checklist, or edit / remove `existing`. Offline-first. */
export function useChecklistItemForm(
  context: { tripId: string; items: readonly ChecklistItem[]; group?: ChecklistGroup },
  existing?: ChecklistItem,
) {
  const repository = useChecklistRepository();
  const { session } = useAuth();
  const initial = () =>
    existing ? checklistItemToInput(existing) : emptyChecklistInput(context.group);
  const [input, setInput] = useState<ChecklistItemInput>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = validateChecklistItem(input);
  const visibleErrors: ChecklistItemError[] = submitted ? errors : [];

  const update = (patch: Partial<ChecklistItemInput>) =>
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
      const item = buildChecklistItem(
        input,
        {
          id: existing?.id ?? crypto.randomUUID(),
          tripId: context.tripId,
          createdBy: session.userId,
          position: nextPosition(context.items),
        },
        existing,
      );
      await repository.apply({ items: [item] });
      return true;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (existing) await repository.apply({ removed: [existing.id] });
  };

  return { input, update, errors: visibleErrors, saving, save, remove, reset };
}
