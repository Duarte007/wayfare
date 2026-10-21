import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field } from '../../../shared/ui/ui';
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
      <h1 className="text-2xl font-bold">{t('updatePassword')}</h1>
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <Field
          label={t('newPassword')}
          type="password"
          autoComplete="new-password"
          hint={t('passwordHint')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {failed ? (
          <p className="text-sm text-danger" role="alert">
            {t('errorGeneric')}
          </p>
        ) : null}
        <Button type="submit" disabled={busy || !isStrongEnough(password)}>
          {t('updatePassword')}
        </Button>
      </form>
    </main>
  );
}
