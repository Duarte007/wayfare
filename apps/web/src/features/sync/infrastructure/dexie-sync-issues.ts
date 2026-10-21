import type { SyncedTable } from '@wayfare/shared';
import { liveQuery } from 'dexie';
import {
  documentLinkKey,
  localTable,
  type OutboxEntry,
  type WayfareDB,
} from '../../../shared/infrastructure/db';
import { issueKind, issueReason, type SyncIssue, type SyncIssueStore } from '../domain/sync-issues';

type Row = Record<string, unknown>;

/** Set-aside changes from the outbox, described with what the device knows about each item. */
export class DexieSyncIssueStore implements SyncIssueStore {
  constructor(private readonly db: WayfareDB) {}

  observeIssues(listener: (issues: SyncIssue[]) => void) {
    const subscription = liveQuery(() => this.issues()).subscribe({
      next: listener,
      error: (err: unknown) => console.error('Failed to list sync issues', err),
    });
    return () => subscription.unsubscribe();
  }

  async issues(): Promise<SyncIssue[]> {
    const rejected = await this.db.outbox
      .orderBy('createdAt')
      .filter((e) => Boolean(e.rejected))
      .toArray();
    return Promise.all(
      rejected.map(async (entry) => ({
        id: entry.id,
        kind: issueKind(entry.table),
        op: entry.op,
        title: await this.titleOf(entry),
        reason: issueReason(entry.rejected!),
        detail: entry.rejected!,
        createdAt: entry.createdAt,
      })),
    );
  }

  async retry(changeId: string) {
    // Dexie removes a property updated to undefined.
    await this.db.outbox.update(changeId, { rejected: undefined });
  }

  async discard(changeId: string): Promise<SyncedTable | null> {
    return this.db.transaction('rw', this.db.outbox, async () => {
      const entry = await this.db.outbox.get(changeId);
      if (!entry) return null;
      await this.db.outbox.delete(changeId);
      return entry.table;
    });
  }

  /** The item's name: from the change itself, else from the device's copy of it. */
  private async titleOf(entry: OutboxEntry): Promise<string | null> {
    const row: Row = { ...(await this.stored(entry.table, entry.row.id)), ...entry.row };
    switch (entry.table) {
      case 'stops':
        return this.placeName(row.place_id);
      case 'legs': {
        const [from, to] = await Promise.all([
          this.stopName(row.from_stop_id),
          this.stopName(row.to_stop_id),
        ]);
        return from && to ? `${from} → ${to}` : (from ?? to);
      }
      case 'document_links': {
        const { document_id } = documentLinkKey(String(row.id));
        return text((await this.stored('documents', document_id))?.title);
      }
      default:
        return text(row.name) ?? text(row.title);
    }
  }

  private async stored(table: SyncedTable, id: unknown): Promise<Row | undefined> {
    return typeof id === 'string' ? localTable(this.db, table).get(id) : undefined;
  }

  private async placeName(placeId: unknown): Promise<string | null> {
    return text((await this.stored('places', placeId))?.name);
  }

  private async stopName(stopId: unknown): Promise<string | null> {
    return this.placeName((await this.stored('stops', stopId))?.place_id);
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
