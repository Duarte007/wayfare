import { isIosSafari } from '../domain/install-hint';
import type { InstallEnvironment, InstallOutcome, InstallPrompts } from '../domain/pwa-ports';

/** Chromium's install prompt event; not in the DOM typings yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Captures `beforeinstallprompt` so the app can offer installing at a calm moment instead of the
 * browser's mini-infobar. Created at startup: the event can fire before React renders.
 */
export class BrowserInstallPrompts implements InstallPrompts {
  private deferred: BeforeInstallPromptEvent | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(target: Window = window) {
    target.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.set(event as BeforeInstallPromptEvent);
    });
    target.addEventListener('appinstalled', () => this.set(null));
  }

  private set(event: BeforeInstallPromptEvent | null) {
    this.deferred = event;
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  canPrompt = () => this.deferred !== null;

  async prompt(): Promise<InstallOutcome> {
    const event = this.deferred;
    if (!event) return 'unavailable';
    // The event can be used only once.
    this.set(null);
    await event.prompt();
    return (await event.userChoice).outcome;
  }
}

export const browserInstallEnvironment: InstallEnvironment = {
  isStandalone: () =>
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
  isIosSafari: () =>
    isIosSafari({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 }),
};
