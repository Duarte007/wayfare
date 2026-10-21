import type { LocalFileStore, RemoteFileStore } from '../domain/document-ports';

/**
 * Moves document files between the device and the private bucket. The documents rows travel
 * through the normal outbox; this only handles the bytes, as two sync steps.
 */
export class FileSync {
  constructor(
    private readonly local: LocalFileStore,
    private readonly remote: RemoteFileStore,
  ) {}

  /**
   * After the push: upload new files and remove the storage objects of removed documents.
   * Runs after the rows went out, so the trip exists on the server when storage checks it.
   * False when the server couldn't be reached; what's left waits for the next pass.
   */
  sendChanges = async (): Promise<boolean> => {
    for (const file of await this.local.pendingUploads()) {
      const { outcome, reason } = await this.remote.upload(file.storagePath, file.blob, file.mime);
      if (outcome === 'transient') return false;
      if (outcome === 'refused') await this.local.markUploadRefused(file.documentId, reason ?? '');
      else await this.local.markUploaded(file.documentId);
    }
    for (const file of await this.local.pendingDeletes()) {
      const outcome = await this.remote.remove(file.storagePath);
      if (outcome === 'transient') return false;
      // Refused: someone else's file (only its owner may delete it); nothing more to do here.
      await this.local.forget(file.documentId);
    }
    return true;
  };

  /**
   * After the pull: download files of documents visible here so they open offline, and drop
   * files whose document is gone. A file its owner hasn't uploaded yet is skipped quietly.
   */
  fetchMissing = async (): Promise<boolean> => {
    for (const id of await this.local.orphans()) await this.local.forget(id);
    for (const file of await this.local.missingFiles()) {
      const result = await this.remote.download(file.storagePath);
      if (result.outcome === 'transient') return false;
      if (result.outcome === 'ok') await this.local.storeDownloaded(file, result.file);
    }
    return true;
  };
}
