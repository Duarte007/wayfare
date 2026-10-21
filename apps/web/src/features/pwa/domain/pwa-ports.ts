/** Something the UI can listen to; returns the unsubscribe function. */
export type Subscribe = (listener: () => void) => () => void;

/** A newer version of the app downloaded by the service worker, waiting to take over. */
export interface AppUpdates {
  subscribe: Subscribe;
  isWaiting(): boolean;
  /** Activates the waiting version and reloads the page. */
  activate(): Promise<void>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/** The browser's own install prompt, captured from `beforeinstallprompt`. */
export interface InstallPrompts {
  subscribe: Subscribe;
  canPrompt(): boolean;
  prompt(): Promise<InstallOutcome>;
}

/** Facts about where the app runs, read once per render. */
export interface InstallEnvironment {
  isStandalone(): boolean;
  isIosSafari(): boolean;
}
