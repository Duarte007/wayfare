import type {
  Activity,
  DocumentLink,
  Leg,
  Place,
  Stay,
  Stop,
  TravelDocument,
  Trip,
} from '@wayfare/shared';
import type { SyncedTable } from '@wayfare/shared';
import Dexie, { type EntityTable } from 'dexie';

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
  documentLinks!: EntityTable<DocumentLink & { id: string }, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'id'>;
  meta!: EntityTable<Meta, 'key'>;

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
  }
}

/** Writes locally and queues the change for sync in one transaction. */
export async function saveLocal<T extends { id: string }>(
  db: WayfareDB,
  table: SyncedTable,
  row: T,
): Promise<void> {
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).put(row);
    await db.outbox.put({
      id: crypto.randomUUID(),
      table,
      op: 'upsert',
      row,
      createdAt: Date.now(),
    });
  });
}

/** Deletes locally and queues the deletion for sync in one transaction. */
export async function deleteLocal(db: WayfareDB, table: SyncedTable, id: string): Promise<void> {
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).delete(id);
    await db.outbox.put({
      id: crypto.randomUUID(),
      table,
      op: 'delete',
      row: { id },
      createdAt: Date.now(),
    });
  });
}

/** Removes everything stored on this device (used on sign-out). */
export async function wipeLocal(db: WayfareDB): Promise<void> {
  await db.delete();
  await db.open();
}
