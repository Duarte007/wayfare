import type { MemberRole } from '@wayfare/shared';

export interface TripMember {
  userId: string;
  role: MemberRole;
  /** Profile name; null when the member never set one. */
  name: string | null;
}

/** Who is on a trip. The last list fetched stays on the device, so it works offline. */
export interface MemberDirectory {
  /** Last known members; empty when this device never loaded them. */
  cached(tripId: string): Promise<TripMember[]>;
  /** Fetches the current members and updates the cache; null when the server can't be reached. */
  refresh(tripId: string): Promise<TripMember[] | null>;
}

/** Owner first, then by name, so lists don't reshuffle between loads. */
export function sortMembers(members: readonly TripMember[]): TripMember[] {
  const rank = { owner: 0, editor: 1, viewer: 2 } as const;
  return [...members].sort(
    (a, b) =>
      rank[a.role] - rank[b.role] ||
      (a.name ?? '').localeCompare(b.name ?? '') ||
      a.userId.localeCompare(b.userId),
  );
}
