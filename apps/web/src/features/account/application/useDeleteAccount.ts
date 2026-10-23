import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import { markAccountDeleted } from './account-deleted-notice';
import { useAccountServices } from './AccountProvider';

export type DeleteStatus = 'idle' | 'deleting' | 'offline' | 'error';

/**
 * Deletes the account after the person types the confirmation word. Needs the network; on
 * success it signs out, which clears this device, and sign-in says the account is gone.
 */
export function useDeleteAccount(confirmWord: string) {
  const { signOut } = useAuth();
  const { deletion } = useAccountServices();
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<DeleteStatus>('idle');

  const canDelete =
    typed.trim().toLocaleLowerCase() === confirmWord.toLocaleLowerCase() && status !== 'deleting';

  const remove = async () => {
    if (!canDelete) return;
    if (!navigator.onLine) return setStatus('offline');
    setStatus('deleting');
    const result = await deletion.deleteAccount();
    if (!result.ok) return setStatus(result.reason === 'offline' ? 'offline' : 'error');
    markAccountDeleted();
    await signOut().catch(() => undefined);
  };

  const reset = () => {
    setTyped('');
    setStatus('idle');
  };

  return { typed, setTyped, status, canDelete, remove, reset };
}
