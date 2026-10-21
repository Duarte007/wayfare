import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnline } from '../../../shared/lib/online';
import { useAuth } from '../../auth/application/AuthProvider';
import { useMembersChanged } from '../../members/application/MembersProvider';
import { isInviteToken } from '../domain/group';
import { InviteError } from '../domain/group-ports';
import { useGroupPorts } from './GroupProvider';

export type JoinState =
  | { status: 'signedOut' }
  | { status: 'offline' }
  | { status: 'joining' }
  | { status: 'joined'; tripId: string }
  | { status: 'alreadyMember'; tripId: string }
  | { status: 'invalid' }
  | { status: 'failed' };

/**
 * Opening `/invite/<token>`: signed out, the token waits in the pending store for sign-in;
 * signed in and online, it joins once, syncs so the trip is on the device, then reports back.
 */
export function useInviteAcceptance(token: string): { state: JoinState; retry: () => void } {
  const { invites, pendingInvite, access } = useGroupPorts();
  const membersChanged = useMembersChanged();
  const { session } = useAuth();
  const online = useOnline();
  const valid = isInviteToken(token);
  const userId = session?.userId ?? null;

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: JoinState }>();
  const started = useRef<string | null>(null);
  const key = `${token}:${userId}:${attempt}`;

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Coming back online retries an attempt that could not reach the server.
  useEffect(() => {
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [retry]);

  useEffect(() => {
    if (!valid) {
      pendingInvite.clear();
      return;
    }
    if (!userId) {
      pendingInvite.save(token);
      return;
    }
    if (!online) return;
    // One call per attempt, even when React runs effects twice: every call uses up the link.
    if (started.current === key) return;
    started.current = key;
    void invites
      .accept(token)
      .then(async ({ tripId, alreadyMember }) => {
        pendingInvite.clear();
        if (!alreadyMember) {
          await access.sync().catch(() => undefined);
          membersChanged();
        }
        setResult({ key, state: { status: alreadyMember ? 'alreadyMember' : 'joined', tripId } });
      })
      .catch((error: unknown) => {
        const reason = error instanceof InviteError ? error.reason : 'failed';
        if (reason === 'offline') {
          setResult({ key, state: { status: 'offline' } });
          return;
        }
        pendingInvite.clear();
        setResult({ key, state: { status: reason === 'invalid' ? 'invalid' : 'failed' } });
      });
  }, [valid, userId, online, key, token, invites, pendingInvite, access, membersChanged]);

  let state: JoinState;
  if (!valid) state = { status: 'invalid' };
  else if (!userId) state = { status: 'signedOut' };
  else if (result?.key === key) state = result.state;
  else if (!online) state = { status: 'offline' };
  else state = { status: 'joining' };
  return { state, retry };
}
