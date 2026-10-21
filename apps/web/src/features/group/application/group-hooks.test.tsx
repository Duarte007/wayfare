import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../auth/application/AuthProvider';
import type { AuthService } from '../../auth/domain/auth-service';
import { MembersProvider } from '../../members/application/MembersProvider';
import type { MemberDirectory, TripMember } from '../../members/domain/members';
import {
  InviteError,
  type InviteService,
  type PendingInviteStore,
  type TripAccess,
} from '../domain/group-ports';
import { GroupProvider } from './GroupProvider';
import { useGroupMembers } from './useGroupMembers';
import { useInviteAcceptance } from './useInviteAcceptance';
import { useInviteLink } from './useInviteLink';

const TOKEN = 'Ab3_-xYz0123456789abcdef';
const ana = { userId: 'ana', role: 'owner' as const, name: 'Ana' };
const bia = { userId: 'bia', role: 'editor' as const, name: 'Bia' };

function setup({
  userId = 'bia' as string | null,
  invites = {} as Partial<InviteService>,
  members = [ana, bia] as TripMember[],
} = {}) {
  const session = userId
    ? {
        userId,
        email: `${userId}@example.com`,
        displayName: null,
        avatarUrl: null,
        accessToken: 't',
      }
    : null;
  const auth = {
    currentSession: async () => session,
    onSessionChange: () => () => {},
  } as unknown as AuthService;
  let stored: string | null = null;
  const pendingInvite: PendingInviteStore = {
    save: vi.fn((t: string) => void (stored = t)),
    peek: () => stored,
    clear: vi.fn(() => void (stored = null)),
  };
  const access: TripAccess = { sync: vi.fn(async () => {}), forgetTrip: vi.fn(async () => {}) };
  let list = [...members];
  const directory: MemberDirectory = {
    cached: async () => list,
    refresh: async () => list,
    remove: vi.fn(async (_trip: string, id: string) => {
      list = list.filter((m) => m.userId !== id);
      return 'removed' as const;
    }),
  };
  const service: InviteService = {
    create: vi.fn(async () => 'new-token-0123456789'),
    accept: vi.fn(async () => ({ tripId: 'trip-1', alreadyMember: false })),
    ...invites,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider service={auth}>
      <MembersProvider directory={directory}>
        <GroupProvider invites={service} pendingInvite={pendingInvite} access={access}>
          {children}
        </GroupProvider>
      </MembersProvider>
    </AuthProvider>
  );
  return { wrapper, service, pendingInvite, access, directory, stored: () => stored };
}

afterEach(() => vi.unstubAllGlobals());

describe('useInviteAcceptance', () => {
  it('keeps the token for after sign-in when signed out, without calling the server', async () => {
    const s = setup({ userId: null });
    const { result } = renderHook(() => useInviteAcceptance(TOKEN), { wrapper: s.wrapper });
    await waitFor(() => expect(s.stored()).toBe(TOKEN));
    expect(result.current.state).toEqual({ status: 'signedOut' });
    expect(s.service.accept).not.toHaveBeenCalled();
  });

  it('joins once, syncs the trip down, clears the token and reports the trip', async () => {
    const s = setup();
    s.pendingInvite.save(TOKEN);
    const { result } = renderHook(() => useInviteAcceptance(TOKEN), { wrapper: s.wrapper });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'joined', tripId: 'trip-1' }),
    );
    expect(s.service.accept).toHaveBeenCalledTimes(1);
    expect(s.access.sync).toHaveBeenCalled();
    expect(s.stored()).toBeNull();
  });

  it('tells an existing member nothing changed', async () => {
    const s = setup({
      invites: { accept: async () => ({ tripId: 'trip-1', alreadyMember: true }) },
    });
    const { result } = renderHook(() => useInviteAcceptance(TOKEN), { wrapper: s.wrapper });
    await waitFor(() => expect(result.current.state.status).toBe('alreadyMember'));
    expect(s.access.sync).not.toHaveBeenCalled();
  });

  it('reports expired or used-up links as invalid', async () => {
    const s = setup({
      invites: {
        accept: async () => {
          throw new InviteError('invalid');
        },
      },
    });
    const { result } = renderHook(() => useInviteAcceptance(TOKEN), { wrapper: s.wrapper });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'invalid' }));
  });

  it('rejects a malformed token without asking the server', async () => {
    const s = setup();
    const { result } = renderHook(() => useInviteAcceptance('nope'), { wrapper: s.wrapper });
    expect(result.current.state).toEqual({ status: 'invalid' });
    await waitFor(() => expect(s.pendingInvite.clear).toHaveBeenCalled());
    expect(s.service.accept).not.toHaveBeenCalled();
  });

  it('waits for the network when offline, and retries on request', async () => {
    const accept = vi
      .fn<InviteService['accept']>()
      .mockRejectedValueOnce(new InviteError('offline'))
      .mockResolvedValue({ tripId: 'trip-1', alreadyMember: false });
    const s = setup({ invites: { accept } });
    const { result } = renderHook(() => useInviteAcceptance(TOKEN), { wrapper: s.wrapper });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'offline' }));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('joined'));
    expect(accept).toHaveBeenCalledTimes(2);
  });
});

describe('useGroupMembers', () => {
  const trip = { id: 'trip-1', owner_id: 'ana' };

  it('lets a member leave: removes them on the server and forgets the trip here', async () => {
    const s = setup({ userId: 'bia' });
    const { result } = renderHook(() => useGroupMembers(trip), { wrapper: s.wrapper });
    await waitFor(() => expect(result.current.myRole).toBe('editor'));
    await act(async () => {
      expect(await result.current.leave()).toBe(true);
    });
    expect(s.directory.remove).toHaveBeenCalledWith('trip-1', 'bia');
    expect(s.access.forgetTrip).toHaveBeenCalledWith('trip-1');
  });

  it('lets the owner remove someone and reloads the list', async () => {
    const s = setup({ userId: 'ana' });
    const { result } = renderHook(() => useGroupMembers(trip), { wrapper: s.wrapper });
    await waitFor(() => expect(result.current.members).toHaveLength(2));
    await act(async () => {
      await result.current.remove('bia');
    });
    await waitFor(() => expect(result.current.members.map((m) => m.userId)).toEqual(['ana']));
    expect(s.access.forgetTrip).not.toHaveBeenCalled();
  });

  it('knows the owner from the trip before the member list is on the device', async () => {
    const s = setup({ userId: 'ana', members: [] });
    const { result } = renderHook(() => useGroupMembers(trip), { wrapper: s.wrapper });
    await waitFor(() => expect(result.current.myRole).toBe('owner'));
  });

  it('keeps everyone and explains when the server cannot be reached', async () => {
    const s = setup({ userId: 'ana' });
    vi.mocked(s.directory.remove).mockResolvedValueOnce('offline');
    const { result } = renderHook(() => useGroupMembers(trip), { wrapper: s.wrapper });
    await waitFor(() => expect(result.current.members).toHaveLength(2));
    await act(async () => {
      expect(await result.current.remove('bia')).toBe(false);
    });
    expect(result.current.problem).toBe('offline');
  });
});

describe('useInviteLink', () => {
  it('creates a link for the chosen role and copies it when sharing is unavailable', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    const s = setup({ userId: 'ana' });
    const { result } = renderHook(() => useInviteLink('trip-1', 'Join'), { wrapper: s.wrapper });
    act(() => result.current.setRole('viewer'));
    await act(async () => {
      await result.current.create();
    });
    expect(s.service.create).toHaveBeenCalledWith('trip-1', 'viewer');
    expect(result.current.link).toBe(`${window.location.origin}/invite/new-token-0123456789`);
    await act(async () => {
      expect(await result.current.share()).toBe('copied');
    });
    expect(writeText).toHaveBeenCalledWith(result.current.link);
  });

  it('uses the Web Share API when there is one', async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, share });
    const s = setup({ userId: 'ana' });
    const { result } = renderHook(() => useInviteLink('trip-1', 'Join'), { wrapper: s.wrapper });
    await act(async () => {
      await result.current.create();
    });
    await act(async () => {
      expect(await result.current.share()).toBe('shared');
    });
    expect(share).toHaveBeenCalledWith({ text: 'Join', url: result.current.link });
  });

  it('asks for a new link after the role changes', async () => {
    const s = setup({ userId: 'ana' });
    const { result } = renderHook(() => useInviteLink('trip-1', 'Join'), { wrapper: s.wrapper });
    await act(async () => {
      await result.current.create();
    });
    act(() => result.current.setRole('viewer'));
    expect(result.current.link).toBeNull();
  });

  it('reports why a link could not be created', async () => {
    const s = setup({
      userId: 'ana',
      invites: {
        create: async () => {
          throw new InviteError('denied');
        },
      },
    });
    const { result } = renderHook(() => useInviteLink('trip-1', 'Join'), { wrapper: s.wrapper });
    await act(async () => {
      await result.current.create();
    });
    expect(result.current.error).toBe('denied');
  });
});
