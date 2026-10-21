import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useOnline } from '../../../shared/lib/online';
import type { MemberDirectory, TripMember } from '../domain/members';

const MembersContext = createContext<MemberDirectory | null>(null);

export function MembersProvider({
  directory,
  children,
}: {
  directory: MemberDirectory;
  children: ReactNode;
}) {
  return <MembersContext.Provider value={directory}>{children}</MembersContext.Provider>;
}

function useMemberDirectory(): MemberDirectory {
  const directory = useContext(MembersContext);
  if (!directory) throw new Error('Member hooks must be used inside MembersProvider');
  return directory;
}

/** The trip's members: what the device knows right away, refreshed when online. */
export function useTripMembers(tripId: string): TripMember[] {
  const directory = useMemberDirectory();
  const online = useOnline();
  const [state, setState] = useState<{ tripId: string; members: TripMember[] }>();

  useEffect(() => {
    let active = true;
    const set = (members: TripMember[] | null) => {
      if (active && members) setState({ tripId, members });
    };
    void directory
      .cached(tripId)
      .then(set)
      .then(() => (online ? directory.refresh(tripId) : null))
      .then(set);
    return () => {
      active = false;
    };
  }, [directory, tripId, online]);

  return state?.tripId === tripId ? state.members : [];
}
