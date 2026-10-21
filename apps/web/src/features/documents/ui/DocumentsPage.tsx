import type { DocumentLabel } from '@wayfare/shared';
import { Link, useParams } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  CloudOff,
  CloudUpload,
  FileText,
  Loader2,
  Lock,
  Plus,
  Search,
  SearchX,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useId, useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Field, IconTile } from '@/shared/ui/ui';
import { useTripDetails } from '../../trips/application/useTripDetails';
import { useDocumentList } from '../application/useDocuments';
import { useAddDocument } from '../application/useDocumentForms';
import { ACCEPT_ATTRIBUTE, MAX_DOCUMENT_BYTES, type FileError } from '../domain/document-file';
import type { DocumentEntry } from '../domain/document-ports';
import { AddDocumentDialog } from './AddDocumentDialog';
import { DocumentDialog } from './DocumentDialog';
import { formatSize, LABEL_ICONS } from './document-display';

const ALL = 'all';

const FILE_ERROR_KEYS = {
  unsupported: 'errorUnsupported',
  too_large: 'errorTooLarge',
  empty: 'errorEmpty',
} as const satisfies Record<FileError, string>;

/** The trip's documents: add, search, filter, open (offline too), edit and remove. */
export function DocumentsPage() {
  const { t, i18n } = useTranslation('documents');
  const { t: tl } = useTranslation('labels');
  const { t: tc } = useTranslation();
  const { t: tt } = useTranslation('trips');
  const { tripId } = useParams({ strict: false }) as { tripId: string };
  const details = useTripDetails(tripId);
  const labelName = useCallback((label: DocumentLabel) => tl(label), [tl]);
  const list = useDocumentList(tripId, labelName, i18n.language);
  const add = useAddDocument(tripId);
  const picker = useRef<HTMLInputElement>(null);
  const ids = { filter: useId() };

  const onPicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires a change.
    e.target.value = '';
    if (file) void add.pick(file);
  };

  if (details === undefined || list.loading) {
    return (
      <p className="inline-flex items-center gap-2 text-muted-foreground" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {tc('loading')}
      </p>
    );
  }
  if (details === null) {
    // The trip left this device (deleted, or you left the group).
    return <p className="text-muted-foreground">{tt('notFound')}</p>;
  }
  const filtering = list.query.trim() !== '' || list.label !== null;

  return (
    <>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit max-w-full text-muted-foreground"
      >
        <Link to="/trips/$tripId" params={{ tripId }}>
          <ArrowLeft aria-hidden />
          <span className="truncate">{details.trip.name}</span>
        </Link>
      </Button>

      <header className="grid gap-4 sm:flex sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <IconTile icon={FileText} tone="sky" />
          <div className="grid min-w-0 gap-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => picker.current?.click()}>
          <Plus aria-hidden />
          {t('add')}
        </Button>
        <input
          ref={picker}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          hidden
          tabIndex={-1}
          onChange={onPicked}
        />
      </header>

      {add.fileError ? (
        <Alert variant="destructive" role="alert" className="pr-14">
          <AlertCircle aria-hidden />
          <AlertDescription>
            {t(FILE_ERROR_KEYS[add.fileError], { max: MAX_DOCUMENT_BYTES / (1024 * 1024) })}
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0.5 right-0.5"
            aria-label={tc('close')}
            onClick={add.dismissFileError}
          >
            <X aria-hidden />
          </Button>
        </Alert>
      ) : null}

      {list.total > 0 ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <Field
            label={t('search')}
            icon={Search}
            type="search"
            placeholder={t('searchPlaceholder')}
            value={list.query}
            onChange={(e) => list.setQuery(e.target.value)}
            autoComplete="off"
          />
          <div className="grid gap-2">
            <Label id={ids.filter}>{t('filter')}</Label>
            <Select
              value={list.label ?? ALL}
              onValueChange={(value) =>
                list.setLabel(value === ALL ? null : (value as DocumentLabel))
              }
            >
              <SelectTrigger aria-labelledby={ids.filter} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allTypes')}</SelectItem>
                {list.labels.map((label) => {
                  const Icon = LABEL_ICONS[label];
                  return (
                    <SelectItem key={label} value={label}>
                      <Icon aria-hidden />
                      {tl(label)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {list.total === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="grid justify-items-center gap-3 py-4 text-center">
            <IconTile icon={FileText} size="lg" />
            <h2 className="text-xl font-bold">{t('emptyTitle')}</h2>
            <p className="max-w-sm text-muted-foreground">{t('empty')}</p>
            <Button variant="outline" onClick={() => picker.current?.click()}>
              <Plus aria-hidden />
              {t('add')}
            </Button>
          </CardContent>
        </Card>
      ) : list.entries.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
          <SearchX className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">{t('noMatchesTitle')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('noMatches')}</p>
          <Button
            variant="outline"
            onClick={() => {
              list.setQuery('');
              list.setLabel(null);
            }}
          >
            {t('clearFilters')}
          </Button>
        </div>
      ) : (
        <section aria-label={t('title')} className="grid gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filtering
              ? `${t('count', { count: list.entries.length })} / ${list.total}`
              : t('count', { count: list.total })}
          </p>
          <ul className="grid gap-2">
            {list.entries.map((entry) => (
              <li key={entry.document.id} className="min-w-0">
                <DocumentRow entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <AddDocumentDialog form={add} />
    </>
  );
}

function DocumentRow({ entry }: { entry: DocumentEntry }) {
  const { t, i18n } = useTranslation('documents');
  const { t: tl } = useTranslation('labels');
  const { document, file } = entry;
  const Icon = LABEL_ICONS[document.label];
  const isPrivate = document.visibility === 'private';

  return (
    <DocumentDialog
      document={document}
      trigger={
        <button
          type="button"
          className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-semibold">{document.title}</span>
              {isPrivate ? (
                <Lock
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-label={t('private')}
                />
              ) : (
                <Users
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-label={t('shared')}
                />
              )}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{tl(document.label)}</span>
              <span aria-hidden>·</span>
              <span>{formatSize(document.size_bytes, i18n.language)}</span>
              <FileBadge status={file} />
            </span>
          </span>
        </button>
      }
    />
  );
}

function FileBadge({ status }: { status: DocumentEntry['file'] }) {
  const { t } = useTranslation('documents');
  if (status === 'pending_upload') {
    return (
      <Badge variant="info">
        <CloudUpload aria-hidden />
        {t('pendingUpload')}
      </Badge>
    );
  }
  if (status === 'upload_failed') {
    return (
      <Badge variant="destructive">
        <AlertCircle aria-hidden />
        {t('uploadFailed')}
      </Badge>
    );
  }
  if (status === 'remote_only') {
    return (
      <Badge variant="secondary">
        <CloudOff aria-hidden />
        {t('remoteOnly')}
      </Badge>
    );
  }
  return null;
}
