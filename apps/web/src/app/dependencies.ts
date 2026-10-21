import { SupabaseAuthService } from '../features/auth/infrastructure/supabase-auth-service';
import { FileSync } from '../features/documents/application/file-sync';
import {
  DexieDocumentRepository,
  DexieFileStore,
  DexieLabelBoostStore,
} from '../features/documents/infrastructure/dexie-document-repository';
import { SupabaseFileStore } from '../features/documents/infrastructure/supabase-file-store';
import { ApiPlaceSearch } from '../features/itinerary/infrastructure/api-place-search';
import { DexieItineraryRepository } from '../features/itinerary/infrastructure/dexie-itinerary-repository';
import { SupabaseMemberDirectory } from '../features/members/infrastructure/supabase-member-directory';
import { SyncEngine } from '../features/sync/application/sync-engine';
import { DexieSyncStore } from '../features/sync/infrastructure/dexie-sync-store';
import { SupabaseSyncStore } from '../features/sync/infrastructure/supabase-sync-store';
import { DexieTripRepository } from '../features/trips/infrastructure/dexie-trip-repository';
import { WayfareDB, wipeLocal } from '../shared/infrastructure/db';
import { supabase } from '../shared/infrastructure/supabase';

/** Composition root: the only module that picks concrete adapters for each port. */
const db = new WayfareDB();
const syncLocal = new DexieSyncStore(db);
const remoteFiles = new SupabaseFileStore(supabase);
const fileSync = new FileSync(new DexieFileStore(db), remoteFiles);

const auth = new SupabaseAuthService(supabase, {
  url: import.meta.env.VITE_SUPABASE_URL,
  apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const dependencies = {
  auth,
  itinerary: new DexieItineraryRepository(db),
  placeSearch: new ApiPlaceSearch(import.meta.env.VITE_API_URL, async () => {
    const session = await auth.currentSession();
    return session?.accessToken ?? null;
  }),
  members: new SupabaseMemberDirectory(supabase, db),
  trips: new DexieTripRepository(db),
  syncLocal,
  documents: {
    repository: new DexieDocumentRepository(db),
    boosts: new DexieLabelBoostStore(db),
    remoteFiles,
  },
  sync: new SyncEngine(syncLocal, new SupabaseSyncStore(supabase), {
    afterPush: [fileSync.sendChanges],
    afterPull: [fileSync.fetchMissing],
  }),
  wipeDevice: () => wipeLocal(db),
};
