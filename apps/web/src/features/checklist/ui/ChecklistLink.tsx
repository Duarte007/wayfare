import { Link } from '@tanstack/react-router';
import { ChevronRight, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChecklist } from '../application/useChecklist';

/** The trip page's way into the checklist, with how much of it is done. */
export function ChecklistLink({ tripId }: { tripId: string }) {
  const { t } = useTranslation('checklist');
  const view = useChecklist(tripId);
  const progress = view?.progress ?? { done: 0, total: 0 };
  const summary =
    progress.total > 0
      ? t('progress', { done: progress.done, total: progress.total })
      : t('progressNone');

  return (
    <Link
      to="/trips/$tripId/checklist"
      params={{ tripId }}
      className="flex min-h-11 items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ListChecks className="size-5 shrink-0 text-primary" aria-hidden />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-semibold">{t('tripLink')}</span>
        <span className="text-sm text-muted-foreground">{summary}</span>
      </span>
      {progress.total > 0 ? (
        <span
          className="hidden h-2 w-24 shrink-0 overflow-hidden rounded-full bg-muted sm:block"
          aria-hidden
        >
          <span
            className="block h-full rounded-full bg-success"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </span>
      ) : null}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
