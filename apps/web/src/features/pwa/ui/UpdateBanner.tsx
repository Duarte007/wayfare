import { Loader2, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { useAppUpdate } from '../application/PwaProvider';

/**
 * "New version available — Reload". The live region is always mounted so screen readers announce
 * the message politely when it appears; it floats above the phone tab bar.
 */
export function UpdateBanner() {
  const { t } = useTranslation('app');
  const { available, reloading, reload, dismiss } = useAppUpdate();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 lg:bottom-6"
    >
      {available ? (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border bg-card py-2 pr-2 pl-4 text-card-foreground shadow-lg">
          <RefreshCw className="size-5 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 font-semibold">{t('updateAvailable')}</p>
          <Button size="sm" onClick={() => void reload()} disabled={reloading}>
            {reloading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {reloading ? t('reloading') : t('reload')}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t('dismissUpdate')}
            onClick={dismiss}
            disabled={reloading}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
