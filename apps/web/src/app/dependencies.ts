import { SupabaseAuthService } from '../features/auth/infrastructure/supabase-auth-service';
import { SyncEngine } from '../features/sync/application/sync-engine';
import { DexieSyncStore } from '../features/sync/infrastructure/dexie-sync-store';
import { SupabaseSyncStore } from '../features/sync/infrastructure/supabase-sync-store';
import { DexieTripRepository } from '../features/trips/infrastructure/dexie-trip-repository';
import { WayfareDB, wipeLocal } from '../shared/infrastructure/db';
import { supabase } from '../shared/infrastructure/supabase';

/** Composition root: the only module that picks concrete adapters for each port. */
const db = new WayfareDB();
const syncLocal = new DexieSyncStore(db);

export const dependencies = {
  auth: new SupabaseAuthService(supabase, {
    url: import.meta.env.VITE_SUPABASE_URL,
    apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }),
  trips: new DexieTripRepository(db),
  syncLocal,
  sync: new SyncEngine(syncLocal, new SupabaseSyncStore(supabase)),
  wipeDevice: () => wipeLocal(db),
};
