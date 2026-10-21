import type { InviteRole } from './group';

/** Why an invite call failed: no network, not allowed, a bad/expired/used-up link, or anything else. */
export type InviteFailure = 'offline' | 'denied' | 'invalid' | 'failed';

export class InviteError extends Error {
  constructor(readonly reason: InviteFailure) {
    super(`invite ${reason}`);
    this.name = 'InviteError';
  }
}

export interface AcceptedInvite {
  tripId: string;
  /** The person was already in the trip before opening the link. */
  alreadyMember: boolean;
}

/** Invite links live on the server: both calls need the network and throw `InviteError`. */
export interface InviteService {
  /** Returns the secret token of a new link. */
  create(tripId: string, role: InviteRole): Promise<string>;
  accept(token: string): Promise<AcceptedInvite>;
}

/** Keeps an invite token across the sign-in round trip (OAuth redirects included). */
export interface PendingInviteStore {
  save(token: string): void;
  peek(): string | null;
  clear(): void;
}

/** What joining or leaving a trip needs from the device's copy of the data. */
export interface TripAccess {
  /** One sync pass; it pulls trips the user just joined. */
  sync(): Promise<void>;
  /** Removes a trip and everything under it from this device. */
  forgetTrip(tripId: string): Promise<void>;
}
