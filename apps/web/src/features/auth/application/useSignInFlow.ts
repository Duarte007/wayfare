import { useState } from 'react';
import type { AuthFailure, AuthResult, OAuthProvider } from '../domain/auth-service';
import { isStrongEnough, isValidCode, isValidEmail } from '../domain/credentials';
import { useAuth } from './AuthProvider';

export type SignInMode = 'signIn' | 'signUp' | 'forgot' | 'code' | 'verify';

/** Translation keys in the `auth` namespace; the UI turns them into text. */
export type FlowMessage =
  | { kind: 'error'; key: 'errorInvalid' | 'errorGeneric' | 'passwordHint' }
  | { kind: 'info'; key: 'confirmEmail' | 'resetSent' | 'codeSent'; email: string };

const FAILURE_MESSAGES: Record<AuthFailure, FlowMessage> = {
  invalid_credentials: { kind: 'error', key: 'errorInvalid' },
  weak_password: { kind: 'error', key: 'passwordHint' },
  network: { kind: 'error', key: 'errorGeneric' },
  unknown: { kind: 'error', key: 'errorGeneric' },
};

/**
 * State machine behind the sign-in screen: email + password, sign-up, password reset,
 * passwordless email code, and OAuth. Holds no UI and no SDK calls.
 */
export function useSignInFlow(origin: string = window.location.origin) {
  const { service } = useAuth();
  const [mode, setMode] = useState<SignInMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FlowMessage | null>(null);

  const switchMode = (next: SignInMode) => {
    setMode(next);
    setMessage(null);
  };

  const run = async (
    action: () => Promise<AuthResult>,
    onSuccess?: (r: AuthResult & { ok: true }) => void,
  ) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (result.ok) onSuccess?.(result);
      else setMessage(FAILURE_MESSAGES[result.reason]);
    } catch {
      setMessage(FAILURE_MESSAGES.network);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    !busy &&
    isValidEmail(email) &&
    (mode !== 'signIn' || password.length > 0) &&
    (mode !== 'signUp' || isStrongEnough(password)) &&
    (mode !== 'verify' || isValidCode(code));

  const submit = () => {
    switch (mode) {
      case 'signIn':
        return run(() => service.signInWithPassword(email, password));
      case 'signUp':
        return run(
          () => service.signUp(email, password, origin),
          (r) => {
            if (!r.needsEmailConfirmation) return;
            setMode('signIn');
            setPassword('');
            setMessage({ kind: 'info', key: 'confirmEmail', email });
          },
        );
      case 'forgot':
        // Same message whether or not the account exists, so emails can't be enumerated.
        return run(
          () => service.sendPasswordReset(email, `${origin}/reset`),
          () => setMessage({ kind: 'info', key: 'resetSent', email }),
        );
      case 'code':
        return run(
          () => service.sendEmailCode(email),
          () => {
            setMode('verify');
            setMessage({ kind: 'info', key: 'codeSent', email });
          },
        );
      case 'verify':
        return run(() => service.verifyEmailCode(email, code));
    }
  };

  const signInWith = (provider: OAuthProvider) =>
    run(() => service.signInWithProvider(provider, origin));

  return {
    mode,
    email,
    password,
    code,
    busy,
    message,
    canSubmit,
    setEmail,
    setPassword,
    setCode: (value: string) => setCode(value.replace(/\D/g, '').slice(0, 6)),
    switchMode,
    submit,
    signInWith,
  };
}
