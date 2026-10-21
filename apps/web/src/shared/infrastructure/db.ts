import type {
  Activity,
  ChecklistItem,
  DocumentLink,
  Leg,
  Place,
  Stay,
  Stop,
  TravelDocument,
  Trip,
} from '@wayfare/shared';
import type { SyncedTable } from '@wayfare/shared';
import Dexie, { type EntityTable, type Table } from 'dexie';
import type { OfflineArea } from '../../features/maps/domain/map-ports';

/** A local change waiting to be pushed to `POST /sync/push`, in order. */
export interface OutboxEntry {
  /** Client-generated id; the server ignores repeats, so retries are safe. */
  id: string;
  table: SyncedTable;
  op: 'upsert' | 'delete';
  row: Record<string, unknown>;
  createdAt: number;
  /** Set when the server refused the change for good (permissions, validation); never retried. */
  rejected?: string;
}

/** A document's file kept on the device, so it opens offline. */
export interface StoredFile {
  documentId: string;
  blob: Blob;
  mime: string;
  storagePath: string;
  state: 'pending_upload' | 'synced' | 'pending_delete';
  /** Set when the server refused the upload for good; never retried. */
  refused?: string;
}

/**
 * A document link as the device keeps it: one id built from the composite key, so it fits the
 * outbox and Dexie like any other row. `deleted_at: null` revives a link that was removed before.
 */
export type StoredDocumentLink = DocumentLink & {
  id: string;
  trip_id: string;
  deleted_at?: null;
};

export function documentLinkId(link: DocumentLink): string {
  return `${link.document_id}:${link.entity_type}:${link.entity_id}`;
}

/** The composite key back from a link's id (uuids and entity types never contain ":"). */
export function documentLinkKey(id: string): DocumentLink & { id: string } {
  const [document_id = '', entity_type = '', entity_id = ''] = id.split(':');
  return { id, document_id, entity_type: entity_type as DocumentLink['entity_type'], entity_id };
}

export interface Meta {
  key: string;
  value: string;
}

/** Offline-first store: every screen reads from here; the network only syncs. */
export class WayfareDB extends Dexie {
  trips!: EntityTable<Trip, 'id'>;
  places!: EntityTable<Place, 'id'>;
  stops!: EntityTable<Stop, 'id'>;
  stays!: EntityTable<Stay, 'id'>;
  legs!: EntityTable<Leg, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  documents!: EntityTable<TravelDocument, 'id'>;
  documentLinks!: EntityTable<StoredDocumentLink, 'id'>;
  // Named like the server table: sync stores pulled rows by table name.
  checklist_items!: EntityTable<ChecklistItem, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'id'>;
  meta!: EntityTable<Meta, 'key'>;
  files!: EntityTable<StoredFile, 'documentId'>;
  /** Cities whose map tiles are on the device (the tiles live in Cache Storage). Never synced. */
  map_areas!: EntityTable<OfflineArea, 'placeId'>;

  constructor() {
    super('wayfare');
    this.version(1).stores({
      trips: 'id, start_date',
      places: 'id, trip_id',
      stops: 'id, trip_id, [trip_id+position]',
      stays: 'id, trip_id, stop_id',
      legs: 'id, trip_id',
      activities: 'id, trip_id, stop_id, date',
      documents: 'id, trip_id, label',
      documentLinks: 'id, document_id, [entity_type+entity_id]',
      outbox: 'id, createdAt',
      meta: 'key',
    });
    // v2: sync looks up pending changes by table.
    this.version(2).stores({ outbox: 'id, createdAt, table' });
    // v3: document files on the device, by sync state.
    this.version(3).stores({ files: 'documentId, state' });
    // v4 (v3 is taken by documents): the trip checklist.
    this.version(4).stores({ checklist_items: 'id, trip_id' });
    // v5: document links by trip, so a trip leaving the device takes its links along.
    this.version(5).stores({ documentLinks: 'id, document_id, [entity_type+entity_id], trip_id' });
    // v6: offline map areas (local only, never synced).
    this.version(6).stores({ map_areas: 'placeId, tripId' });
  }
}

/** The device table of a synced server table (named alike, except document links). */
export function localTable(
  db: WayfareDB,
  table: SyncedTable,
): Table<Record<string, unknown>, string> {
  return table === 'document_links'
    ? (db.documentLinks as unknown as Table<Record<string, unknown>, string>)
    : db.table(table);
}

/** Removing one of these also removes the document links pointing at it. */
const LINKED_ENTITY: Partial<Record<SyncedTable, DocumentLink['entity_type']>> = {
  stops: 'stop',
  stays: 'stay',
  legs: 'leg',
  activities: 'activity',
};

let lastQueuedAt = 0;

/**
 * Strictly increasing timestamps for outbox entries, so sync replays changes in the order they
 * were made even when several land in the same millisecond (a place must reach the server
 * before the city that points at it).
 */
export function nextQueuedAt(): number {
  lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
  return lastQueuedAt;
}

/** Writes locally and queues the change for sync in one transaction. */
export async function saveLocal<T extends { id: string }>(
  db: WayfareDB,
  table: SyncedTable,
  row: T,
): Promise<void> {
  await applyLocal(db, { upserts: [{ table, row }], deletes: [] });
}

/** Deletes locally and queues the deletion for sync in one transaction. */
export async function deleteLocal(db: WayfareDB, table: SyncedTable, id: string): Promise<void> {
  await applyLocal(db, { upserts: [], deletes: [{ table, id }] });
}

export interface LocalChange {
  upserts: { table: SyncedTable; row: { id: string } }[];
  deletes: { table: SyncedTable; id: string }[];
}

/**
 * Several writes and deletes, plus their outbox entries, all or nothing. Upserts are queued in
 * the order given (a document before the link that points at it). Removing a document, city,
 * stay, leg or activity first removes the links pointing at it, so none is left dangling.
 */
export async function applyLocal(db: WayfareDB, change: LocalChange): Promise<void> {
  const tables = new Set([...change.upserts, ...change.deletes].map((c) => c.table));
  if (change.deletes.length > 0) tables.add('document_links');
  await db.transaction(
    'rw',
    [...[...tables].map((t) => localTable(db, t)), db.outbox],
    async () => {
      for (const { table, row } of change.upserts) {
        await localTable(db, table).put(row);
        await db.outbox.put({
          id: crypto.randomUUID(),
          table,
          op: 'upsert',
          row,
          createdAt: nextQueuedAt(),
        });
      }
      const queueDelete = async (table: SyncedTable, id: string) => {
        await localTable(db, table).delete(id);
        await db.outbox.put({
          id: crypto.randomUUID(),
          table,
          op: 'delete',
          // The server knows a link by its three key columns, not by the device's id.
          row: table === 'document_links' ? documentLinkKey(id) : { id },
          createdAt: nextQueuedAt(),
        });
      };
      for (const { table, id } of change.deletes) {
        for (const linkId of await linksTo(db, table, id)) {
          await queueDelete('document_links', linkId);
        }
        await queueDelete(table, id);
      }
    },
  );
}

async function linksTo(db: WayfareDB, table: SyncedTable, id: string): Promise<string[]> {
  if (table === 'documents') {
    return db.documentLinks.where('document_id').equals(id).primaryKeys();
  }
  const entityType = LINKED_ENTITY[table];
  if (!entityType) return [];
  return db.documentLinks.where('[entity_type+entity_id]').equals([entityType, id]).primaryKeys();
}

/** Removes everything stored on this device (used on sign-out). */
export async function wipeLocal(db: WayfareDB): Promise<void> {
  await db.delete();
  await db.open();
}
