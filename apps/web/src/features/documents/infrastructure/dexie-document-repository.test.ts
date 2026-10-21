import type { TravelDocument } from '@wayfare/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { WayfareDB } from '../../../shared/infrastructure/db';
import type { DocumentEntry } from '../domain/document-ports';
import {
  DexieDocumentRepository,
  DexieFileStore,
  DexieLabelBoostStore,
} from './dexie-document-repository';

const db = new WayfareDB();
const repository = new DexieDocumentRepository(db);
const files = new DexieFileStore(db);

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

const pdf = () => new Blob(['%PDF'], { type: 'application/pdf' });

function next(tripId: string): Promise<DocumentEntry[]> {
  return new Promise((resolve) => {
    const stop = repository.observeTrip(tripId, (entries) => {
      resolve(entries);
      setTimeout(stop);
    });
  });
}

beforeEach(async () => {
  await db.open();
  await Promise.all([db.documents.clear(), db.files.clear(), db.outbox.clear(), db.meta.clear()]);
});

describe('DexieDocumentRepository', () => {
  it('saves the row through the outbox and keeps the file for upload', async () => {
    await repository.add(doc('a'), pdf());
    const outbox = await db.outbox.toArray();
    expect(outbox).toMatchObject([{ table: 'documents', op: 'upsert', row: { id: 'a' } }]);
    expect(await db.files.get('a')).toMatchObject({
      state: 'pending_upload',
      storagePath: 'user/trip/a',
    });
    // jsdom's Blob doesn't survive fake-indexeddb's clone intact; real browsers keep the bytes.
    expect(await repository.readFile('a')).not.toBeNull();
    expect((await next('trip')).map((e) => e.file)).toEqual(['pending_upload']);
  });

  it('removes the row through the outbox and marks the file for deletion', async () => {
    await repository.add(doc('a'), pdf());
    await repository.remove(doc('a'));
    expect(await db.documents.get('a')).toBeUndefined();
    expect((await db.outbox.orderBy('createdAt').toArray()).map((e) => e.op)).toEqual([
      'upsert',
      'delete',
    ]);
    expect(await db.files.get('a')).toMatchObject({ state: 'pending_delete' });
    expect(await repository.readFile('a')).toBeNull();
    expect(await files.pendingDeletes()).toEqual([
      { documentId: 'a', storagePath: 'user/trip/a', mime: 'application/pdf' },
    ]);
    // An upload that finishes after the removal must not bring it back.
    await files.markUploaded('a');
    expect(await db.files.get('a')).toMatchObject({ state: 'pending_delete' });
  });

  it('reports files that are only on the server', async () => {
    await db.documents.put(doc('remote'));
    expect((await next('trip')).map((e) => e.file)).toEqual(['remote_only']);
    expect(await files.missingFiles()).toEqual([
      { documentId: 'remote', storagePath: 'user/trip/remote', mime: 'application/pdf' },
    ]);
    await files.storeDownloaded((await files.missingFiles())[0]!, pdf());
    expect((await next('trip')).map((e) => e.file)).toEqual(['on_device']);
    expect(await files.missingFiles()).toEqual([]);
  });

  it('does not keep a download whose document was removed meanwhile', async () => {
    await files.storeDownloaded(
      { documentId: 'gone', storagePath: 'x/y/gone', mime: 'image/png' },
      pdf(),
    );
    expect(await db.files.get('gone')).toBeUndefined();
  });

  it('finds orphans but keeps files still to be deleted remotely', async () => {
    await repository.add(doc('kept'), pdf());
    await repository.add(doc('orphan'), pdf());
    await repository.add(doc('removed'), pdf());
    await db.documents.delete('orphan'); // e.g. the trip was removed from the device
    await repository.remove(doc('removed'));
    expect(await files.orphans()).toEqual(['orphan']);
  });

  it('sets refused uploads aside', async () => {
    await repository.add(doc('a'), pdf());
    await files.markUploadRefused('a', '403');
    expect(await files.pendingUploads()).toEqual([]);
    expect((await next('trip')).map((e) => e.file)).toEqual(['upload_failed']);
  });
});

describe('document links', () => {
  const stay = { type: 'stay' as const, id: 'stay-1' };
  const linkTo = (documentId: string, entity: { type: 'stay' | 'leg'; id: string } = stay) => ({
    document_id: documentId,
    entity_type: entity.type,
    entity_id: entity.id,
    trip_id: 'trip',
  });
  const queued = async () =>
    (await db.outbox.orderBy('createdAt').toArray()).map((e) => `${e.op} ${e.table}`);

  beforeEach(async () => {
    await db.documentLinks.clear();
  });

  it('queues a new document before the links that point at it', async () => {
    await repository.add(doc('a'), pdf(), [linkTo('a')]);
    expect(await queued()).toEqual(['upsert documents', 'upsert document_links']);
    expect(await db.documentLinks.get('a:stay:stay-1')).toEqual({
      id: 'a:stay:stay-1',
      ...linkTo('a'),
      deleted_at: null,
    });
  });

  it('links and unlinks through the outbox, by the composite key', async () => {
    await repository.add(doc('a'), pdf());
    await repository.link(linkTo('a'));
    await repository.unlink(linkTo('a'));
    // Unlinking what isn't linked queues nothing.
    await repository.unlink(linkTo('a', { type: 'stay', id: 'other' }));
    expect(await db.documentLinks.count()).toBe(0);
    const outbox = await db.outbox.orderBy('createdAt').toArray();
    expect(outbox.map((e) => `${e.op} ${e.table}`)).toEqual([
      'upsert documents',
      'upsert document_links',
      'delete document_links',
    ]);
    expect(outbox[2]!.row).toEqual({
      id: 'a:stay:stay-1',
      document_id: 'a',
      entity_type: 'stay',
      entity_id: 'stay-1',
    });
  });

  it('removes a document together with its links', async () => {
    await repository.add(doc('a'), pdf(), [linkTo('a'), linkTo('a', { type: 'leg', id: 'leg-1' })]);
    await repository.add(doc('b'), pdf(), [linkTo('b')]);
    await db.outbox.clear();
    await repository.remove(doc('a'));
    expect(await queued()).toEqual([
      'delete document_links',
      'delete document_links',
      'delete documents',
    ]);
    expect((await db.documentLinks.toArray()).map((l) => l.id)).toEqual(['b:stay:stay-1']);
  });
});

describe('DexieLabelBoostStore', () => {
  it('keeps boosts per user', async () => {
    const boosts = new DexieLabelBoostStore(db);
    expect(await boosts.read('u1')).toEqual({});
    await boosts.write('u1', { acme: 'insurance' });
    expect(await boosts.read('u1')).toEqual({ acme: 'insurance' });
    expect(await boosts.read('u2')).toEqual({});
  });
});
