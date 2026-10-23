import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import { useSync } from '../../sync/application/SyncProvider';
import { buildDataExport, exportFileName } from '../domain/data-export';
import { useAccountServices } from './AccountProvider';

export type ExportStatus = 'idle' | 'working' | 'done' | 'error';

/**
 * Saves the person's data as a JSON file. It syncs first so the file is current; offline it
 * exports the device copy and says so in the file.
 */
export function useDataExport() {
  const { session } = useAuth();
  const { syncNow } = useSync();
  const { data, files } = useAccountServices();
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [offlineCopy, setOfflineCopy] = useState(false);

  const download = async () => {
    if (!session || status === 'working') return;
    setStatus('working');
    try {
      const synced =
        navigator.onLine &&
        (await syncNow().then(
          () => true,
          () => false,
        ));
      const exportedAt = new Date();
      const file = buildDataExport({
        account: { id: session.userId, email: session.email, displayName: session.displayName },
        tables: await data.readTables(),
        exportedAt,
        syncedBeforeExport: synced,
      });
      files.save(
        exportFileName(exportedAt),
        new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
      );
      setOfflineCopy(!file.syncedBeforeExport);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return { status, offlineCopy, download };
}
