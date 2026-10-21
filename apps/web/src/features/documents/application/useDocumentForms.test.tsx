import { act, renderHook, waitFor } from '@testing-library/react';
import type { TravelDocument } from '@wayfare/shared';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../auth/application/AuthProvider';
import type { AuthService } from '../../auth/domain/auth-service';
import type { LabelBoosts } from '../domain/document';
import type { DocumentRepository } from '../domain/document-ports';
import { DocumentsProvider } from './DocumentsProvider';
import { useAddDocument, useEditDocument } from './useDocumentForms';

const session = {
  userId: '7e570000-0000-4000-8000-00000000a001',
  email: 'ana@example.com',
  displayName: 'Ana',
  avatarUrl: null,
  accessToken: 't',
};
const tripId = '7e570000-0000-4000-8000-000000000101';

function setup(initialBoosts: LabelBoosts = {}) {
  let stored: LabelBoosts = initialBoosts;
  const repository = {
    observeTrip: vi.fn(() => () => {}),
    add: vi.fn(async (_d: TravelDocument, _f: Blob) => {}),
    save: vi.fn(async (_d: TravelDocument) => {}),
    remove: vi.fn(async (_d: TravelDocument) => {}),
    readFile: vi.fn(async () => null),
    cacheFile: vi.fn(async () => {}),
  } satisfies DocumentRepository;
  const boosts = {
    read: vi.fn(async () => stored),
    write: vi.fn(async (_u: string, next: LabelBoosts) => {
      stored = next;
    }),
  };
  const auth = {
    currentSession: async () => session,
    onSessionChange: () => () => {},
  } as unknown as AuthService;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider service={auth}>
      <DocumentsProvider
        repository={repository}
        boosts={boosts}
        remoteFiles={{ download: vi.fn() }}
      >
        {children}
      </DocumentsProvider>
    </AuthProvider>
  );
  return { repository, boosts, wrapper, stored: () => stored };
}

const pdf = (name: string, size = 4) =>
  new File([new Uint8Array(size)], name, { type: 'application/pdf' });

describe('useAddDocument', () => {
  it('suggests a title and label from the file name and saves a private document', async () => {
    const { repository, boosts, wrapper } = setup();
    const { result } = renderHook(() => ({ form: useAddDocument(tripId), auth: useAuth() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.auth.session).not.toBeNull());
    const file = pdf('boarding-pass-CA1234.pdf');
    await act(async () => {
      expect(await result.current.form.pick(file)).toBe(true);
    });
    expect(result.current.form.draft).toMatchObject({
      title: 'Flight CA1234',
      label: 'flight',
      shared: false,
    });
    await act(async () => {
      expect(await result.current.form.save()).toBe(true);
    });
    const [saved, blob] = repository.add.mock.calls[0]!;
    expect(blob).toBe(file);
    expect(saved).toMatchObject({
      trip_id: tripId,
      owner_id: session.userId,
      visibility: 'private',
      label: 'flight',
      mime: 'application/pdf',
      size_bytes: 4,
      storage_path: `${session.userId}/${tripId}/${saved.id}`,
    });
    // The suggestion was kept: nothing to learn.
    expect(boosts.write).not.toHaveBeenCalled();
    expect(result.current.form.draft).toBeNull();
  });

  it('learns from a corrected label and uses it next time', async () => {
    const { wrapper, stored } = setup();
    const { result } = renderHook(() => ({ form: useAddDocument(tripId), auth: useAuth() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.auth.session).not.toBeNull());
    await act(async () => void (await result.current.form.pick(pdf('acmecorp-policy.pdf'))));
    expect(result.current.form.draft?.label).toBe('other');
    act(() => result.current.form.update({ label: 'insurance' }));
    await act(async () => void (await result.current.form.save()));
    expect(stored()).toMatchObject({ acmecorp: 'insurance' });

    await act(async () => void (await result.current.form.pick(pdf('acmecorp-2027.pdf'))));
    expect(result.current.form.draft?.label).toBe('insurance');
  });

  it('refuses unsupported and too large files with a reason', async () => {
    const { wrapper, repository } = setup();
    const { result } = renderHook(() => ({ form: useAddDocument(tripId), auth: useAuth() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.auth.session).not.toBeNull());
    await act(async () => {
      expect(
        await result.current.form.pick(new File(['x'], 'a.zip', { type: 'application/zip' })),
      ).toBe(false);
    });
    expect(result.current.form.fileError).toBe('unsupported');
    const big = pdf('big.pdf');
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    await act(async () => void (await result.current.form.pick(big)));
    expect(result.current.form.fileError).toBe('too_large');
    expect(result.current.form.draft).toBeNull();
    act(() => result.current.form.dismissFileError());
    expect(result.current.form.fileError).toBeNull();
    expect(repository.add).not.toHaveBeenCalled();
  });

  it('needs a title', async () => {
    const { wrapper, repository } = setup();
    const { result } = renderHook(() => ({ form: useAddDocument(tripId), auth: useAuth() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.auth.session).not.toBeNull());
    await act(async () => void (await result.current.form.pick(pdf('x.pdf'))));
    act(() => result.current.form.update({ title: '  ' }));
    await act(async () => {
      expect(await result.current.form.save()).toBe(false);
    });
    expect(result.current.form.errors).toEqual(['title_required']);
    expect(repository.add).not.toHaveBeenCalled();
  });
});

describe('useEditDocument', () => {
  const existing: TravelDocument = {
    id: '7e570000-0000-4000-8000-000000000102',
    trip_id: tripId,
    owner_id: session.userId,
    visibility: 'private',
    assignees: [],
    title: 'Passport',
    label: 'passport',
    tags: [],
    mime: 'image/png',
    size_bytes: 10,
    storage_path: 'a/b/c',
  };

  it('shares a document and removes it', async () => {
    const { wrapper, repository } = setup();
    const { result } = renderHook(() => useEditDocument(existing), { wrapper });
    act(() => result.current.update({ shared: true, title: 'Passport Ana' }));
    await act(async () => {
      expect(await result.current.save()).toBe(true);
    });
    expect(repository.save).toHaveBeenCalledWith({
      ...existing,
      title: 'Passport Ana',
      visibility: 'group',
    });
    await act(() => result.current.remove());
    expect(repository.remove).toHaveBeenCalledWith(existing);
  });
});
