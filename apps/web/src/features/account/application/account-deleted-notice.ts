const KEY = 'wayfare.accountDeleted';

/** Remembers, for this tab only, that the account was just deleted, so sign-in can say so. */
export function markAccountDeleted(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // The sign-in page just won't show the message.
  }
}

/** Whether the account was just deleted; the notice shows once. */
export function takeAccountDeletedNotice(): boolean {
  try {
    const deleted = sessionStorage.getItem(KEY) === '1';
    sessionStorage.removeItem(KEY);
    return deleted;
  } catch {
    return false;
  }
}
