import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { readPref, writePref } from '../../../shared/lib/storage';
import { chooseInstallHint, type InstallHint } from '../domain/install-hint';
import type { AppUpdates, InstallEnvironment, InstallPrompts } from '../domain/pwa-ports';

export const INSTALL_HINT_DISMISSED_KEY = 'wayfare.installHintDismissed';

/** How long a reload waits for pending changes to sync before going ahead anyway. */
export const FLUSH_TIMEOUT_MS = 3000;

interface PwaPorts {
  updates: AppUpdates;
  installs: InstallPrompts;
  environment: InstallEnvironment;
  /**
   * Pushes pending changes before the page reloads. Changes live in IndexedDB and survive the
   * reload anyway; this only gets them to the group sooner.
   */
  flushChanges: () => Promise<unknown>;
}

const PwaContext = createContext<PwaPorts | null>(null);

export function PwaProvider({ children, ...ports }: PwaPorts & { children: ReactNode }) {
  return <PwaContext.Provider value={ports}>{children}</PwaContext.Provider>;
}

function usePwa(): PwaPorts {
  const ports = useContext(PwaContext);
  if (!ports) throw new Error('PWA hooks must be used inside PwaProvider');
  return ports;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** "New version available": shown while an update waits, until reloaded or dismissed. */
export function useAppUpdate() {
  const { updates, flushChanges } = usePwa();
  const waiting = useSyncExternalStore(updates.subscribe, () => updates.isWaiting());
  const [dismissed, setDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);

  const reload = useCallback(async () => {
    setReloading(true);
    await Promise.race([flushChanges().catch(() => undefined), wait(FLUSH_TIMEOUT_MS)]);
    await updates.activate();
  }, [updates, flushChanges]);

  return {
    available: waiting && !dismissed,
    reloading,
    reload,
    dismiss: () => setDismissed(true),
  };
}

/** The "Install app" hint for this browser, remembered as dismissed once closed. */
export function useInstallHint() {
  const { installs, environment } = usePwa();
  const canPrompt = useSyncExternalStore(installs.subscribe, () => installs.canPrompt());
  const [dismissed, setDismissed] = useState(() => readPref(INSTALL_HINT_DISMISSED_KEY) === '1');

  const hint: InstallHint = chooseInstallHint({
    standalone: environment.isStandalone(),
    canPrompt,
    iosSafari: environment.isIosSafari(),
    dismissed,
  });

  const dismiss = useCallback(() => {
    writePref(INSTALL_HINT_DISMISSED_KEY, '1');
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    const outcome = await installs.prompt();
    // Declining the browser's own dialog counts as "not now, stop asking".
    if (outcome === 'dismissed') dismiss();
  }, [installs, dismiss]);

  return { hint, install, dismiss };
}
