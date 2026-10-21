import { createContext, useContext, type ReactNode } from 'react';
import type { InviteService, PendingInviteStore, TripAccess } from '../domain/group-ports';

export interface GroupPorts {
  invites: InviteService;
  pendingInvite: PendingInviteStore;
  access: TripAccess;
}

const GroupContext = createContext<GroupPorts | null>(null);

export function GroupProvider({ children, ...ports }: GroupPorts & { children: ReactNode }) {
  return <GroupContext.Provider value={ports}>{children}</GroupContext.Provider>;
}

export function useGroupPorts(): GroupPorts {
  const ports = useContext(GroupContext);
  if (!ports) throw new Error('Group hooks must be used inside GroupProvider');
  return ports;
}

/** The invite waiting for its sign-in, if any (read once per render; it only changes on navigation). */
export function usePendingInvite(): string | null {
  return useGroupPorts().pendingInvite.peek();
}
