import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Edits the name trip mates see. Needs the network; the form says so when it fails. */
export function useDisplayNameForm() {
  const { service, session } = useAuth();
  const [name, setName] = useState(session?.displayName ?? '');
  const [status, setStatus] = useState<SaveStatus>('idle');

  const trimmed = name.trim();
  const canSave =
    trimmed.length > 0 && trimmed.length <= 80 && trimmed !== (session?.displayName ?? '');

  const save = async () => {
    if (!canSave) return;
    setStatus('saving');
    const result = await service.updateDisplayName(trimmed);
    setStatus(result.ok ? 'saved' : 'error');
  };

  const change = (value: string) => {
    setName(value);
    if (status !== 'saving') setStatus('idle');
  };

  return { name, setName: change, status, canSave, save };
}
