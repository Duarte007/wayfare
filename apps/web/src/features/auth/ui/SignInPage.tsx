import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSelect } from '../../../shared/ui/LanguageSelect';
import { Button, Field } from '../../../shared/ui/ui';
import { useSignInFlow, type FlowMessage, type SignInMode } from '../application/useSignInFlow';

const SUBMIT_LABELS: Record<
  SignInMode,
  'signIn' | 'createAccount' | 'sendReset' | 'emailCode' | 'verifyCode'
> = {
  signIn: 'signIn',
  signUp: 'createAccount',
  forgot: 'sendReset',
  code: 'emailCode',
  verify: 'verifyCode',
};

export function SignInPage() {
  const { t } = useTranslation('auth');
  const flow = useSignInFlow();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void flow.submit();
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4 py-10">
      <header className="grid gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="text-muted">{t('subtitle')}</p>
      </header>

      <p className="rounded-lg border border-line bg-surface p-3 text-sm" role="note">
        {t('chinaNotice')}
      </p>

      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        <Field
          label={t('email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={flow.email}
          onChange={(e) => flow.setEmail(e.target.value)}
        />
        {flow.mode === 'signIn' || flow.mode === 'signUp' ? (
          <Field
            label={t('password')}
            type="password"
            autoComplete={flow.mode === 'signUp' ? 'new-password' : 'current-password'}
            required
            hint={flow.mode === 'signUp' ? t('passwordHint') : undefined}
            value={flow.password}
            onChange={(e) => flow.setPassword(e.target.value)}
          />
        ) : null}
        {flow.mode === 'verify' ? (
          <Field
            label={t('code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={flow.code}
            onChange={(e) => flow.setCode(e.target.value)}
          />
        ) : null}

        {flow.message ? <FlowMessageText message={flow.message} /> : null}

        <Button type="submit" disabled={!flow.canSubmit}>
          {t(SUBMIT_LABELS[flow.mode])}
        </Button>

        <ModeLinks mode={flow.mode} onSwitch={flow.switchMode} />
      </form>

      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t('or')}
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid gap-3">
        <Button
          variant="secondary"
          disabled={flow.busy}
          onClick={() => void flow.signInWith('apple')}
        >
          {t('continueApple')}
        </Button>
        <Button
          variant="secondary"
          disabled={flow.busy}
          onClick={() => void flow.signInWith('google')}
        >
          {t('continueGoogle')}
        </Button>
        {flow.mode !== 'code' && flow.mode !== 'verify' ? (
          <Button variant="secondary" disabled={flow.busy} onClick={() => flow.switchMode('code')}>
            {t('emailCode')}
          </Button>
        ) : null}
      </div>

      <footer className="flex justify-center">
        <LanguageSelect />
      </footer>
    </main>
  );
}

function FlowMessageText({ message }: { message: FlowMessage }) {
  const { t } = useTranslation('auth');
  if (message.kind === 'error') {
    return (
      <p className="text-sm text-danger" role="alert">
        {t(message.key)}
      </p>
    );
  }
  return (
    <p className="text-sm" role="status">
      {t(message.key, { email: message.email })}
    </p>
  );
}

function ModeLinks({ mode, onSwitch }: { mode: SignInMode; onSwitch: (mode: SignInMode) => void }) {
  const { t } = useTranslation('auth');
  if (mode !== 'signIn') {
    return (
      <Button
        type="button"
        variant="link"
        className="justify-self-start text-sm"
        onClick={() => onSwitch('signIn')}
      >
        {t('haveAccount')}
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <Button type="button" variant="link" onClick={() => onSwitch('signUp')}>
        {t('noAccount')}
      </Button>
      <Button type="button" variant="link" onClick={() => onSwitch('forgot')}>
        {t('forgotPassword')}
      </Button>
    </div>
  );
}
