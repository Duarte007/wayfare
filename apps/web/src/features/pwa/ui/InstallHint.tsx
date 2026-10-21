import { Download, Share, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { IconTile } from '@/shared/ui/ui';
import { useInstallHint } from '../application/PwaProvider';

/** Offers installing the app: the browser's prompt, or Safari's Share → Add to Home Screen. */
export function InstallHint() {
  const { t } = useTranslation('app');
  const { hint, install, dismiss } = useInstallHint();
  if (!hint) return null;
  return (
    <Card className="gap-0 py-4 shadow-none">
      <CardContent className="flex items-start gap-3 pr-2">
        <IconTile icon={Download} tone="sky" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="font-bold">{t('installTitle')}</h2>
          {hint === 'prompt' ? (
            <>
              <p className="text-sm text-muted-foreground">{t('installBody')}</p>
              <Button size="sm" className="mt-2 w-fit" onClick={() => void install()}>
                <Download aria-hidden />
                {t('installAction')}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Share className="mr-1 inline size-4 align-[-0.15em]" aria-hidden />
              {t('installIos')}
            </p>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="-mt-2 text-muted-foreground"
          aria-label={t('dismissInstall')}
          onClick={dismiss}
        >
          <X aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}
