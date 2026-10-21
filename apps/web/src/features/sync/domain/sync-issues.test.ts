import { SYNCED_TABLES } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { issueKind, issueReason } from './sync-issues';

describe('sync issues', () => {
  it('reads the reason from the stored SQLSTATE', () => {
    expect(issueReason('42501 new row violates row-level security policy')).toBe('permission');
    expect(issueReason('23503 insert or update violates foreign key constraint')).toBe('missing');
    expect(issueReason('23505 duplicate key value')).toBe('duplicate');
    expect(issueReason('23514 check violation')).toBe('invalid');
    expect(issueReason('22P02 invalid input syntax')).toBe('invalid');
    expect(issueReason('rejected')).toBe('invalid');
  });

  it('names every synced table as something the person knows', () => {
    expect(SYNCED_TABLES.map(issueKind)).toEqual([
      'trip',
      'city',
      'city',
      'stay',
      'leg',
      'activity',
      'document',
      'checklist',
      'link',
    ]);
  });
});
