import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useOnline } from '../../../shared/lib/online';
import type { MemberDirectory, TripMember } from '../domain/members';

interface MembersState {
  directory: MemberDirectory;
  /** Bumped after a change (someone removed or joined) so every member list reloads. */
  revision: number;
  changed: () => void;
}

const MembersContext = createContext<MembersState | null>(null);

export function MembersProvider({
  directory,
  children,
}: {
  directory: MemberDirectory;
  children: ReactNode;
}) {
  const [revision, setRevision] = useState(0);
  const changed = useCallback(() => setRevision((r) => r + 1), []);
  const value = useMemo(() => ({ directory, revision, changed }), [directory, revision, changed]);
  return <MembersContext.Provider value={value}>{children}</MembersContext.Provider>;
}

function useMembersState(): MembersState {
  const state = useContext(MembersContext);
  if (!state) throw new Error('Member hooks must be used inside MembersProvider');
  return state;
}

export function useMemberDirectory(): MemberDirectory {
  return useMembersState().directory;
}

/** Call after changing who is on a trip, so lists on screen reload. */
export function useMembersChanged(): () => void {
  return useMembersState().changed;
}

/** The trip's members: what the device knows right away, refreshed when online. */
export function useTripMembers(tripId: string): TripMember[] {
  const { directory, revision } = useMembersState();
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
  }, [directory, tripId, online, revision]);

  return state?.tripId === tripId ? state.members : [];
}
