import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../auth/application/AuthProvider';
import type { AuthService } from '../../auth/domain/auth-service';
import type { SyncIssue, SyncIssueStore } from '../domain/sync-issues';
import type { SyncTimes } from '../domain/sync-ports';
import { SyncProvider, useSync } from './SyncProvider';

const issue: SyncIssue = {
  id: 'c1',
  kind: 'activity',
  op: 'upsert',
  title: 'Museu',
  reason: 'missing',
  detail: '23503',
  createdAt: 1,
};

function setup() {
  const session = {
    userId: 'ana',
    email: 'ana@example.com',
    displayName: null,
    avatarUrl: null,
    accessToken: 't',
  };
  const auth = {
    currentSession: async () => session,
    onSessionChange: () => () => {},
  } as unknown as AuthService;
  const engine = {
    run: vi.fn(async () => 'synced' as const),
    refresh: vi.fn(async () => 'synced' as const),
  };
  let emitTimes: (times: SyncTimes) => void = () => {};
  const local = {
    observePendingCount: () => () => {},
    observeSyncTimes: (listener: (times: SyncTimes) => void) => {
      emitTimes = listener;
      return () => {};
    },
  };
  const issueStore: SyncIssueStore = {
    observeIssues: (listener) => (listener([issue]), () => {}),
    retry: vi.fn(async () => {}),
    discard: vi.fn(async () => 'activities' as const),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider service={auth}>
      <SyncProvider engine={engine} local={local} issueStore={issueStore}>
        {children}
      </SyncProvider>
    </AuthProvider>
  );
  return { wrapper, engine, issueStore, emitTimes: (t: SyncTimes) => emitTimes(t) };
}

describe('SyncProvider', () => {
  it('exposes the set-aside changes and the sync times', async () => {
    const s = setup();
    const { result } = renderHook(() => useSync(), { wrapper: s.wrapper });
    expect(result.current.issues).toEqual([issue]);
    act(() => s.emitTimes({ lastSyncedAt: 5, lastFullRefreshAt: 3 }));
    expect(result.current.lastSyncedAt).toBe(5);
    expect(result.current.lastFullRefreshAt).toBe(3);
  });

  it('retry queues the change again and syncs', async () => {
    const s = setup();
    const { result } = renderHook(() => useSync(), { wrapper: s.wrapper });
    await waitFor(() => expect(s.engine.run).toHaveBeenCalled());
    s.engine.run.mockClear();
    await act(() => result.current.retryIssue('c1'));
    expect(s.issueStore.retry).toHaveBeenCalledWith('c1');
    expect(s.engine.run).toHaveBeenCalledTimes(1);
  });

  it('discard drops the change and reloads its table from the server', async () => {
    const s = setup();
    const { result } = renderHook(() => useSync(), { wrapper: s.wrapper });
    await waitFor(() => expect(s.engine.run).toHaveBeenCalled());
    await act(() => result.current.discardIssue('c1'));
    expect(s.issueStore.discard).toHaveBeenCalledWith('c1');
    expect(s.engine.refresh).toHaveBeenCalledWith(['activities']);
  });

  it('refreshes everything on request and reports the outcome', async () => {
    const s = setup();
    const { result } = renderHook(() => useSync(), { wrapper: s.wrapper });
    await waitFor(() => expect(s.engine.run).toHaveBeenCalled());
    s.engine.refresh.mockResolvedValueOnce('offline' as never);
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.refreshAll();
    });
    expect(s.engine.refresh).toHaveBeenCalledWith();
    expect(outcome).toBe('offline');
    expect(result.current.status).toBe('offline');
    expect(result.current.refreshing).toBe(false);
  });
});
