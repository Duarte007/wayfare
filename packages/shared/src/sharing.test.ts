import { describe, expect, it } from 'vitest';
import { defaultDocumentVisibility, filterView } from './sharing.js';

const ana = 'ana';
const bia = 'bia';
const items = [
  { id: 'museum', visibility: 'group' as const, assignees: [], created_by: ana },
  { id: 'side-trip', visibility: 'group' as const, assignees: [bia], created_by: bia },
  { id: 'spa', visibility: 'private' as const, assignees: [], created_by: ana },
];

describe('itinerary views', () => {
  it('group view shows only what everyone does', () => {
    expect(filterView(items, 'group', ana).map((i) => i.id)).toEqual(['museum']);
  });

  it("a member's view adds items assigned to them and their own private items", () => {
    expect(filterView(items, { memberId: bia }, bia).map((i) => i.id)).toEqual([
      'museum',
      'side-trip',
    ]);
    expect(filterView(items, { memberId: ana }, ana).map((i) => i.id)).toEqual(['museum', 'spa']);
  });

  it('never shows someone else private items', () => {
    expect(filterView(items, { memberId: ana }, bia).map((i) => i.id)).toEqual(['museum']);
  });
});

describe('defaultDocumentVisibility', () => {
  it('keeps identity papers private and shares tickets', () => {
    expect(defaultDocumentVisibility('passport')).toBe('private');
    expect(defaultDocumentVisibility('train')).toBe('group');
  });
});
