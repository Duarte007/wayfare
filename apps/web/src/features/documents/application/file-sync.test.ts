import { describe, expect, it } from 'vitest';
import type {
  DownloadResult,
  LocalFile,
  LocalFileStore,
  RemoteFileOutcome,
  RemoteFileStore,
} from '../domain/document-ports';
import { FileSync } from './file-sync';

type State = 'pending_upload' | 'synced' | 'pending_delete';
interface Entry extends LocalFile {
  state: State;
  blob: Blob;
  refused?: string;
}

function memoryLocal(files: Entry[], documents: LocalFile[] = []) {
  const byId = new Map(files.map((f) => [f.documentId, { ...f }]));
  const docs = new Map(documents.map((d) => [d.documentId, d]));
  const local: LocalFileStore = {
    pendingUploads: async () =>
      [...byId.values()].filter((f) => f.state === 'pending_upload' && !f.refused),
    markUploaded: async (id) => {
      const f = byId.get(id);
      if (f?.state === 'pending_upload') f.state = 'synced';
    },
    markUploadRefused: async (id, reason) => {
      const f = byId.get(id);
      if (f) f.refused = reason;
    },
    pendingDeletes: async () => [...byId.values()].filter((f) => f.state === 'pending_delete'),
    forget: async (id) => void byId.delete(id),
    missingFiles: async () => [...docs.values()].filter((d) => !byId.has(d.documentId)),
    storeDownloaded: async (file, blob) => {
      if (docs.has(file.documentId) && !byId.has(file.documentId))
        byId.set(file.documentId, { ...file, blob, state: 'synced' });
    },
    orphans: async () =>
      [...byId.values()]
        .filter((f) => f.state !== 'pending_delete' && !docs.has(f.documentId))
        .map((f) => f.documentId),
  };
  return { local, byId };
}

function memoryRemote(objects: Record<string, Blob> = {}, fail?: RemoteFileOutcome) {
  const calls: string[] = [];
  const remote: RemoteFileStore = {
    upload: async (path, file) => {
      calls.push(`upload:${path}`);
      if (fail && fail !== 'ok') return { outcome: fail, reason: 'nope' };
      objects[path] = file;
      return { outcome: 'ok' };
    },
    download: async (path): Promise<DownloadResult> => {
      calls.push(`download:${path}`);
      if (fail === 'transient') return { outcome: 'transient' };
      const file = objects[path];
      return file ? { outcome: 'ok', file } : { outcome: 'missing' };
    },
    remove: async (path) => {
      calls.push(`remove:${path}`);
      if (fail && fail !== 'ok') return fail;
      delete objects[path];
      return 'ok';
    },
  };
  return { remote, objects, calls };
}

const blob = new Blob(['%PDF'], { type: 'application/pdf' });
const file = (id: string, state: State): Entry => ({
  documentId: id,
  storagePath: `u/t/${id}`,
  mime: 'application/pdf',
  blob,
  state,
});
const doc = (id: string): LocalFile => ({
  documentId: id,
  storagePath: `u/t/${id}`,
  mime: 'application/pdf',
});

describe('FileSync', () => {
  it('uploads pending files and removes storage objects of removed documents', async () => {
    const { local, byId } = memoryLocal(
      [file('new', 'pending_upload'), file('gone', 'pending_delete'), file('old', 'synced')],
      [doc('new'), doc('old')],
    );
    const { remote, objects } = memoryRemote({ 'u/t/gone': blob, 'u/t/old': blob });
    expect(await new FileSync(local, remote).sendChanges()).toBe(true);
    expect(byId.get('new')?.state).toBe('synced');
    expect(byId.has('gone')).toBe(false);
    expect(Object.keys(objects).sort()).toEqual(['u/t/new', 'u/t/old']);
  });

  it('stops when offline and keeps everything for the next pass', async () => {
    const { local, byId } = memoryLocal([file('new', 'pending_upload')], [doc('new')]);
    const { remote } = memoryRemote({}, 'transient');
    expect(await new FileSync(local, remote).sendChanges()).toBe(false);
    expect(byId.get('new')?.state).toBe('pending_upload');
  });

  it('sets a refused upload aside instead of retrying it every pass', async () => {
    const { local, byId } = memoryLocal([file('new', 'pending_upload')], [doc('new')]);
    const { remote, calls } = memoryRemote({}, 'refused');
    const sync = new FileSync(local, remote);
    expect(await sync.sendChanges()).toBe(true);
    expect(byId.get('new')).toMatchObject({ state: 'pending_upload', refused: 'nope' });
    await sync.sendChanges();
    expect(calls).toEqual(['upload:u/t/new']);
  });

  it('downloads missing files, skips ones not uploaded yet, and drops orphans', async () => {
    const { local, byId } = memoryLocal(
      [file('orphan', 'synced')],
      [doc('shared'), doc('not-yet')],
    );
    const { remote } = memoryRemote({ 'u/t/shared': blob });
    expect(await new FileSync(local, remote).fetchMissing()).toBe(true);
    expect(byId.get('shared')?.state).toBe('synced');
    expect(byId.has('not-yet')).toBe(false);
    expect(byId.has('orphan')).toBe(false);
  });

  it('reports offline when downloads cannot reach the server', async () => {
    const { local } = memoryLocal([], [doc('shared')]);
    const { remote } = memoryRemote({}, 'transient');
    expect(await new FileSync(local, remote).fetchMissing()).toBe(false);
  });
});
