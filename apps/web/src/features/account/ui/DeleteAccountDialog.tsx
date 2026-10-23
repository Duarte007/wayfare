import { CircleAlert, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { Field } from '@/shared/ui/ui';
import { useDeleteAccount } from '../application/useDeleteAccount';

/** Deleting the account: the person types a word to confirm; nothing happens by accident. */
export function DeleteAccountDialog() {
  const { t } = useTranslation('account');
  const { t: tc } = useTranslation();
  const confirmWord = t('deleteWord');
  const { typed, setTyped, status, canDelete, remove, reset } = useDeleteAccount(confirmWord);
  const [open, setOpen] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void remove();
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (status === 'deleting') return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive">
          <Trash2 aria-hidden />
          {t('delete')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="grid gap-2">
                <p>{t('deleteOwned')}</p>
                <p>{t('deleteShared')}</p>
                <p>{t('deleteFinal')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field
            label={t('deleteConfirmLabel', { word: confirmWord })}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          {status === 'offline' || status === 'error' ? (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden />
              <AlertDescription>
                {status === 'offline' ? t('deleteOffline') : t('deleteError')}
              </AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={status === 'deleting'}>
              {tc('cancel')}
            </AlertDialogCancel>
            <Button
              type="submit"
              disabled={!canDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              <Trash2 aria-hidden />
              {status === 'deleting' ? t('deleting') : t('deleteConfirm')}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
