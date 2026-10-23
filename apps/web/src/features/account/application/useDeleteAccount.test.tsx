import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeleteAccountResult } from '../domain/account-ports';
import { takeAccountDeletedNotice } from './account-deleted-notice';
import { AccountProvider } from './AccountProvider';
import { useDeleteAccount } from './useDeleteAccount';

const signOut = vi.fn<() => Promise<void>>();
vi.mock('../../auth/application/AuthProvider', () => ({ useAuth: () => ({ signOut }) }));

function setup(result: DeleteAccountResult = { ok: true }) {
  const deleteAccount = vi.fn(async () => result);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AccountProvider
      data={{ readTables: vi.fn() }}
      files={{ save: vi.fn() }}
      deletion={{ deleteAccount }}
    >
      {children}
    </AccountProvider>
  );
  return { deleteAccount, ...renderHook(() => useDeleteAccount('delete'), { wrapper }) };
}

describe('useDeleteAccount', () => {
  beforeEach(() => {
    signOut.mockReset().mockResolvedValue();
    sessionStorage.clear();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  it('does nothing until the confirmation word is typed', async () => {
    const { result, deleteAccount } = setup();
    act(() => result.current.setTyped('delet'));
    expect(result.current.canDelete).toBe(false);
    await act(() => result.current.remove());
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes, signs out and leaves a notice for sign-in', async () => {
    const { result, deleteAccount } = setup();
    act(() => result.current.setTyped(' Delete '));
    expect(result.current.canDelete).toBe(true);
    await act(() => result.current.remove());
    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
    expect(takeAccountDeletedNotice()).toBe(true);
    expect(takeAccountDeletedNotice()).toBe(false);
  });

  it('offline, asks for a connection without calling the server', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result, deleteAccount } = setup();
    act(() => result.current.setTyped('delete'));
    await act(() => result.current.remove());
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(result.current.status).toBe('offline');
  });

  it('keeps the person signed in when the server refuses', async () => {
    const { result } = setup({ ok: false, reason: 'failed' });
    act(() => result.current.setTyped('delete'));
    await act(() => result.current.remove());
    expect(result.current.status).toBe('error');
    expect(signOut).not.toHaveBeenCalled();
    expect(takeAccountDeletedNotice()).toBe(false);
  });
});
