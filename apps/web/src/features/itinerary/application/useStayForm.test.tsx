import { act, renderHook, waitFor } from '@testing-library/react';
import type { Stay } from '@wayfare/shared';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../auth/application/AuthProvider';
import type { AuthService } from '../../auth/domain/auth-service';
import type { ItineraryChange } from '../domain/itinerary-ports';
import { ItineraryProvider } from './ItineraryProvider';
import { useStayForm } from './useStayForm';

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

function setup(existing?: Stay) {
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
  const hook = renderHook(() => ({ form: useStayForm(stop, existing), auth: useAuth() }), {
    wrapper,
  });
  return { apply, hook };
}

describe('useStayForm', () => {
  it('saves a private stay for the whole city, created by the signed-in user', async () => {
    const { apply, hook } = setup();
    await waitFor(() => expect(hook.result.current.auth.session).not.toBeNull());
    act(() => hook.result.current.form.update({ name: 'Casa da Ana', shared: false }));
    await act(async () => {
      expect(await hook.result.current.form.save()).toBe(true);
    });
    expect(apply.mock.calls[0]![0].stays?.[0]).toMatchObject({
      name: 'Casa da Ana',
      stop_id: 's1',
      trip_id: 't1',
      check_in: '2027-05-01',
      check_out: '2027-05-04',
      visibility: 'private',
      created_by: 'u1',
    });
  });

  it('refuses to save without a name and removes an existing stay', async () => {
    const existing = {
      id: 'h1',
      trip_id: 't1',
      stop_id: 's1',
      name: 'Hotel',
      check_in: '2027-05-01',
      check_out: '2027-05-02',
      visibility: 'group' as const,
      assignees: [],
    };
    const { apply, hook } = setup(existing);
    await waitFor(() => expect(hook.result.current.auth.session).not.toBeNull());
    act(() => hook.result.current.form.update({ name: '' }));
    await act(async () => {
      expect(await hook.result.current.form.save()).toBe(false);
    });
    expect(hook.result.current.form.errors).toEqual(['name_required']);
    await act(async () => hook.result.current.form.remove());
    expect(apply).toHaveBeenCalledWith({ removed: { stays: ['h1'] } });
  });
});
