import type { ChecklistItem, ChecklistSuggestion, Trip } from '@wayfare/shared';
import { useEffect, useState } from 'react';
import { localToday } from '@/shared/lib/dates';
import { useAuth } from '../../auth/application/AuthProvider';
import {
  buildSuggestedItems,
  checklistProgress,
  groupChecklist,
  pendingSuggestions,
  setDone,
  tripCountries,
  type ChecklistSection,
  type PendingSuggestions,
} from '../domain/checklist';
import type { ChecklistData } from '../domain/checklist-ports';
import { useChecklistRepository } from './ChecklistProvider';

export interface ChecklistView {
  trip: Trip;
  items: ChecklistItem[];
  sections: ChecklistSection[];
  progress: { done: number; total: number };
  suggestions: PendingSuggestions;
}

export function toChecklistView(data: ChecklistData): ChecklistView {
  const countries = tripCountries(data.places, data.stops);
  return {
    trip: data.trip,
    items: data.items,
    sections: groupChecklist(data.items),
    progress: checklistProgress(data.items),
    suggestions: pendingSuggestions(countries, data.items),
  };
}

/** `undefined` while reading the device, `null` when the trip isn't here. Offline-first. */
export function useChecklist(tripId: string): ChecklistView | null | undefined {
  const repository = useChecklistRepository();
  const [state, setState] = useState<{ id: string; data: ChecklistData | null }>();
  useEffect(
    () => repository.observe(tripId, (data) => setState({ id: tripId, data })),
    [repository, tripId],
  );
  if (state?.id !== tripId) return undefined;
  return state.data ? toChecklistView(state.data) : null;
}

/** Ticks an item off (or back on) straight from the list. */
export function useToggleDone(): (item: ChecklistItem, done: boolean) => Promise<void> {
  const repository = useChecklistRepository();
  return (item, done) => repository.apply({ items: [setDone(item, done)] });
}

/** Adds the suggestions the user picked; titles come translated from the screen. */
export function useAddSuggestions(
  view: Pick<ChecklistView, 'trip' | 'items'>,
): (picked: (ChecklistSuggestion & { title: string })[]) => Promise<void> {
  const repository = useChecklistRepository();
  const { session } = useAuth();
  return async (picked) => {
    if (!session) return;
    const items = buildSuggestedItems(picked, {
      tripId: view.trip.id,
      tripStart: view.trip.start_date,
      today: localToday(),
      createdBy: session.userId,
      existing: view.items,
      newId: () => crypto.randomUUID(),
    });
    if (items.length) await repository.apply({ items });
  };
}
