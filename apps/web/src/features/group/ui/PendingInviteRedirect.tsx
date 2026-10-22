import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { usePendingInvite } from '../application/GroupProvider';

/**
 * After sign-in (password or OAuth), sends someone who opened an invite back to it.
 * Kept apart from InvitePage so the app shell does not pull the invite screen into the first load.
 */
export function PendingInviteRedirect({ children }: { children: ReactNode }) {
  const token = usePendingInvite();
  return token ? <Navigate to="/invite/$token" params={{ token }} replace /> : children;
}
