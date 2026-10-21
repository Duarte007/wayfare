import { describe, expect, it } from 'vitest';
import {
  canPreviewImage,
  downloadName,
  MAX_DOCUMENT_BYTES,
  mimeOf,
  storagePathFor,
  validateFile,
} from './document-file';

describe('document files', () => {
  it('accepts PDFs and photos, by type or (when the browser sends none) by extension', () => {
    expect(mimeOf({ name: 'pass.pdf', type: 'application/pdf' })).toBe('application/pdf');
    expect(mimeOf({ name: 'IMG_0001.HEIC', type: '' })).toBe('image/heic');
    expect(mimeOf({ name: 'scan.jpg', type: 'application/octet-stream' })).toBe('image/jpeg');
    expect(mimeOf({ name: 'photo.jpg', type: 'image/jpg' })).toBe('image/jpeg');
    expect(mimeOf({ name: 'notes.docx', type: 'application/msword' })).toBeNull();
    // A real type wins over a misleading extension.
    expect(mimeOf({ name: 'trick.pdf', type: 'text/html' })).toBeNull();
  });

  it('refuses unsupported, empty and too large files', () => {
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 1000 })).toBeNull();
    expect(validateFile({ name: 'a.zip', type: 'application/zip', size: 1000 })).toBe(
      'unsupported',
    );
    expect(validateFile({ name: 'a.png', type: 'image/png', size: 0 })).toBe('empty');
    expect(validateFile({ name: 'a.png', type: 'image/png', size: MAX_DOCUMENT_BYTES + 1 })).toBe(
      'too_large',
    );
    expect(validateFile({ name: 'a.png', type: 'image/png', size: MAX_DOCUMENT_BYTES })).toBeNull();
  });

  it('builds the bucket path the storage policies expect', () => {
    expect(storagePathFor('owner', 'trip', 'doc')).toBe('owner/trip/doc');
  });

  it('previews images the browser can draw', () => {
    expect(canPreviewImage('image/png')).toBe(true);
    expect(canPreviewImage('image/heic')).toBe(false);
    expect(canPreviewImage('application/pdf')).toBe(false);
  });

  it('names downloads after the title with the right extension', () => {
    expect(downloadName('Flight CA1234', 'application/pdf')).toBe('Flight CA1234.pdf');
    expect(downloadName('a/b: c', 'image/png')).toBe('a b c.png');
    expect(downloadName('scan.png', 'image/png')).toBe('scan.png');
    expect(downloadName('  ', 'image/jpeg')).toBe('document.jpg');
  });
});
