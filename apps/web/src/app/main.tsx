import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../features/auth/application/AuthProvider';
import { ChecklistProvider } from '../features/checklist/application/ChecklistProvider';
import { DocumentsProvider } from '../features/documents/application/DocumentsProvider';
import { GroupProvider } from '../features/group/application/GroupProvider';
import { ItineraryProvider } from '../features/itinerary/application/ItineraryProvider';
import { MapsProvider } from '../features/maps/application/MapsProvider';
import { PwaProvider } from '../features/pwa/application/PwaProvider';
import { MembersProvider } from '../features/members/application/MembersProvider';
import { SyncProvider } from '../features/sync/application/SyncProvider';
import { TripsProvider } from '../features/trips/application/TripsProvider';
import { i18nReady } from '../shared/lib/i18n';
import { applyTheme, readTheme } from '../shared/lib/theme';
import '../styles.css';
import { dependencies } from './dependencies';
import { router } from './router';

applyTheme(readTheme());

// Never swap code mid-session: a new version waits until the person taps "Reload".
dependencies.appUpdates.register();

// Ask the browser not to evict offline data (maps, documents) under storage pressure.
void navigator.storage?.persist?.();

// Render once the active language's messages (a small chunk) are in, so no raw keys flash. The
// current screen's chunk loads at the same time instead of after the first render.
void Promise.all([i18nReady, router.load().catch(() => undefined)]).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider
        service={dependencies.auth}
        beforeSignOut={() => dependencies.sync.run().then(() => undefined)}
        onSignedOut={dependencies.wipeDevice}
      >
        <SyncProvider
          engine={dependencies.sync}
          local={dependencies.syncLocal}
          issueStore={dependencies.syncIssues}
        >
          <TripsProvider repository={dependencies.trips}>
            <ItineraryProvider
              repository={dependencies.itinerary}
              placeSearch={dependencies.placeSearch}
            >
              <MembersProvider directory={dependencies.members}>
                <PwaProvider
                  updates={dependencies.appUpdates}
                  installs={dependencies.installPrompts}
                  environment={dependencies.installEnvironment}
                  flushChanges={() => dependencies.sync.run()}
                >
                  <DocumentsProvider {...dependencies.documents}>
                    <ChecklistProvider repository={dependencies.checklist}>
                      <GroupProvider {...dependencies.group}>
                        <MapsProvider {...dependencies.maps}>
                          <RouterProvider router={router} />
                        </MapsProvider>
                      </GroupProvider>
                    </ChecklistProvider>
                  </DocumentsProvider>
                </PwaProvider>
              </MembersProvider>
            </ItineraryProvider>
          </TripsProvider>
        </SyncProvider>
      </AuthProvider>
    </StrictMode>,
  ),
);
