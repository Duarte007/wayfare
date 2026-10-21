import {
  CloudOff,
  KeyRound,
  LogIn,
  Mail,
  MailCheck,
  Plane,
  Send,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AppleLogo, GoogleLogo } from '../../../shared/ui/BrandIcons';
import { LanguageSelect } from '../../../shared/ui/LanguageSelect';
import { Button, Divider, Field, IconTile, PasswordField } from '../../../shared/ui/ui';
import { useSignInFlow, type FlowMessage, type SignInMode } from '../application/useSignInFlow';

type SubmitKey = 'signIn' | 'createAccount' | 'sendReset' | 'emailCode' | 'verifyCode';

const SUBMIT: Record<SignInMode, { label: SubmitKey; icon: LucideIcon }> = {
  signIn: { label: 'signIn', icon: LogIn },
  signUp: { label: 'createAccount', icon: UserPlus },
  forgot: { label: 'sendReset', icon: Send },
  code: { label: 'emailCode', icon: Send },
  verify: { label: 'verifyCode', icon: MailCheck },
};

export function SignInPage() {
  const { t } = useTranslation('auth');
  const flow = useSignInFlow();
  const submit = SUBMIT[flow.mode];
  const SubmitIcon = submit.icon;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void flow.submit();
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4 py-10">
      <header className="grid justify-items-start gap-3">
        <IconTile icon={Plane} />
        <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="text-muted">{t('subtitle')}</p>
      </header>

      <form className="grid gap-4" onSubmit={onSubmit} noValidate aria-busy={flow.busy}>
        <Field
          label={t('email')}
          icon={Mail}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={flow.email}
          onChange={(e) => flow.setEmail(e.target.value)}
        />
        {flow.mode === 'signIn' || flow.mode === 'signUp' ? (
          <PasswordField
            label={t('password')}
            icon={KeyRound}
            showLabel={t('showPassword')}
            hideLabel={t('hidePassword')}
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
            icon={KeyRound}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={flow.code}
            onChange={(e) => flow.setCode(e.target.value)}
          />
        ) : null}

        {flow.message ? <FlowMessageText message={flow.message} /> : null}

        <Button type="submit" disabled={!flow.canSubmit} icon={<SubmitIcon className="size-5" />}>
          {t(submit.label)}
        </Button>

        <ModeLinks mode={flow.mode} onSwitch={flow.switchMode} />
      </form>

      <Divider label={t('or')} />

      <div className="grid gap-3">
        <Button
          variant="dark"
          disabled={flow.busy}
          icon={<AppleLogo />}
          onClick={() => void flow.signInWith('apple')}
        >
          {t('continueApple')}
        </Button>
        <Button
          variant="secondary"
          disabled={flow.busy}
          icon={<GoogleLogo />}
          onClick={() => void flow.signInWith('google')}
        >
          {t('continueGoogle')}
        </Button>
        {flow.mode !== 'code' && flow.mode !== 'verify' ? (
          <Button
            variant="secondary"
            disabled={flow.busy}
            icon={<Mail className="size-5" />}
            onClick={() => flow.switchMode('code')}
          >
            {t('emailCode')}
          </Button>
        ) : null}
      </div>

      <aside className="flex gap-3 rounded-[var(--radius-card)] bg-sky-soft p-4 text-sm">
        <CloudOff className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden />
        <p>{t('offlineTip')}</p>
      </aside>

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
      <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
        {t(message.key)}
      </p>
    );
  }
  return (
    <p className="rounded-xl bg-success/10 px-3 py-2 text-sm" role="status">
      {t(message.key, { email: message.email })}
    </p>
  );
}

function ModeLinks({ mode, onSwitch }: { mode: SignInMode; onSwitch: (mode: SignInMode) => void }) {
  const { t } = useTranslation('auth');
  if (mode !== 'signIn') {
    return (
      <Button
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
      <Button variant="link" onClick={() => onSwitch('signUp')}>
        {t('noAccount')}
      </Button>
      <Button variant="link" onClick={() => onSwitch('forgot')}>
        {t('forgotPassword')}
      </Button>
    </div>
  );
}
