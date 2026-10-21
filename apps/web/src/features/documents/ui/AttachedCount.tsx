import { Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';

/** A paperclip and how many documents are attached, for timeline rows; nothing when none. */
export function AttachedCount({ count, className }: { count: number; className?: string }) {
  const { t } = useTranslation('documentLinks');
  if (count === 0) return null;
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-0.5 text-xs', className)}>
      <Paperclip className="size-3.5" aria-hidden />
      <span aria-hidden>{count}</span>
      <span className="sr-only">{t('count', { count })}</span>
    </span>
  );
}
