import { act, renderHook, waitFor } from '@testing-library/react';
import type { Activity } from '@wayfare/shared';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../auth/application/AuthProvider';
import type { AuthService } from '../../auth/domain/auth-service';
import type { ItineraryChange } from '../domain/itinerary-ports';
import { ItineraryProvider } from './ItineraryProvider';
import { useActivityForm, useToggleBooked } from './useActivityForm';

const stop = {
  id: 's1',
  trip_id: 't1',
  place_id: 'p1',
  position: 0,
  color_index: 0,
  start_date: '2027-05-01',
  end_date: '2027-05-04',
  visibility: 'group' as const,
  assignees: [],
};
const session = {
  userId: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  avatarUrl: null,
  accessToken: 't',
};

function setup(existing?: Activity) {
  const apply = vi.fn(async (_c: ItineraryChange) => {});
  const auth = {
    currentSession: async () => session,
    onSessionChange: () => () => {},
  } as unknown as AuthService;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider service={auth}>
      <ItineraryProvider repository={{ apply }} placeSearch={{ search: vi.fn() }}>
        {children}
      </ItineraryProvider>
    </AuthProvider>
  );
  const hook = renderHook(
    () => ({ form: useActivityForm(stop, existing), toggle: useToggleBooked(), auth: useAuth() }),
    {
      wrapper,
    },
  );
  return { apply, hook };
}

describe('useActivityForm', () => {
  it('only shows the missing-title error after trying to save', async () => {
    const { apply, hook } = setup();
    await waitFor(() => expect(hook.result.current.auth.session).not.toBeNull());
    expect(hook.result.current.form.errors).toEqual([]);
    await act(async () => {
      expect(await hook.result.current.form.save()).toBe(false);
    });
    expect(hook.result.current.form.errors).toEqual(['title_required']);
    expect(apply).not.toHaveBeenCalled();
  });

  it('saves a dated activity to book, created by the signed-in user', async () => {
    const { apply, hook } = setup();
    await waitFor(() => expect(hook.result.current.auth.session).not.toBeNull());
    act(() =>
      hook.result.current.form.update({
        title: 'Museu',
        date: '2027-05-02',
        time: '10:00',
        needsBooking: true,
      }),
    );
    await act(async () => {
      expect(await hook.result.current.form.save()).toBe(true);
    });
    const saved = apply.mock.calls[0]![0].activities?.[0];
    expect(saved).toMatchObject({
      title: 'Museu',
      stop_id: 's1',
      trip_id: 't1',
      date: '2027-05-02',
      start_time: '10:00',
      needs_booking: true,
      booked: false,
      created_by: 'u1',
    });

    await act(() => hook.result.current.toggle(saved!, true));
    expect(apply.mock.calls[1]![0].activities?.[0]).toMatchObject({ id: saved!.id, booked: true });
  });

  it('removes an existing activity', async () => {
    const existing = {
      id: 'a1',
      trip_id: 't1',
      stop_id: 's1',
      title: 'x',
      needs_booking: false,
      booked: false,
      source: 'user',
      visibility: 'group',
      assignees: [],
    } satisfies Activity;
    const { apply, hook } = setup(existing);
    await act(() => hook.result.current.form.remove());
    expect(apply).toHaveBeenCalledWith({ removed: { activities: ['a1'] } });
  });
});
