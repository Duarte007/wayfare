import { act, renderHook, waitFor } from '@testing-library/react';
import type { DocumentLabel, TravelDocument } from '@wayfare/shared';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntry, DocumentRepository, DownloadResult } from '../domain/document-ports';
import { DocumentsProvider } from './DocumentsProvider';
import { useDocumentFile } from './useDocumentFile';
import { useDocumentList } from './useDocuments';

function doc(id: string, patch: Partial<TravelDocument> = {}): TravelDocument {
  return {
    id,
    trip_id: 'trip',
    owner_id: 'user',
    visibility: 'private',
    assignees: [],
    title: id,
    label: 'other',
    tags: [],
    mime: 'application/pdf',
    size_bytes: 4,
    storage_path: `user/trip/${id}`,
    ...patch,
  };
}

function setup(
  entries: DocumentEntry[],
  options: { local?: Blob | null; remote?: DownloadResult } = {},
) {
  const repository: DocumentRepository = {
    observeTrip: (_tripId, listener) => {
      listener(entries);
      return () => {};
    },
    add: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    readFile: vi.fn(async () => options.local ?? null),
    cacheFile: vi.fn(async () => {}),
    link: vi.fn(),
    unlink: vi.fn(),
  };
  const download = vi.fn(async () => options.remote ?? ({ outcome: 'transient' } as const));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DocumentsProvider
      repository={repository}
      boosts={{ read: async () => ({}), write: async () => {} }}
      remoteFiles={{ download }}
    >
      {children}
    </DocumentsProvider>
  );
  return { wrapper, repository, download };
}

const NAMES: Partial<Record<DocumentLabel, string>> = { flight: 'Voo', stay: 'Hospedagem' };
const labelName = (label: DocumentLabel) => NAMES[label] ?? label;

describe('useDocumentList', () => {
  it('sorts, searches and filters, offering only the types present', () => {
    const { wrapper } = setup([
      { document: doc('Hotel Lisboa', { label: 'stay' }), file: 'on_device' },
      { document: doc('Flight TP123', { label: 'flight' }), file: 'pending_upload' },
    ]);
    const { result } = renderHook(() => useDocumentList('trip', labelName), { wrapper });
    expect(result.current.entries.map((e) => e.document.id)).toEqual([
      'Flight TP123',
      'Hotel Lisboa',
    ]);
    expect(result.current.labels).toEqual(['flight', 'stay']);
    act(() => result.current.setQuery('hospedagem'));
    expect(result.current.entries.map((e) => e.document.id)).toEqual(['Hotel Lisboa']);
    act(() => {
      result.current.setQuery('');
      result.current.setLabel('flight');
    });
    expect(result.current.entries.map((e) => e.file)).toEqual(['pending_upload']);
    expect(result.current.total).toBe(2);
  });
});

describe('useDocumentFile', () => {
  const createObjectURL = vi.fn(() => 'blob:local');
  const revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  afterEach(() => vi.clearAllMocks());

  it('opens the file from the device without the network', async () => {
    const { wrapper, download } = setup([], { local: new Blob(['a']) });
    const { result, unmount } = renderHook(() => useDocumentFile(doc('a')), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', url: 'blob:local' }));
    expect(download).not.toHaveBeenCalled();
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local');
  });

  it('downloads a file that is not here yet and keeps it for offline', async () => {
    const remote = new Blob(['b']);
    const { wrapper, repository } = setup([], { remote: { outcome: 'ok', file: remote } });
    const { result } = renderHook(() => useDocumentFile(doc('b')), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(repository.cacheFile).toHaveBeenCalledWith(doc('b'), remote);
  });

  it('says so when the file is neither here nor reachable', async () => {
    const { wrapper } = setup([], { remote: { outcome: 'missing' } });
    const { result } = renderHook(() => useDocumentFile(doc('c')), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
  });
});
