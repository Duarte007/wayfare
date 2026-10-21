import { act, renderHook, waitFor } from '@testing-library/react';
import type { Trip } from '@wayfare/shared';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../auth/application/AuthProvider';
import type { AuthService } from '../../auth/domain/auth-service';
import type { TripRepository } from '../domain/trip-repository';
import { TripsProvider } from './TripsProvider';
import { useTripForm } from './useTripForm';

const session = {
  userId: '7e570000-0000-4000-8000-00000000a001',
  email: 'ana@example.com',
  displayName: 'Ana',
  avatarUrl: null,
  accessToken: 't',
};

function setup(existing?: Trip) {
  const save = vi.fn(async (_trip: Trip) => {});
  const repository: TripRepository = {
    observeAll: () => () => {},
    observeTrip: () => () => {},
    save,
    remove: async () => {},
  };
  const auth = {
    currentSession: async () => session,
    onSessionChange: () => () => {},
  } as unknown as AuthService;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider service={auth}>
      <TripsProvider repository={repository}>{children}</TripsProvider>
    </AuthProvider>
  );
  const hook = renderHook(() => ({ form: useTripForm(existing), auth: useAuth() }), { wrapper });
  return { save, hook };
}

/** The fake session resolves asynchronously, like the real one read from storage. */
async function signedIn(hook: ReturnType<typeof setup>['hook']) {
  await waitFor(() => expect(hook.result.current.auth.session).not.toBeNull());
  return hook.result;
}

describe('useTripForm', () => {
  it('saves a valid trip on the device, owned by the signed-in user', async () => {
    const { hook, save } = setup();
    const result = await signedIn(hook);
    act(() =>
      result.current.form.update({
        name: 'Lisbon',
        startDate: '2027-05-01',
        endDate: '2027-05-08',
      }),
    );
    let id: string | null = null;
    await act(async () => {
      id = await result.current.form.submit();
    });
    expect(id).not.toBeNull();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id, name: 'Lisbon', owner_id: session.userId }),
    );
  });

  it('shows errors and saves nothing when the form is incomplete', async () => {
    const { hook, save } = setup();
    const result = await signedIn(hook);
    expect(result.current.form.errors).toEqual([]);
    await act(async () => {
      expect(await result.current.form.submit()).toBeNull();
    });
    expect(result.current.form.errors).toEqual(['name_required', 'dates_required']);
    expect(save).not.toHaveBeenCalled();
  });

  it('edits a trip in place, keeping its id and owner', async () => {
    const existing = {
      id: crypto.randomUUID(),
      owner_id: 'someone-else',
      name: 'Old name',
      start_date: '2027-05-01',
      end_date: '2027-05-08',
      version: 4,
    };
    const { hook, save } = setup(existing);
    const result = await signedIn(hook);
    expect(result.current.form.input.name).toBe('Old name');
    act(() => result.current.form.update({ name: 'Lisbon & Porto' }));
    await act(async () => {
      expect(await result.current.form.submit()).toBe(existing.id);
    });
    expect(save).toHaveBeenCalledWith({ ...existing, name: 'Lisbon & Porto' });
  });
});
