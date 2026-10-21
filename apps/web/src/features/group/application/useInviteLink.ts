import { useState } from 'react';
import { inviteUrl, type InviteRole } from '../domain/group';
import { InviteError, type InviteFailure } from '../domain/group-ports';
import { useGroupPorts } from './GroupProvider';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'copyFailed';

/** Creating an invite link for a role, then sharing it (Web Share API) or copying it. */
export function useInviteLink(tripId: string, shareText: string) {
  const { invites } = useGroupPorts();
  const [role, setRoleState] = useState<InviteRole>('editor');
  const [link, setLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<InviteFailure | null>(null);

  /** A link grants one role, so picking another one asks for a new link. */
  const setRole = (next: InviteRole) => {
    setRoleState(next);
    setLink(null);
  };

  const reset = () => {
    setLink(null);
    setError(null);
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      setLink(inviteUrl(window.location.origin, await invites.create(tripId, role)));
    } catch (e) {
      setError(e instanceof InviteError ? e.reason : 'failed');
    } finally {
      setCreating(false);
    }
  };

  const copy = async (): Promise<ShareOutcome> => {
    if (!link) return 'copyFailed';
    try {
      await navigator.clipboard.writeText(link);
      return 'copied';
    } catch {
      return 'copyFailed';
    }
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  /** The phone's share sheet when there is one; otherwise the link goes to the clipboard. */
  const share = async (): Promise<ShareOutcome> => {
    if (!link) return 'copyFailed';
    if (!canShare) return copy();
    try {
      await navigator.share({ text: shareText, url: link });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      return copy();
    }
  };

  return { role, setRole, link, creating, error, create, share, copy, canShare, reset };
}
