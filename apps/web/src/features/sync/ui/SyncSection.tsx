import { CloudAlert, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '@/shared/lib/online';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { useSync } from '../application/SyncProvider';
import type { SyncIssue } from '../domain/sync-issues';

function useFormatTime() {
  const { i18n } = useTranslation();
  const format = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (ms: number) => format.format(new Date(ms));
}

/** When the device last synced and fully refreshed, and a way to refresh everything now. */
export function SyncCard() {
  const { t } = useTranslation('syncIssues');
  const online = useOnline();
  const { lastSyncedAt, lastFullRefreshAt, refreshing, refreshAll } = useSync();
  const formatTime = useFormatTime();
  const [outcome, setOutcome] = useState<'done' | 'failed' | null>(null);
  const refresh = async () => {
    setOutcome(null);
    setOutcome((await refreshAll()) === 'synced' ? 'done' : 'failed');
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('sectionTitle')}</h2>
        </CardTitle>
        <CardDescription>{t('refreshAllHint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-0.5">
            <dt className="text-sm text-muted-foreground">{t('lastSynced')}</dt>
            <dd className="font-semibold">
              {lastSyncedAt ? formatTime(lastSyncedAt) : t('never')}
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-sm text-muted-foreground">{t('lastFullRefresh')}</dt>
            <dd className="font-semibold">
              {lastFullRefreshAt ? formatTime(lastFullRefreshAt) : t('never')}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={!online || refreshing} onClick={() => void refresh()}>
            <RefreshCw aria-hidden className={refreshing ? 'animate-spin' : undefined} />
            {refreshing ? t('refreshing') : t('refreshAll')}
          </Button>
          <span role="status" className="text-sm">
            {!online ? (
              <span className="text-muted-foreground">{t('offlineHint')}</span>
            ) : refreshing ? null : outcome === 'done' ? (
              <span className="font-semibold text-success">{t('refreshDone')}</span>
            ) : outcome === 'failed' ? (
              <span className="text-destructive">{t('refreshFailed')}</span>
            ) : null}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Changes the server refused, each with Retry and Discard. Hidden when there are none. */
export function SyncIssuesCard() {
  const { t } = useTranslation('syncIssues');
  const { issues, retryIssue } = useSync();
  // A retried change leaves the list while it is sent again; keep showing it until the pass ends,
  // so the row (and the focus in it) stays put, and say so if the server refused it again.
  const [retrying, setRetrying] = useState<ReadonlyMap<string, SyncIssue>>(new Map());
  const [retried, setRetried] = useState<ReadonlySet<string>>(new Set());
  const retry = async (issue: SyncIssue) => {
    if (retrying.has(issue.id)) return;
    setRetrying((m) => new Map(m).set(issue.id, issue));
    try {
      await retryIssue(issue.id);
    } finally {
      setRetrying((m) => {
        const next = new Map(m);
        next.delete(issue.id);
        return next;
      });
      setRetried((s) => new Set(s).add(issue.id));
    }
  };
  const shown = [
    ...issues,
    ...[...retrying.values()].filter((r) => !issues.some((i) => i.id === r.id)),
  ].sort((a, b) => a.createdAt - b.createdAt);
  if (shown.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <h2>{t('issuesTitle')}</h2>
          <Badge variant="destructive">{shown.length}</Badge>
        </CardTitle>
        <CardDescription>{t('issuesHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {shown.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              retrying={retrying.has(issue.id)}
              refusedAgain={retried.has(issue.id) && !retrying.has(issue.id)}
              onRetry={() => void retry(issue)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function IssueRow({
  issue,
  retrying,
  refusedAgain,
  onRetry,
}: {
  issue: SyncIssue;
  retrying: boolean;
  refusedAgain: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('syncIssues');
  const { t: tc } = useTranslation();
  const { discardIssue } = useSync();
  const formatTime = useFormatTime();
  const [busy, setBusy] = useState(false);
  const kind = t(`kind_${issue.kind}`);
  const name = issue.title ?? kind;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="grid gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 gap-3">
        <CloudAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="grid min-w-0 gap-0.5">
          <p className="font-semibold break-words">{name}</p>
          <p className="text-sm text-muted-foreground">
            {t(issue.op === 'delete' ? 'metaRemoved' : 'metaChanged', {
              kind,
              date: formatTime(issue.createdAt),
            })}
          </p>
          <p className="text-sm">{t(`reason_${issue.reason}`)}</p>
          <p role="status" className="text-sm text-destructive">
            {refusedAgain ? t('stillRefused') : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={busy || retrying}
              aria-label={t('discardNamed', { name })}
            >
              <Trash2 aria-hidden />
              {t('discard')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('discardTitle', { name })}</AlertDialogTitle>
              <AlertDialogDescription>{t('discardBody')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => void run(() => discardIssue(issue.id))}
              >
                {t('discard')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Not disabled while it runs, so keyboard focus stays on it. */}
        <Button
          variant="outline"
          aria-busy={retrying}
          aria-label={t('retryNamed', { name })}
          onClick={onRetry}
        >
          <RotateCcw aria-hidden className={retrying ? 'animate-spin' : undefined} />
          {t('retry')}
        </Button>
      </div>
    </li>
  );
}
