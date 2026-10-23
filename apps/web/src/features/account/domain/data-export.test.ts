import { describe, expect, it } from 'vitest';
import { buildDataExport, exportFileName } from './data-export';

const account = { id: 'u1', email: 'ana@example.com', displayName: 'Ana' };

describe('buildDataExport', () => {
  it('keeps every table, drops removed rows and sync bookkeeping', () => {
    const file = buildDataExport({
      account,
      tables: {
        trips: [
          { id: 't1', name: 'Trip', version: 7, deleted_at: null },
          { id: 't2', name: 'Gone', deleted_at: '2026-10-01T00:00:00Z' },
        ],
      },
      exportedAt: new Date('2026-10-23T10:00:00Z'),
      syncedBeforeExport: true,
    });
    expect(file.tables.trips).toEqual([{ id: 't1', name: 'Trip', deleted_at: null }]);
    expect(file.tables.document_links).toEqual([]);
    expect(Object.keys(file.tables)).toContain('checklist_items');
    expect(file).toMatchObject({
      format: 'wayfare-export',
      version: 1,
      exportedAt: '2026-10-23T10:00:00.000Z',
      syncedBeforeExport: true,
      account,
    });
  });
});

describe('exportFileName', () => {
  it('uses the local date', () => {
    expect(exportFileName(new Date(2026, 0, 5, 23, 59))).toBe('wayfare-data-2026-01-05.json');
  });
});
