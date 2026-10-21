import { SupabaseAuthService } from '../features/auth/infrastructure/supabase-auth-service';
import { SessionPendingInviteStore } from '../features/group/infrastructure/session-pending-invite';
import { SupabaseInviteService } from '../features/group/infrastructure/supabase-invite-service';
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
const sync = new SyncEngine(syncLocal, new SupabaseSyncStore(supabase));

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
  sync,
  group: {
    invites: new SupabaseInviteService(supabase),
    pendingInvite: new SessionPendingInviteStore(),
    access: {
      sync: () => sync.run().then(() => undefined),
      forgetTrip: (tripId: string) => syncLocal.forgetTrip(tripId),
    },
  },
  wipeDevice: () => wipeLocal(db),
};
