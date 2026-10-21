import { useNavigate } from '@tanstack/react-router';
import { Check, KeyRound, LockKeyhole } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconTile, PasswordField } from '../../../shared/ui/ui';
import { useAuth } from '../application/AuthProvider';
import { isStrongEnough } from '../domain/credentials';

/** Landing page of the reset email link; Supabase has already signed the user in from the URL. */
export function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const { service } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await service.updatePassword(password);
    setBusy(false);
    if (result.ok) void navigate({ to: '/' });
    else setFailed(true);
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4">
      <header className="grid justify-items-start gap-3">
        <IconTile icon={LockKeyhole} />
        <h1 className="text-2xl font-bold">{t('updatePassword')}</h1>
      </header>
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)} aria-busy={busy}>
        <PasswordField
          label={t('newPassword')}
          icon={KeyRound}
          showLabel={t('showPassword')}
          hideLabel={t('hidePassword')}
          autoComplete="new-password"
          hint={t('passwordHint')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {failed ? (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {t('errorGeneric')}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={busy || !isStrongEnough(password)}
          icon={<Check className="size-5" />}
        >
          {t('updatePassword')}
        </Button>
      </form>
    </main>
  );
}
