import type { SupabaseClient } from '@supabase/supabase-js';
import type { DownloadResult, RemoteFileOutcome, RemoteFileStore } from '../domain/document-ports';

const BUCKET = 'documents';

interface StorageErrorLike {
  message?: string;
  statusCode?: string | number;
  status?: number;
  name?: string;
}

/** The HTTP status and the storage error's own code (older servers send 400 + "404"). */
function codesOf(error: unknown): number[] {
  const e = error as StorageErrorLike;
  return [e?.status, e?.statusCode].map(Number).filter((n) => Number.isFinite(n) && n > 0);
}

function isAlreadyThere(error: unknown): boolean {
  const e = error as StorageErrorLike;
  return codesOf(error).includes(409) || /already exists|duplicate/i.test(e?.message ?? '');
}

function isNotFound(error: unknown): boolean {
  const e = error as StorageErrorLike;
  return codesOf(error).includes(404) || /not.?found/i.test(e?.message ?? '');
}

const RETRYABLE = new Set([401, 408, 429]);

/** 4xx (policy, type, size) will fail the same way again; anything else may pass later. */
function outcomeOf(error: unknown): Exclude<RemoteFileOutcome, 'ok'> {
  const codes = codesOf(error);
  if (codes.some((c) => RETRYABLE.has(c))) return 'transient';
  return codes.some((c) => c >= 400 && c < 500) ? 'refused' : 'transient';
}

/** The private bucket, through the user's own session so storage policies decide. */
export class SupabaseFileStore implements RemoteFileStore {
  constructor(private readonly client: SupabaseClient) {}

  async upload(path: string, file: Blob, mime: string) {
    try {
      // Insert only: the bucket has no update policy, and an object never changes once there.
      const { error } = await this.client.storage
        .from(BUCKET)
        .upload(path, file, { contentType: mime, upsert: false });
      if (!error || isAlreadyThere(error)) return { outcome: 'ok' as const };
      return { outcome: outcomeOf(error), reason: error.message };
    } catch (error) {
      return { outcome: 'transient' as const, reason: String(error) };
    }
  }

  async download(path: string): Promise<DownloadResult> {
    try {
      const { data, error } = await this.client.storage.from(BUCKET).download(path);
      if (!error && data) return { outcome: 'ok', file: data };
      if (isNotFound(error)) return { outcome: 'missing' };
      return { outcome: outcomeOf(error) };
    } catch {
      return { outcome: 'transient' };
    }
  }

  async remove(path: string): Promise<RemoteFileOutcome> {
    try {
      const { error } = await this.client.storage.from(BUCKET).remove([path]);
      return error ? outcomeOf(error) : 'ok';
    } catch {
      return 'transient';
    }
  }
}
