import type { TravelDocument } from '@wayfare/shared';
import { useEffect, useRef, useState } from 'react';
import { useDocumentsDependencies } from './DocumentsProvider';

export type DocumentFileState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  /** Not on this device and the server can't be reached (or its owner hasn't uploaded it). */
  | { status: 'unavailable' };

/**
 * The document's file as an object URL: from the device first; otherwise downloaded once (and
 * kept, so it opens offline next time). The URL is released when the viewer closes.
 */
export function useDocumentFile(document: TravelDocument, enabled = true): DocumentFileState {
  const { repository, remoteFiles } = useDocumentsDependencies();
  const [state, setState] = useState<{ id: string; value: DocumentFileState }>();
  // Edits to the title or sharing must not reload the file.
  const latest = useRef(document);
  useEffect(() => {
    latest.current = document;
  });
  const { id, storage_path: storagePath } = document;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let url: string | null = null;
    const show = (blob: Blob | null) => {
      if (!active) return;
      if (!blob) return setState({ id, value: { status: 'unavailable' } });
      url = URL.createObjectURL(blob);
      setState({ id, value: { status: 'ready', url } });
    };
    const load = async (): Promise<Blob | null> => {
      const local = await repository.readFile(id);
      if (local) return local;
      if (!storagePath) return null;
      const remote = await remoteFiles.download(storagePath);
      if (remote.outcome !== 'ok') return null;
      await repository.cacheFile(latest.current, remote.file).catch(() => undefined);
      return remote.file;
    };
    void load()
      .catch(() => null)
      .then(show);
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
      // Never hand out a revoked URL when the viewer opens again.
      setState(undefined);
    };
  }, [repository, remoteFiles, id, storagePath, enabled]);

  if (!enabled || !state || state.id !== id) return { status: 'loading' };
  return state.value;
}
