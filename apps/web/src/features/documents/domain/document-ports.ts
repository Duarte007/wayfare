import type { TravelDocument } from '@wayfare/shared';
import type { LabelBoosts } from './document';

/** Where a document's file is, from this device's point of view. */
export type FileStatus =
  /** On the device and on the server. */
  | 'on_device'
  /** On the device, not uploaded yet (offline, or sync hasn't run). */
  | 'pending_upload'
  /** On the device; the server refused the upload, so it won't be retried. */
  | 'upload_failed'
  /** Only on the server so far (downloaded on the next sync, or on demand). */
  | 'remote_only';

export interface DocumentEntry {
  document: TravelDocument;
  file: FileStatus;
}

/** Documents port for the screens. Reads come from the device; writes are queued for sync. */
export interface DocumentRepository {
  /** The trip's documents with where each file is; emits again on every change. */
  observeTrip(tripId: string, listener: (entries: DocumentEntry[]) => void): () => void;
  /** Saves the row (queued for sync) and keeps the file on the device until it is uploaded. */
  add(document: TravelDocument, file: Blob): Promise<void>;
  save(document: TravelDocument): Promise<void>;
  /** Soft-deletes the row through sync and marks its file for removal from storage. */
  remove(document: TravelDocument): Promise<void>;
  /** The file from the device, or null when it isn't here yet. */
  readFile(documentId: string): Promise<Blob | null>;
  /** Keeps a file fetched on demand so it opens offline next time. */
  cacheFile(document: TravelDocument, file: Blob): Promise<void>;
}

export interface LabelBoostStore {
  read(userId: string): Promise<LabelBoosts>;
  write(userId: string, boosts: LabelBoosts): Promise<void>;
}

/** A file kept on the device, as the file sync sees it. */
export interface LocalFile {
  documentId: string;
  storagePath: string;
  mime: string;
}

/** The device side of file sync. */
export interface LocalFileStore {
  /** Files waiting to be uploaded, with their contents (excluding refused ones). */
  pendingUploads(): Promise<(LocalFile & { blob: Blob })[]>;
  /** Uploaded; does nothing if the file was removed meanwhile. */
  markUploaded(documentId: string): Promise<void>;
  /** The server refused it for good; kept on the device but not retried. */
  markUploadRefused(documentId: string, reason: string): Promise<void>;
  /** Files of removed documents whose storage object still has to go. */
  pendingDeletes(): Promise<LocalFile[]>;
  /** Drops the local entry (and blob) for good. */
  forget(documentId: string): Promise<void>;
  /** Documents visible on the device that have a storage object but no local file. */
  missingFiles(): Promise<LocalFile[]>;
  /** Keeps a downloaded file, unless its document was removed meanwhile. */
  storeDownloaded(file: LocalFile, blob: Blob): Promise<void>;
  /** Local files whose document is no longer on the device (and has nothing left to sync). */
  orphans(): Promise<string[]>;
}

/** transient = try again later (offline, timeout); refused = will fail the same way every time. */
export type RemoteFileOutcome = 'ok' | 'transient' | 'refused';

/** `missing` when nothing is there yet (its owner hasn't uploaded it). */
export type DownloadResult =
  { outcome: 'ok'; file: Blob } | { outcome: 'missing' | 'transient' | 'refused' };

/** The private bucket. */
export interface RemoteFileStore {
  /** Never overwrites: an object already at `path` counts as uploaded. */
  upload(
    path: string,
    file: Blob,
    mime: string,
  ): Promise<{ outcome: RemoteFileOutcome; reason?: string }>;
  download(path: string): Promise<DownloadResult>;
  remove(path: string): Promise<RemoteFileOutcome>;
}
