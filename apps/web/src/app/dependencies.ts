import { SupabaseAuthService } from '../features/auth/infrastructure/supabase-auth-service';
import { DexieChecklistRepository } from '../features/checklist/infrastructure/dexie-checklist-repository';
import { FileSync } from '../features/documents/application/file-sync';
import {
  DexieDocumentRepository,
  DexieFileStore,
  DexieLabelBoostStore,
} from '../features/documents/infrastructure/dexie-document-repository';
import { SupabaseFileStore } from '../features/documents/infrastructure/supabase-file-store';
import { SessionPendingInviteStore } from '../features/group/infrastructure/session-pending-invite';
import { SupabaseInviteService } from '../features/group/infrastructure/supabase-invite-service';
import { ApiPlaceSearch } from '../features/itinerary/infrastructure/api-place-search';
import { DexieItineraryRepository } from '../features/itinerary/infrastructure/dexie-itinerary-repository';
import type { MapRenderer } from '../features/maps/domain/map-ports';
import { CacheTileStore } from '../features/maps/infrastructure/cache-tile-store';
import { DexieOfflineAreaRepository } from '../features/maps/infrastructure/dexie-offline-area-repository';
import { readMapConfig } from '../features/maps/infrastructure/map-config';
import { createOfflineLoader } from '../features/maps/infrastructure/offline-loader';
import { createTileSource } from '../features/maps/infrastructure/tile-sources';
import { SupabaseMemberDirectory } from '../features/members/infrastructure/supabase-member-directory';
import {
  browserInstallEnvironment,
  BrowserInstallPrompts,
} from '../features/pwa/infrastructure/browser-install';
import { ServiceWorkerAppUpdates } from '../features/pwa/infrastructure/service-worker-app-updates';
import { SyncEngine } from '../features/sync/application/sync-engine';
import { DexieSyncIssueStore } from '../features/sync/infrastructure/dexie-sync-issues';
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
const sync = new SyncEngine(
  syncLocal,
  new SupabaseSyncStore(supabase),
  { afterPush: [fileSync.sendChanges], afterPull: [fileSync.fetchMissing] },
  // A new build runs a full refresh on its first pass.
  { build: __APP_BUILD__ },
);

const mapConfig = readMapConfig(import.meta.env);
const mapTiles = new CacheTileStore(mapConfig.assetsUrl);
const mapSource = createTileSource(mapConfig.tilesUrl);
let mapRenderer: Promise<MapRenderer> | null = null;
// MapLibre (~1 MB) is its own chunk, fetched the first time a map is shown (and precached).
const loadMapRenderer = () => {
  mapRenderer ??= import('../features/maps/infrastructure/maplibre-renderer').then(
    ({ MapLibreRenderer }) =>
      new MapLibreRenderer(
        createOfflineLoader({
          readTile: (tile) => mapTiles.readTile(tile),
          fetchTile: (tile, signal) => mapSource.fetchTile(tile, signal),
          readAsset: (path, signal) => mapTiles.readAsset(path, signal),
        }),
      ),
  );
  mapRenderer.catch(() => (mapRenderer = null));
  return mapRenderer;
};

const auth = new SupabaseAuthService(supabase, {
  url: import.meta.env.VITE_SUPABASE_URL,
  apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const dependencies = {
  auth,
  checklist: new DexieChecklistRepository(db),
  itinerary: new DexieItineraryRepository(db),
  placeSearch: new ApiPlaceSearch(import.meta.env.VITE_API_URL, async () => {
    const session = await auth.currentSession();
    return session?.accessToken ?? null;
  }),
  members: new SupabaseMemberDirectory(supabase, db),
  trips: new DexieTripRepository(db),
  syncLocal,
  syncIssues: new DexieSyncIssueStore(db),
  documents: {
    repository: new DexieDocumentRepository(db),
    boosts: new DexieLabelBoostStore(db),
    remoteFiles,
  },
  sync,
  group: {
    invites: new SupabaseInviteService(supabase),
    pendingInvite: new SessionPendingInviteStore(),
    access: {
      sync: () => sync.run().then(() => undefined),
      forgetTrip: (tripId: string) => syncLocal.forgetTrip(tripId),
    },
  },
  maps: {
    areas: new DexieOfflineAreaRepository(db),
    tiles: mapTiles,
    source: mapSource,
    loadRenderer: loadMapRenderer,
  },
  wipeDevice: async () => {
    await Promise.all([wipeLocal(db), mapTiles.clear()]);
  },
  appUpdates: new ServiceWorkerAppUpdates(),
  // Listens for `beforeinstallprompt` from startup, before anything renders.
  installPrompts: new BrowserInstallPrompts(),
  installEnvironment: browserInstallEnvironment,
};
