import { createContext, useContext, type ReactNode } from 'react';
import type {
  DocumentRepository,
  LabelBoostStore,
  RemoteFileStore,
} from '../domain/document-ports';

export interface DocumentsDependencies {
  repository: DocumentRepository;
  boosts: LabelBoostStore;
  /** Fetches a file that isn't on the device yet, when the user opens it online. */
  remoteFiles: Pick<RemoteFileStore, 'download'>;
}

const DocumentsContext = createContext<DocumentsDependencies | null>(null);

export function DocumentsProvider({
  children,
  ...deps
}: DocumentsDependencies & { children: ReactNode }) {
  return <DocumentsContext.Provider value={deps}>{children}</DocumentsContext.Provider>;
}

export function useDocumentsDependencies(): DocumentsDependencies {
  const deps = useContext(DocumentsContext);
  if (!deps) throw new Error('Document hooks must be used inside DocumentsProvider');
  return deps;
}
