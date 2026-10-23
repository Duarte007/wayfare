import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataExport, ExportTables } from '../domain/data-export';
import { AccountProvider } from './AccountProvider';
import { useDataExport } from './useDataExport';

const syncNow = vi.fn<() => Promise<void>>();
vi.mock('../../auth/application/AuthProvider', () => ({
  useAuth: () => ({ session: { userId: 'u1', email: 'ana@example.com', displayName: 'Ana' } }),
}));
vi.mock('../../sync/application/SyncProvider', () => ({ useSync: () => ({ syncNow }) }));

const tables = { trips: [{ id: 't1', name: 'Trip' }] } as unknown as ExportTables;

function setup(readTables = vi.fn(async () => tables)) {
  const save = vi.fn<(name: string, file: Blob) => void>();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AccountProvider data={{ readTables }} files={{ save }}>
      {children}
    </AccountProvider>
  );
  return { save, ...renderHook(() => useDataExport(), { wrapper }) };
}

async function savedFile(save: ReturnType<typeof vi.fn>): Promise<DataExport> {
  const blob = save.mock.calls[0]?.[1] as Blob;
  return JSON.parse(await blob.text()) as DataExport;
}

describe('useDataExport', () => {
  beforeEach(() => {
    syncNow.mockReset().mockResolvedValue();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  it('syncs, then saves the trips as a JSON file', async () => {
    const { result, save } = setup();
    await act(() => result.current.download());
    expect(syncNow).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0]).toMatch(/^wayfare-data-\d{4}-\d{2}-\d{2}\.json$/);
    const file = await savedFile(save);
    expect(file.account.id).toBe('u1');
    expect(file.tables.trips).toEqual([{ id: 't1', name: 'Trip' }]);
    expect(file.syncedBeforeExport).toBe(true);
    expect(result.current).toMatchObject({ status: 'done', offlineCopy: false });
  });

  it('offline, exports the device copy and says so', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result, save } = setup();
    await act(() => result.current.download());
    expect(syncNow).not.toHaveBeenCalled();
    expect((await savedFile(save)).syncedBeforeExport).toBe(false);
    expect(result.current).toMatchObject({ status: 'done', offlineCopy: true });
  });

  it('reports a failure to read the device', async () => {
    const { result, save } = setup(vi.fn().mockRejectedValue(new Error('boom')));
    await act(() => result.current.download());
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
  });
});
