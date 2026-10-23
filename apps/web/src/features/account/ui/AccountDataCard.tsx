import { Check, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { useDataExport } from '../application/useDataExport';
import { DeleteAccountDialog } from './DeleteAccountDialog';

/** "Your data": download a copy, or delete the account and everything in it. */
export function AccountDataCard() {
  const { t } = useTranslation('account');
  const { status, offlineCopy, download } = useDataExport();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('title')}</h2>
        </CardTitle>
        <CardDescription>{t('exportHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => void download()} disabled={status === 'working'}>
          <Download aria-hidden />
          {status === 'working' ? t('exporting') : t('export')}
        </Button>
        <span role="status" className="text-sm">
          {status === 'done' ? (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <Check className="size-4" aria-hidden />
              {offlineCopy ? t('exportedOffline') : t('exported')}
            </span>
          ) : status === 'error' ? (
            <span className="text-destructive">{t('exportError')}</span>
          ) : null}
        </span>
      </CardContent>
      <CardContent className="grid gap-3 border-t pt-5">
        <p className="max-w-prose text-sm text-muted-foreground">{t('deleteHint')}</p>
        <div>
          <DeleteAccountDialog />
        </div>
      </CardContent>
    </Card>
  );
}
