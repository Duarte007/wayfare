import {
  filterView,
  type Activity,
  type ItineraryView,
  type Leg,
  type MemberRole,
  type Stay,
} from '@wayfare/shared';
import type { TripMember } from '../../members/domain/members';

/** Roles an invite can grant; owners are never invited. */
export const INVITE_ROLES = ['editor', 'viewer'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

/** Mirrors the `trip_invites` column defaults, so the dialog can say how long a link works. */
export const INVITE_DAYS = 7;
export const INVITE_MAX_USES = 10;

/** `create_trip_invite` lets owners and editors invite. */
export function canInvite(role: MemberRole | undefined): boolean {
  return role === 'owner' || role === 'editor';
}

/** The owner removes others; removing yourself is leaving. */
export function canRemove(viewer: Pick<TripMember, 'userId' | 'role'>, member: TripMember) {
  return viewer.role === 'owner' && member.userId !== viewer.userId;
}

/** Anyone but the owner can leave; the owner deletes the trip instead. */
export function canLeave(role: MemberRole | undefined): boolean {
  return role === 'editor' || role === 'viewer';
}

/** Tokens are URL-safe base64; anything else can't be an invite, so there's no need to ask. */
export function isInviteToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/invite/${encodeURIComponent(token)}`;
}

/** "Mine": the viewer's own itinerary. "Everyone": the plan the whole group follows. */
export const ITINERARY_MODES = ['mine', 'everyone'] as const;
export type ItineraryMode = (typeof ITINERARY_MODES)[number];

export function isItineraryMode(value: unknown): value is ItineraryMode {
  return value === 'mine' || value === 'everyone';
}

export function viewFor(mode: ItineraryMode, viewerId: string): ItineraryView {
  return mode === 'everyone' ? 'group' : { memberId: viewerId };
}

interface Plan {
  stays: Stay[];
  legs: Leg[];
  activities: Activity[];
}

/** Keeps the stays, legs and activities in the chosen view; private items stay with their creator. */
export function filterPlan<T extends Plan>(plan: T, mode: ItineraryMode, viewerId: string): T {
  const view = viewFor(mode, viewerId);
  return {
    ...plan,
    stays: filterView(plan.stays, view, viewerId),
    legs: filterView(plan.legs, view, viewerId),
    activities: filterView(plan.activities, view, viewerId),
  };
}
