import { act, renderHook, waitFor } from '@testing-library/react';
import type { Trip } from '@wayfare/shared';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../auth/application/AuthProvider';
import type { AuthService } from '../../auth/domain/auth-service';
import type { TripRepository } from '../domain/trip-repository';
import { TripsProvider } from './TripsProvider';
import { useCreateTrip } from './useCreateTrip';

const session = {
  userId: '7e570000-0000-4000-8000-00000000a001',
  email: 'ana@example.com',
  displayName: 'Ana',
  avatarUrl: null,
  accessToken: 't',
};

function setup() {
  const save = vi.fn(async (_trip: Trip) => {});
  const repository: TripRepository = { observeAll: () => () => {}, save };
  const auth = {
    currentSession: async () => session,
    onSessionChange: () => () => {},
  } as unknown as AuthService;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider service={auth}>
      <TripsProvider repository={repository}>{children}</TripsProvider>
    </AuthProvider>
  );
  return { save, ...renderHook(() => useCreateTrip(), { wrapper }) };
}

describe('useCreateTrip', () => {
  it('saves a valid trip on the device, owned by the signed-in user', async () => {
    const { result, save } = setup();
    await waitFor(() => expect(result.current).toBeTruthy());
    act(() =>
      result.current.update({ name: 'Lisbon', startDate: '2027-05-01', endDate: '2027-05-08' }),
    );
    let id: string | null = null;
    await waitFor(async () => {
      await act(async () => {
        id = await result.current.submit();
      });
      expect(id).not.toBeNull();
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id, name: 'Lisbon', owner_id: session.userId }),
    );
  });

  it('shows errors and saves nothing when the form is incomplete', async () => {
    const { result, save } = setup();
    expect(result.current.errors).toEqual([]);
    await act(async () => {
      expect(await result.current.submit()).toBeNull();
    });
    expect(result.current.errors).toEqual(['name_required', 'dates_required']);
    expect(save).not.toHaveBeenCalled();
  });
});
