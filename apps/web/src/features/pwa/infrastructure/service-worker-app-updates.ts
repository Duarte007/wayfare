import { registerSW } from 'virtual:pwa-register';
import type { AppUpdates } from '../domain/pwa-ports';

/** Long-lived tabs (an installed app left open for days) still hear about new versions. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * vite-plugin-pwa in "prompt" mode: a new service worker installs in the background and waits.
 * Code never swaps mid-session; the person chooses when to reload into the new version.
 */
export class ServiceWorkerAppUpdates implements AppUpdates {
  private waiting = false;
  private readonly listeners = new Set<() => void>();
  private update: ((reloadPage?: boolean) => Promise<void>) | null = null;

  register(): void {
    this.update = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        this.waiting = true;
        this.listeners.forEach((listener) => listener());
      },
      onRegisteredSW: (_url, registration) => {
        if (!registration) return;
        setInterval(() => {
          if (navigator.onLine) void registration.update().catch(() => undefined);
        }, CHECK_EVERY_MS);
      },
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  isWaiting = () => this.waiting;

  async activate(): Promise<void> {
    // Tells the waiting worker to skip waiting, then reloads once it controls the page.
    if (this.update) await this.update(true);
    else window.location.reload();
  }
}
