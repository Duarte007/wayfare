import { useNavigate } from '@tanstack/react-router';
import { Check, CircleAlert, KeyRound, LockKeyhole } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { IconTile, PasswordField } from '@/shared/ui/ui';
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
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden />
            <AlertDescription>{t('errorGeneric')}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" disabled={busy || !isStrongEnough(password)}>
          <Check aria-hidden />
          {t('updatePassword')}
        </Button>
      </form>
    </main>
  );
}
