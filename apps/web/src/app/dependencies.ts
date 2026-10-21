import { SupabaseAuthService } from '../features/auth/infrastructure/supabase-auth-service';
import { DexieTripRepository } from '../features/trips/infrastructure/dexie-trip-repository';
import { WayfareDB, wipeLocal } from '../shared/infrastructure/db';
import { supabase } from '../shared/infrastructure/supabase';

/** Composition root: the only module that picks concrete adapters for each port. */
const db = new WayfareDB();

export const dependencies = {
  auth: new SupabaseAuthService(supabase),
  trips: new DexieTripRepository(db),
  wipeDevice: () => wipeLocal(db),
};
