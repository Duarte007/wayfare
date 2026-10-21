import { describe, expect, it } from 'vitest';
import { sortMembers, type TripMember } from './members';

describe('sortMembers', () => {
  it('puts the owner first, then sorts by name', () => {
    const members: TripMember[] = [
      { userId: 'c', role: 'editor', name: 'Caio' },
      { userId: 'b', role: 'viewer', name: 'Bia' },
      { userId: 'a', role: 'owner', name: 'Zé' },
      { userId: 'd', role: 'editor', name: 'Ana' },
    ];
    expect(sortMembers(members).map((m) => m.userId)).toEqual(['a', 'd', 'c', 'b']);
  });
});
