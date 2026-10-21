import type { PendingInviteStore } from '../domain/group-ports';

const KEY = 'wayfare.pendingInvite';

/**
 * sessionStorage: survives the sign-in page and OAuth redirects in this tab, and is gone when the
 * tab closes, so an old link never joins someone by surprise later. Storage can throw (private
 * mode, blocked storage); the invite page then just asks to open the link again.
 */
export class SessionPendingInviteStore implements PendingInviteStore {
  save(token: string) {
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      // Not kept; the person opens the link again after signing in.
    }
  }

  peek(): string | null {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // Nothing stored.
    }
  }
}
