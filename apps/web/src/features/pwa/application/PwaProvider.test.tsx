import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUpdates, InstallOutcome, InstallPrompts } from '../domain/pwa-ports';
import {
  FLUSH_TIMEOUT_MS,
  INSTALL_HINT_DISMISSED_KEY,
  PwaProvider,
  useAppUpdate,
  useInstallHint,
} from './PwaProvider';

/** A tiny observable flag, standing in for the service worker and the install event. */
function flag(initial = false) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: boolean) {
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function setup({
  standalone = false,
  iosSafari = false,
  flush = async () => {},
  outcome = 'accepted' as InstallOutcome,
} = {}) {
  const waiting = flag();
  const promptable = flag();
  const calls: string[] = [];
  const updates: AppUpdates = {
    subscribe: waiting.subscribe,
    isWaiting: waiting.get,
    activate: vi.fn(async () => {
      calls.push('activate');
    }),
  };
  const installs: InstallPrompts = {
    subscribe: promptable.subscribe,
    canPrompt: promptable.get,
    prompt: vi.fn(async () => outcome),
  };
  const flushChanges = vi.fn(async () => {
    await flush();
    calls.push('flush');
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PwaProvider
      updates={updates}
      installs={installs}
      environment={{ isStandalone: () => standalone, isIosSafari: () => iosSafari }}
      flushChanges={flushChanges}
    >
      {children}
    </PwaProvider>
  );
  return { waiting, promptable, updates, installs, flushChanges, calls, wrapper };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('useAppUpdate', () => {
  it('appears when a new version is waiting and can be dismissed for this session', () => {
    const { waiting, wrapper } = setup();
    const { result } = renderHook(() => useAppUpdate(), { wrapper });
    expect(result.current.available).toBe(false);

    act(() => waiting.set(true));
    expect(result.current.available).toBe(true);

    act(() => result.current.dismiss());
    expect(result.current.available).toBe(false);
  });

  it('syncs pending changes before activating the new version', async () => {
    const { waiting, updates, calls, wrapper } = setup();
    const { result } = renderHook(() => useAppUpdate(), { wrapper });
    act(() => waiting.set(true));

    await act(() => result.current.reload());
    expect(calls).toEqual(['flush', 'activate']);
    expect(updates.activate).toHaveBeenCalledOnce();
    expect(result.current.reloading).toBe(true);
  });

  it('does not wait forever for a slow or failing sync (changes stay on the device)', async () => {
    vi.useFakeTimers();
    const never = setup({ flush: () => new Promise(() => {}) });
    const slow = renderHook(() => useAppUpdate(), { wrapper: never.wrapper });
    let done = false;
    act(() => {
      void slow.result.current.reload().then(() => (done = true));
    });
    await act(() => vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS));
    expect(done).toBe(true);
    expect(never.updates.activate).toHaveBeenCalledOnce();

    vi.useRealTimers();
    const failing = setup({ flush: async () => Promise.reject(new Error('offline')) });
    const { result } = renderHook(() => useAppUpdate(), { wrapper: failing.wrapper });
    await act(() => result.current.reload());
    expect(failing.updates.activate).toHaveBeenCalledOnce();
  });
});

describe('useInstallHint', () => {
  it('offers the browser prompt once it is available', async () => {
    const { promptable, installs, wrapper } = setup();
    const { result } = renderHook(() => useInstallHint(), { wrapper });
    expect(result.current.hint).toBeNull();

    act(() => promptable.set(true));
    expect(result.current.hint).toBe('prompt');
    await act(() => result.current.install());
    expect(installs.prompt).toHaveBeenCalledOnce();
  });

  it('remembers a dismissal across visits', () => {
    const { wrapper } = setup({ iosSafari: true });
    const first = renderHook(() => useInstallHint(), { wrapper });
    expect(first.result.current.hint).toBe('ios');
    act(() => first.result.current.dismiss());
    expect(first.result.current.hint).toBeNull();
    expect(localStorage.getItem(INSTALL_HINT_DISMISSED_KEY)).toBe('1');

    const again = renderHook(() => useInstallHint(), { wrapper });
    expect(again.result.current.hint).toBeNull();
  });

  it('stops asking after the browser dialog is declined', async () => {
    const { promptable, wrapper } = setup({ outcome: 'dismissed' });
    const { result } = renderHook(() => useInstallHint(), { wrapper });
    act(() => promptable.set(true));
    await act(() => result.current.install());
    expect(result.current.hint).toBeNull();
  });

  it('shows nothing when already installed', () => {
    const { promptable, wrapper } = setup({ standalone: true, iosSafari: true });
    const { result } = renderHook(() => useInstallHint(), { wrapper });
    act(() => promptable.set(true));
    expect(result.current.hint).toBeNull();
  });

  it('still works when storage is blocked', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { wrapper } = setup({ iosSafari: true });
    const { result } = renderHook(() => useInstallHint(), { wrapper });
    expect(result.current.hint).toBe('ios');
    act(() => result.current.dismiss());
    expect(result.current.hint).toBeNull();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
