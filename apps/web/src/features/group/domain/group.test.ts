import type { Activity, Leg, Stay } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import {
  canInvite,
  canLeave,
  canRemove,
  filterPlan,
  inviteUrl,
  isInviteToken,
  viewFor,
} from './group';

const ana = 'ana';
const bia = 'bia';

const shared = { trip_id: 't', stop_id: 's' };
const stay = (id: string, extra: Partial<Stay>): Stay => ({
  ...shared,
  id,
  name: id,
  check_in: '2027-01-01',
  check_out: '2027-01-02',
  visibility: 'group',
  assignees: [],
  created_by: ana,
  ...extra,
});
const leg = (id: string, extra: Partial<Leg>): Leg => ({
  trip_id: 't',
  id,
  from_stop_id: 'a',
  to_stop_id: 'b',
  mode: 'train',
  visibility: 'group',
  assignees: [],
  created_by: ana,
  ...extra,
});
const activity = (id: string, extra: Partial<Activity>): Activity => ({
  ...shared,
  id,
  title: id,
  needs_booking: false,
  booked: false,
  source: 'user',
  visibility: 'group',
  assignees: [],
  created_by: ana,
  ...extra,
});

describe('member permissions', () => {
  it('lets owners and editors invite, not viewers', () => {
    expect(canInvite('owner')).toBe(true);
    expect(canInvite('editor')).toBe(true);
    expect(canInvite('viewer')).toBe(false);
    expect(canInvite(undefined)).toBe(false);
  });

  it('lets only the owner remove, and never themselves', () => {
    const owner = { userId: ana, role: 'owner' as const };
    const editor = { userId: bia, role: 'editor' as const, name: 'Bia' };
    expect(canRemove(owner, editor)).toBe(true);
    expect(canRemove(owner, { ...owner, name: 'Ana' })).toBe(false);
    expect(canRemove(editor, { ...owner, name: 'Ana' })).toBe(false);
  });

  it('lets members leave, but not the owner', () => {
    expect(canLeave('editor')).toBe(true);
    expect(canLeave('viewer')).toBe(true);
    expect(canLeave('owner')).toBe(false);
    expect(canLeave(undefined)).toBe(false);
  });
});

describe('invite links', () => {
  it('accepts URL-safe tokens only', () => {
    expect(isInviteToken('Ab3_-xYz0123456789abcdef')).toBe(true);
    expect(isInviteToken('short')).toBe(false);
    expect(isInviteToken('has spaces in it, sadly!')).toBe(false);
  });

  it('builds the link from the app origin', () => {
    expect(inviteUrl('https://app.example/', 'tok_en')).toBe('https://app.example/invite/tok_en');
  });
});

describe('filterPlan', () => {
  const plan = {
    name: 'kept',
    stays: [stay('hotel', {}), stay('my-hostel', { visibility: 'private' })],
    legs: [leg('train', {}), leg('bia-flight', { assignees: [bia], created_by: bia })],
    activities: [
      activity('museum', {}),
      activity('bia-tour', { assignees: [bia] }),
      activity('ana-spa', { visibility: 'private' }),
    ],
  };
  const ids = (p: typeof plan) => [...p.stays, ...p.legs, ...p.activities].map((i) => i.id);

  it('"everyone" shows only what the whole group does', () => {
    expect(ids(filterPlan(plan, 'everyone', ana))).toEqual(['hotel', 'train', 'museum']);
  });

  it('"mine" adds items for the viewer and their own private ones', () => {
    expect(ids(filterPlan(plan, 'mine', ana))).toEqual([
      'hotel',
      'my-hostel',
      'train',
      'museum',
      'ana-spa',
    ]);
    expect(ids(filterPlan(plan, 'mine', bia))).toEqual([
      'hotel',
      'train',
      'bia-flight',
      'museum',
      'bia-tour',
    ]);
  });

  it('keeps the rest of the plan untouched', () => {
    expect(filterPlan(plan, 'mine', ana).name).toBe('kept');
    expect(viewFor('everyone', ana)).toBe('group');
  });
});
