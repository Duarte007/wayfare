import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthService } from '../domain/auth-service';
import { AuthProvider } from './AuthProvider';
import { useSignInFlow } from './useSignInFlow';

function fakeAuth(overrides: Partial<AuthService> = {}): AuthService {
  const ok = async () => ({ ok: true as const });
  return {
    currentSession: async () => null,
    onSessionChange: () => () => {},
    signInWithPassword: ok,
    signUp: ok,
    sendPasswordReset: ok,
    updatePassword: ok,
    sendEmailCode: ok,
    verifyEmailCode: ok,
    signInWithProvider: ok,
    signOut: async () => {},
    ...overrides,
  };
}

function render(service: AuthService) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider service={service}>{children}</AuthProvider>
  );
  return renderHook(() => useSignInFlow('https://app.example.com'), { wrapper });
}

describe('useSignInFlow', () => {
  it('shows a clear message for a wrong password', async () => {
    const { result } = render(
      fakeAuth({ signInWithPassword: async () => ({ ok: false, reason: 'invalid_credentials' }) }),
    );
    act(() => {
      result.current.setEmail('ana@example.com');
      result.current.setPassword('wrong');
    });
    await act(() => result.current.submit());
    expect(result.current.message).toEqual({ kind: 'error', key: 'errorInvalid' });
  });

  it('requires a strong password to create an account', () => {
    const { result } = render(fakeAuth());
    act(() => {
      result.current.switchMode('signUp');
      result.current.setEmail('ana@example.com');
      result.current.setPassword('short');
    });
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setPassword('long-enough-1'));
    expect(result.current.canSubmit).toBe(true);
  });

  it('asks to confirm the email after sign-up', async () => {
    const signUp = vi.fn(async () => ({ ok: true as const, needsEmailConfirmation: true }));
    const { result } = render(fakeAuth({ signUp }));
    act(() => {
      result.current.switchMode('signUp');
      result.current.setEmail('ana@example.com');
      result.current.setPassword('long-enough-1');
    });
    await act(() => result.current.submit());
    expect(signUp).toHaveBeenCalledWith(
      'ana@example.com',
      'long-enough-1',
      'https://app.example.com',
    );
    expect(result.current.mode).toBe('signIn');
    expect(result.current.message).toEqual({
      kind: 'info',
      key: 'confirmEmail',
      email: 'ana@example.com',
    });
  });

  it('moves to code verification after sending an email code', async () => {
    const { result } = render(fakeAuth());
    act(() => {
      result.current.switchMode('code');
      result.current.setEmail('ana@example.com');
    });
    await act(() => result.current.submit());
    expect(result.current.mode).toBe('verify');
    act(() => result.current.setCode('12a3456'));
    expect(result.current.code).toBe('123456');
  });
});
