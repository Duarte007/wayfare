import type { TravelDocument } from '@wayfare/shared';
import { liveQuery } from 'dexie';
import {
  applyLocal,
  deleteLocal,
  documentLinkId,
  saveLocal,
  type StoredDocumentLink,
  type StoredFile,
  type WayfareDB,
} from '../../../shared/infrastructure/db';
import type { LabelBoosts } from '../domain/document';
import type { NewDocumentLink } from '../domain/document-link';
import type {
  DocumentEntry,
  DocumentRepository,
  FileStatus,
  LabelBoostStore,
  LocalFile,
  LocalFileStore,
} from '../domain/document-ports';

function statusOf(file: StoredFile | undefined): FileStatus {
  if (!file || file.state === 'pending_delete') return 'remote_only';
  if (file.state === 'synced') return 'on_device';
  return file.refused ? 'upload_failed' : 'pending_upload';
}

const toStoredLink = (link: NewDocumentLink): StoredDocumentLink => ({
  id: documentLinkId(link),
  document_id: link.document_id,
  entity_type: link.entity_type,
  entity_id: link.entity_id,
  trip_id: link.trip_id,
  // Sent with the link, so linking again revives a link removed earlier on the server.
  deleted_at: null,
});

const toLocalFile = ({ documentId, storagePath, mime }: StoredFile): LocalFile => ({
  documentId,
  storagePath,
  mime,
});

export class DexieDocumentRepository implements DocumentRepository {
  constructor(private readonly db: WayfareDB) {}

  observeTrip(tripId: string, listener: (entries: DocumentEntry[]) => void) {
    const subscription = liveQuery(async () => {
      const documents = await this.db.documents.where('trip_id').equals(tripId).toArray();
      const files = await this.db.files.bulkGet(documents.map((d) => d.id));
      return documents.map((document, i) => ({ document, file: statusOf(files[i]) }));
    }).subscribe({
      next: listener,
      error: (err: unknown) => console.error('Failed to read documents', err),
    });
    return () => subscription.unsubscribe();
  }

  async add(document: TravelDocument, file: Blob, links: readonly NewDocumentLink[] = []) {
    const db = this.db;
    await db.transaction('rw', db.documents, db.documentLinks, db.outbox, db.files, async () => {
      // The document first: its links are pushed after it.
      await applyLocal(db, {
        upserts: [
          { table: 'documents', row: document },
          ...links.map((link) => ({ table: 'document_links' as const, row: toStoredLink(link) })),
        ],
        deletes: [],
      });
      await db.files.put({
        documentId: document.id,
        blob: file,
        mime: document.mime,
        storagePath: document.storage_path!,
        state: 'pending_upload',
      });
    });
  }

  save(document: TravelDocument) {
    return saveLocal(this.db, 'documents', document);
  }

  async remove(document: TravelDocument) {
    const db = this.db;
    await db.transaction('rw', db.documents, db.documentLinks, db.outbox, db.files, async () => {
      // Takes the document's links along (queued before the document itself).
      await deleteLocal(db, 'documents', document.id);
      const file = await db.files.get(document.id);
      if (file || document.storage_path) {
        // The bytes aren't needed any more; only the path, to remove the storage object.
        await db.files.put({
          documentId: document.id,
          blob: new Blob([]),
          mime: document.mime,
          storagePath: file?.storagePath ?? document.storage_path!,
          state: 'pending_delete',
        });
      }
    });
  }

  link(link: NewDocumentLink) {
    return saveLocal(this.db, 'document_links', toStoredLink(link));
  }

  async unlink(link: NewDocumentLink) {
    const id = documentLinkId(link);
    const db = this.db;
    await db.transaction('rw', db.documentLinks, db.outbox, async () => {
      if (await db.documentLinks.get(id)) await deleteLocal(db, 'document_links', id);
    });
  }

  async readFile(documentId: string) {
    const file = await this.db.files.get(documentId);
    return file && file.state !== 'pending_delete' ? file.blob : null;
  }

  async cacheFile(document: TravelDocument, file: Blob) {
    if (!document.storage_path) return;
    await new DexieFileStore(this.db).storeDownloaded(
      { documentId: document.id, storagePath: document.storage_path, mime: document.mime },
      file,
    );
  }
}

export class DexieFileStore implements LocalFileStore {
  constructor(private readonly db: WayfareDB) {}

  async pendingUploads() {
    const files = await this.db.files.where('state').equals('pending_upload').toArray();
    return files.filter((f) => !f.refused).map((f) => ({ ...toLocalFile(f), blob: f.blob }));
  }

  async markUploaded(documentId: string) {
    await this.db.files
      .where('documentId')
      .equals(documentId)
      .and((f) => f.state === 'pending_upload')
      .modify({ state: 'synced' });
  }

  async markUploadRefused(documentId: string, reason: string) {
    await this.db.files
      .where('documentId')
      .equals(documentId)
      .and((f) => f.state === 'pending_upload')
      .modify({ refused: reason || 'refused' });
  }

  async pendingDeletes() {
    return (await this.db.files.where('state').equals('pending_delete').toArray()).map(toLocalFile);
  }

  async forget(documentId: string) {
    await this.db.files.delete(documentId);
  }

  async missingFiles() {
    const [documents, stored] = await Promise.all([
      this.db.documents.toArray(),
      this.db.files.toCollection().primaryKeys(),
    ]);
    const here = new Set(stored);
    return documents
      .filter((d) => d.storage_path && !here.has(d.id))
      .map((d) => ({ documentId: d.id, storagePath: d.storage_path!, mime: d.mime }));
  }

  async storeDownloaded(file: LocalFile, blob: Blob) {
    const db = this.db;
    await db.transaction('rw', db.documents, db.files, async () => {
      // Removed or already stored while the download ran: keep what's there.
      if (!(await db.documents.get(file.documentId))) return;
      if (await db.files.get(file.documentId)) return;
      await db.files.put({ ...file, blob, state: 'synced' });
    });
  }

  async orphans() {
    const [files, documentIds] = await Promise.all([
      this.db.files.where('state').notEqual('pending_delete').primaryKeys(),
      this.db.documents.toCollection().primaryKeys(),
    ]);
    const present = new Set(documentIds);
    return files.filter((id) => !present.has(id));
  }
}

const boostKey = (userId: string) => `documents.labelBoosts.${userId}`;

export class DexieLabelBoostStore implements LabelBoostStore {
  constructor(private readonly db: WayfareDB) {}

  async read(userId: string): Promise<LabelBoosts> {
    const entry = await this.db.meta.get(boostKey(userId));
    if (!entry) return {};
    try {
      return JSON.parse(entry.value) as LabelBoosts;
    } catch {
      return {};
    }
  }

  async write(userId: string, boosts: LabelBoosts) {
    await this.db.meta.put({ key: boostKey(userId), value: JSON.stringify(boosts) });
  }
}
