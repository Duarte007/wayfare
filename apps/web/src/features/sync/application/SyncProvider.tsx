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
import type { LocalSyncStore } from '../domain/sync-ports';
import type { SyncEngine } from './sync-engine';

export type SyncStatus = 'idle' | 'syncing' | 'offline';

interface SyncState {
  status: SyncStatus;
  /** Local changes not yet accepted by the server. */
  pending: number;
  syncNow: () => Promise<void>;
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
  children,
}: {
  engine: Pick<SyncEngine, 'run'>;
  local: Pick<LocalSyncStore, 'observePendingCount'>;
  children: ReactNode;
}) {
  const { session } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pending, setPending] = useState(0);
  const previousPending = useRef(0);

  const syncNow = useCallback(async () => {
    if (!session) return;
    setStatus('syncing');
    const result = await engine.run().catch(() => 'offline' as const);
    setStatus(result === 'offline' ? 'offline' : 'idle');
  }, [engine, session]);

  useEffect(() => local.observePendingCount(setPending), [local]);

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
    <SyncContext.Provider value={{ status, pending, syncNow }}>{children}</SyncContext.Provider>
  );
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}
