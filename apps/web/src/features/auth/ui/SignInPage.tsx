import {
  CircleAlert,
  CircleCheck,
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
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { AppleLogo, GoogleLogo } from '@/shared/ui/BrandIcons';
import { Button } from '@/shared/ui/button';
import { LanguageSelect } from '@/shared/ui/LanguageSelect';
import { Divider, Field, IconTile, PasswordField } from '@/shared/ui/ui';
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
    <main className="relative mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4 py-16">
      {/* Before sign-in there is no profile yet, so the language picker sits in the corner. */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4">
        <LanguageSelect />
      </div>
      <header className="grid justify-items-start gap-3">
        <IconTile icon={Plane} />
        <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
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

        <Button type="submit" size="lg" disabled={!flow.canSubmit}>
          <SubmitIcon aria-hidden />
          {t(submit.label)}
        </Button>

        <ModeLinks mode={flow.mode} onSwitch={flow.switchMode} />
      </form>

      <Divider label={t('or')} />

      <div className="grid gap-3">
        <Button
          variant="contrast"
          size="lg"
          disabled={flow.busy}
          onClick={() => void flow.signInWith('apple')}
        >
          <AppleLogo />
          {t('continueApple')}
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={flow.busy}
          onClick={() => void flow.signInWith('google')}
        >
          <GoogleLogo />
          {t('continueGoogle')}
        </Button>
        {flow.mode !== 'code' && flow.mode !== 'verify' ? (
          <Button
            variant="outline"
            size="lg"
            disabled={flow.busy}
            onClick={() => flow.switchMode('code')}
          >
            <Mail aria-hidden />
            {t('emailCode')}
          </Button>
        ) : null}
      </div>

      <Alert variant="info" role="note">
        <CloudOff aria-hidden />
        <AlertDescription>{t('offlineTip')}</AlertDescription>
      </Alert>
    </main>
  );
}

function FlowMessageText({ message }: { message: FlowMessage }) {
  const { t } = useTranslation('auth');
  if (message.kind === 'error') {
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlert aria-hidden />
        <AlertDescription>{t(message.key)}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="success" role="status">
      <CircleCheck aria-hidden />
      <AlertDescription>{t(message.key, { email: message.email })}</AlertDescription>
    </Alert>
  );
}

function ModeLinks({ mode, onSwitch }: { mode: SignInMode; onSwitch: (mode: SignInMode) => void }) {
  const { t } = useTranslation('auth');
  if (mode !== 'signIn') {
    return (
      <Button
        variant="link"
        size="link"
        className="justify-self-start"
        onClick={() => onSwitch('signIn')}
      >
        {t('haveAccount')}
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <Button variant="link" size="link" onClick={() => onSwitch('signUp')}>
        {t('noAccount')}
      </Button>
      <Button variant="link" size="link" onClick={() => onSwitch('forgot')}>
        {t('forgotPassword')}
      </Button>
    </div>
  );
}
