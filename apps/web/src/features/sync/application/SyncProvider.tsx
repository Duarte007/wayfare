import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import type { SyncIssue, SyncIssueStore } from '../domain/sync-issues';
import type { LocalSyncStore, SyncTimes } from '../domain/sync-ports';
import type { SyncEngine, SyncResult } from './sync-engine';

export type SyncStatus = 'idle' | 'syncing' | 'offline';

interface SyncState extends SyncTimes {
  status: SyncStatus;
  /** Local changes not yet accepted by the server. */
  pending: number;
  /** Changes the server refused, set aside until the person retries or discards them. */
  issues: SyncIssue[];
  /** A full refresh asked for here is running. */
  refreshing: boolean;
  syncNow: () => Promise<void>;
  /** Re-pulls everything from the server and drops what it no longer has. */
  refreshAll: () => Promise<SyncResult>;
  retryIssue: (changeId: string) => Promise<void>;
  /** Drops the change and reloads its table, so the device shows the server's copy again. */
  discardIssue: (changeId: string) => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);

const PERIOD_MS = 60_000;
const AFTER_SAVE_MS = 800;

/**
 * Runs sync while someone is signed in: on start, when the network or the tab comes back, shortly
 * after each local change, and every minute. Screens never wait for it; they read the device.
 */
export function SyncProvider({
  engine,
  local,
  issueStore,
  children,
}: {
  engine: Pick<SyncEngine, 'run' | 'refresh'>;
  local: Pick<LocalSyncStore, 'observePendingCount' | 'observeSyncTimes'>;
  issueStore: SyncIssueStore;
  children: ReactNode;
}) {
  const { session } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pending, setPending] = useState(0);
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [times, setTimes] = useState<SyncTimes>({ lastSyncedAt: null, lastFullRefreshAt: null });
  const [refreshing, setRefreshing] = useState(false);
  const previousPending = useRef(0);

  const track = useCallback(async (pass: () => Promise<SyncResult>): Promise<SyncResult> => {
    setStatus('syncing');
    const result = await pass().catch(() => 'offline' as const);
    setStatus(result === 'offline' ? 'offline' : 'idle');
    return result;
  }, []);

  const syncNow = useCallback(async () => {
    if (!session) return;
    await track(() => engine.run());
  }, [engine, session, track]);

  const refreshAll = useCallback(async (): Promise<SyncResult> => {
    if (!session) return 'offline';
    setRefreshing(true);
    try {
      return await track(() => engine.refresh());
    } finally {
      setRefreshing(false);
    }
  }, [engine, session, track]);

  const retryIssue = useCallback(
    async (changeId: string) => {
      await issueStore.retry(changeId);
      await syncNow();
    },
    [issueStore, syncNow],
  );

  const discardIssue = useCallback(
    async (changeId: string) => {
      const table = await issueStore.discard(changeId);
      if (table && session) await track(() => engine.refresh([table]));
    },
    [engine, issueStore, session, track],
  );

  useEffect(() => local.observePendingCount(setPending), [local]);
  useEffect(() => local.observeSyncTimes(setTimes), [local]);
  useEffect(() => issueStore.observeIssues(setIssues), [issueStore]);

  // A new local change: send it soon, batching quick successive edits.
  useEffect(() => {
    const grew = pending > previousPending.current;
    previousPending.current = pending;
    if (!grew || !session) return;
    const timer = setTimeout(() => void syncNow(), AFTER_SAVE_MS);
    return () => clearTimeout(timer);
  }, [pending, session, syncNow]);

  useEffect(() => {
    if (!session) return;
    // First pass right after sign-in or start-up, outside the render that mounted us.
    const first = setTimeout(() => void syncNow(), 0);
    const onVisible = () => document.visibilityState === 'visible' && void syncNow();
    const onOnline = () => void syncNow();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => void syncNow(), PERIOD_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [session, syncNow]);

  return (
    <SyncContext.Provider
      value={{
        status,
        pending,
        issues,
        refreshing,
        ...times,
        syncNow,
        refreshAll,
        retryIssue,
        discardIssue,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}
