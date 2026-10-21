/** What the private `documents` bucket accepts (kept in step with its `allowed_mime_types`). */
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
] as const;
export type AcceptedMime = (typeof ACCEPTED_MIME_TYPES)[number];

/** Same limit as the bucket and `documents.size_bytes`. */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** For the file picker's `accept` attribute: types plus extensions (some phones send no type). */
export const ACCEPT_ATTRIBUTE = [
  ...ACCEPTED_MIME_TYPES,
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.webp',
].join(',');

const BY_EXTENSION: Record<string, AcceptedMime> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heic',
  webp: 'image/webp',
};

export interface PickedFile {
  name: string;
  /** As the browser reports it; often empty for HEIC photos. */
  type: string;
  size: number;
}

export type FileError = 'unsupported' | 'too_large' | 'empty';

/** The file's real type: the browser's when we accept it, otherwise guessed from the extension. */
export function mimeOf(file: Pick<PickedFile, 'name' | 'type'>): AcceptedMime | null {
  const type = file.type.toLowerCase();
  if ((ACCEPTED_MIME_TYPES as readonly string[]).includes(type)) return type as AcceptedMime;
  if (type === 'image/jpg') return 'image/jpeg';
  if (type === 'image/heif') return 'image/heic';
  // Only trust the extension when the browser gave no type or a generic one.
  if (type && type !== 'application/octet-stream') return null;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[extension] ?? null;
}

export function validateFile(file: PickedFile): FileError | null {
  if (!mimeOf(file)) return 'unsupported';
  if (file.size <= 0) return 'empty';
  if (file.size > MAX_DOCUMENT_BYTES) return 'too_large';
  return null;
}

/** Bucket path; storage policies read the owner and the trip from its first two folders. */
export function storagePathFor(ownerId: string, tripId: string, documentId: string): string {
  return `${ownerId}/${tripId}/${documentId}`;
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

/** Browsers can't draw HEIC (except Safari), so it is offered as a download instead. */
export function canPreviewImage(mime: string): boolean {
  return isImage(mime) && mime !== 'image/heic';
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

/** A file name for "download": the title, made safe, with the right extension. */
export function downloadName(title: string, mime: string): string {
  const base =
    title
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'document';
  const extension = EXTENSIONS[mime];
  return extension && !base.toLowerCase().endsWith(`.${extension}`) ? `${base}.${extension}` : base;
}
