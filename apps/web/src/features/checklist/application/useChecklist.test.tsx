import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChecklistItem, ChecklistSuggestion } from '@wayfare/shared';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../auth/application/AuthProvider';
import type { AuthService } from '../../auth/domain/auth-service';
import type {
  ChecklistChange,
  ChecklistData,
  ChecklistRepository,
} from '../domain/checklist-ports';
import { ChecklistProvider } from './ChecklistProvider';
import { useAddSuggestions, useChecklist, useToggleDone } from './useChecklist';
import { useChecklistItemForm } from './useChecklistItemForm';

const session = {
  userId: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  avatarUrl: null,
  accessToken: 't',
};
const trip = {
  id: 't1',
  owner_id: 'u1',
  name: 'Trip',
  start_date: '2099-06-30',
  end_date: '2099-07-10',
};
const existingItem: ChecklistItem = {
  id: 'c1',
  trip_id: 't1',
  group_key: 'documents',
  title: 'Passport',
  done: false,
  position: 0,
  template_key: 'passport_validity',
  visibility: 'group',
  assignees: [],
};

/** In-memory repository: applies changes to its data and notifies the observer. */
function fakeRepository(initial: ChecklistData | null) {
  let data = initial;
  const listeners = new Set<(d: ChecklistData | null) => void>();
  const apply = vi.fn(async (change: ChecklistChange) => {
    if (!data) return;
    const removed = new Set(change.removed ?? []);
    const upserts = new Map((change.items ?? []).map((i) => [i.id, i]));
    data = {
      ...data,
      items: [
        ...data.items.filter((i) => !removed.has(i.id) && !upserts.has(i.id)),
        ...upserts.values(),
      ],
    };
    listeners.forEach((l) => l(data));
  });
  const repository: ChecklistRepository = {
    observe(_tripId, listener) {
      listeners.add(listener);
      queueMicrotask(() => listener(data));
      return () => listeners.delete(listener);
    },
    apply,
  };
  return { repository, apply };
}

function wrapperFor(repository: ChecklistRepository) {
  const auth = {
    currentSession: async () => session,
    onSessionChange: () => () => {},
  } as unknown as AuthService;
  return ({ children }: { children: ReactNode }) => (
    <AuthProvider service={auth}>
      <ChecklistProvider repository={repository}>{children}</ChecklistProvider>
    </AuthProvider>
  );
}

const japan: ChecklistData = {
  trip,
  items: [existingItem],
  places: [
    {
      id: 'p1',
      trip_id: 't1',
      name: 'City',
      lat: 0,
      lng: 0,
      country_code: 'JP',
    },
  ],
  stops: [
    {
      id: 's1',
      trip_id: 't1',
      place_id: 'p1',
      start_date: '2099-06-30',
      end_date: '2099-07-10',
      position: 0,
      color_index: 0,
      visibility: 'group',
      assignees: [],
    },
  ],
};

describe('useChecklist', () => {
  it('reads the list, ticks items and adds picked suggestions once', async () => {
    const { repository, apply } = fakeRepository(japan);
    const hook = renderHook(
      () => {
        const view = useChecklist('t1');
        return {
          view,
          toggle: useToggleDone(),
          add: useAddSuggestions(view ?? { trip, items: [] }),
          auth: useAuth(),
        };
      },
      { wrapper: wrapperFor(repository) },
    );
    await waitFor(() => expect(hook.result.current.view).toBeTruthy());
    await waitFor(() => expect(hook.result.current.auth.session).not.toBeNull());
    const view = hook.result.current.view!;
    expect(view.progress).toEqual({ done: 0, total: 1 });
    // The trip goes to a country with a template the list has nothing from yet.
    expect(view.suggestions.prominent).toBe(true);
    expect(view.suggestions.items.map((s) => s.key)).not.toContain('passport_validity');

    await act(() => hook.result.current.toggle(existingItem, true));
    expect(apply).toHaveBeenLastCalledWith({ items: [{ ...existingItem, done: true }] });
    await waitFor(() => expect(hook.result.current.view!.progress.done).toBe(1));

    const pick = (key: string): ChecklistSuggestion & { title: string } => ({
      ...view.suggestions.items.find((s) => s.key === key)!,
      title: `T:${key}`,
    });
    await act(() => hook.result.current.add([pick('jp_ic_card'), pick('jp_cash')]));
    const added = apply.mock.lastCall![0].items!;
    expect(added.map((i) => [i.template_key, i.title, i.created_by])).toEqual([
      ['jp_ic_card', 'T:jp_ic_card', 'u1'],
      ['jp_cash', 'T:jp_cash', 'u1'],
    ]);
    await waitFor(() => expect(hook.result.current.view!.items).toHaveLength(3));
    expect(hook.result.current.view!.suggestions.prominent).toBe(false);
  });

  it('is null when the trip is not on the device', async () => {
    const { repository } = fakeRepository(null);
    const hook = renderHook(() => useChecklist('t1'), { wrapper: wrapperFor(repository) });
    await waitFor(() => expect(hook.result.current).toBeNull());
  });
});

describe('useChecklistItemForm', () => {
  it('shows the title error only after trying to save, then saves at the end of the list', async () => {
    const { repository, apply } = fakeRepository(japan);
    const hook = renderHook(
      () => ({
        form: useChecklistItemForm({ tripId: 't1', items: [existingItem], group: 'money' }),
        auth: useAuth(),
      }),
      { wrapper: wrapperFor(repository) },
    );
    await waitFor(() => expect(hook.result.current.auth.session).not.toBeNull());
    expect(hook.result.current.form.errors).toEqual([]);
    await act(async () => {
      expect(await hook.result.current.form.save()).toBe(false);
    });
    expect(hook.result.current.form.errors).toEqual(['title_required']);

    act(() => hook.result.current.form.update({ title: 'Exchange money', assignees: ['u2'] }));
    await act(async () => {
      expect(await hook.result.current.form.save()).toBe(true);
    });
    expect(apply.mock.lastCall![0].items![0]).toMatchObject({
      title: 'Exchange money',
      group_key: 'money',
      position: 1,
      assignees: ['u2'],
      created_by: 'u1',
      trip_id: 't1',
    });
  });

  it('removes an existing item', async () => {
    const { repository, apply } = fakeRepository(japan);
    const hook = renderHook(
      () => useChecklistItemForm({ tripId: 't1', items: [existingItem] }, existingItem),
      { wrapper: wrapperFor(repository) },
    );
    await act(() => hook.result.current.remove());
    expect(apply).toHaveBeenCalledWith({ removed: ['c1'] });
  });
});
