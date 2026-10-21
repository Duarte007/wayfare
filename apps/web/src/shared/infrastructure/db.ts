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
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).put(row);
    await db.outbox.put({
      id: crypto.randomUUID(),
      table,
      op: 'upsert',
      row,
      createdAt: nextQueuedAt(),
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
      createdAt: nextQueuedAt(),
    });
  });
}

export interface LocalChange {
  upserts: { table: SyncedTable; row: { id: string } }[];
  deletes: { table: SyncedTable; id: string }[];
}

/** Several writes and deletes, plus their outbox entries, all or nothing. */
export async function applyLocal(db: WayfareDB, change: LocalChange): Promise<void> {
  const tables = [...new Set([...change.upserts, ...change.deletes].map((c) => c.table))];
  await db.transaction('rw', [...tables.map((t) => db.table(t)), db.outbox], async () => {
    for (const { table, row } of change.upserts) {
      await db.table(table).put(row);
      await db.outbox.put({
        id: crypto.randomUUID(),
        table,
        op: 'upsert',
        row,
        createdAt: nextQueuedAt(),
      });
    }
    for (const { table, id } of change.deletes) {
      await db.table(table).delete(id);
      await db.outbox.put({
        id: crypto.randomUUID(),
        table,
        op: 'delete',
        row: { id },
        createdAt: nextQueuedAt(),
      });
    }
  });
}

/** Removes everything stored on this device (used on sign-out). */
export async function wipeLocal(db: WayfareDB): Promise<void> {
  await db.delete();
  await db.open();
}
