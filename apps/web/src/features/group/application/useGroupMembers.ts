import type { MemberRole } from '@wayfare/shared';
import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import {
  useMemberDirectory,
  useMembersChanged,
  useTripMembers,
} from '../../members/application/MembersProvider';
import { useGroupPorts } from './GroupProvider';

export type MemberChangeProblem = 'offline' | 'failed';

/** The trip's members plus what the viewer may do: remove others (owner) or leave (anyone else). */
export function useGroupMembers(trip: { id: string; owner_id: string }) {
  const { session } = useAuth();
  const members = useTripMembers(trip.id);
  const directory = useMemberDirectory();
  const membersChanged = useMembersChanged();
  const { access } = useGroupPorts();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MemberChangeProblem | null>(null);

  const userId = session?.userId;
  // Until the list loads (first open offline), the trip row still says who owns it.
  const myRole: MemberRole | undefined =
    members.find((m) => m.userId === userId)?.role ??
    (userId && userId === trip.owner_id ? 'owner' : undefined);

  const run = async (userIdToRemove: string, after?: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      const outcome = await directory.remove(trip.id, userIdToRemove);
      if (outcome !== 'removed') {
        setProblem(outcome);
        return false;
      }
      // After leaving there is no list to reload (and refreshing would cache an empty one).
      if (after) await after();
      else membersChanged();
      return true;
    } finally {
      setBusy(false);
    }
  };

  return {
    members,
    userId,
    myRole,
    busy,
    problem,
    remove: (memberId: string) => run(memberId),
    /** True once the trip is gone from the server and from this device. */
    leave: () => (userId ? run(userId, () => access.forgetTrip(trip.id)) : Promise.resolve(false)),
  };
}
