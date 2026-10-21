import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from '../features/auth/application/AuthProvider';
import { ItineraryProvider } from '../features/itinerary/application/ItineraryProvider';
import { SyncProvider } from '../features/sync/application/SyncProvider';
import { TripsProvider } from '../features/trips/application/TripsProvider';
import '../shared/lib/i18n';
import { applyTheme, readTheme } from '../shared/lib/theme';
import '../styles.css';
import { dependencies } from './dependencies';
import { router } from './router';

applyTheme(readTheme());

// Never swap code mid-session: a new version activates on the next reload.
registerSW({ immediate: true });

// Ask the browser not to evict offline data (maps, documents) under storage pressure.
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider
      service={dependencies.auth}
      beforeSignOut={() => dependencies.sync.run().then(() => undefined)}
      onSignedOut={dependencies.wipeDevice}
    >
      <SyncProvider engine={dependencies.sync} local={dependencies.syncLocal}>
        <TripsProvider repository={dependencies.trips}>
          <ItineraryProvider
            repository={dependencies.itinerary}
            placeSearch={dependencies.placeSearch}
          >
            <RouterProvider router={router} />
          </ItineraryProvider>
        </TripsProvider>
      </SyncProvider>
    </AuthProvider>
  </StrictMode>,
);
