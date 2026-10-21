import type { DocumentLabel, TravelDocument } from '@wayfare/shared';
import { CloudOff, ExternalLink, FileUp, Loader2, Paperclip, X } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { useDocumentFile } from '../application/useDocumentFile';
import { useAddDocument } from '../application/useDocumentForms';
import { useEntityDocuments } from '../application/useDocumentLinks';
import { ACCEPT_ATTRIBUTE, MAX_DOCUMENT_BYTES, type FileError } from '../domain/document-file';
import type { LinkEntity } from '../domain/document-link';
import { AddDocumentDialog } from './AddDocumentDialog';
import { LABEL_ICONS } from './document-display';

const FILE_ERROR_KEYS = {
  unsupported: 'errorUnsupported',
  too_large: 'errorTooLarge',
  empty: 'errorEmpty',
} as const satisfies Record<FileError, string>;

/**
 * The documents attached to a stay, leg or activity: open them (from the device, offline too),
 * detach them, attach another of the trip's documents or upload a new one (`label` is its type).
 * Render it outside the host's own form: the nested dialogs submit forms of their own.
 */
export function EntityDocuments({
  tripId,
  entity,
  label,
}: {
  tripId: string;
  entity: LinkEntity;
  label: DocumentLabel;
}) {
  const { t, i18n } = useTranslation('documentLinks');
  const { t: td } = useTranslation('documents');
  const { t: tc } = useTranslation();
  const documents = useEntityDocuments(tripId, entity, i18n.language);
  const add = useAddDocument(tripId, { entity, label });
  const picker = useRef<HTMLInputElement>(null);
  const [choosing, setChoosing] = useState(false);
  const headingId = useId();

  const onPicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires a change.
    e.target.value = '';
    if (file) void add.pick(file);
  };

  if (documents.loading) return null;

  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h3 id={headingId} className="inline-flex items-center gap-2 font-semibold">
        <Paperclip className="size-4 text-muted-foreground" aria-hidden />
        {t('documents')}
      </h3>
      {documents.linked.length > 0 ? (
        <ul className="grid gap-1.5">
          {documents.linked.map((document) => (
            <li key={document.id} className="min-w-0">
              <LinkedDocument document={document} onDetach={() => documents.detach(document)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('none')}</p>
      )}
      {add.fileError ? (
        <p role="alert" className="text-sm text-destructive">
          {td(FILE_ERROR_KEYS[add.fileError], { max: MAX_DOCUMENT_BYTES / (1024 * 1024) })}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => {
          add.dismissFileError();
          setChoosing(true);
        }}
      >
        <Paperclip aria-hidden />
        {t('attach')}
      </Button>
      <input
        ref={picker}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        hidden
        tabIndex={-1}
        onChange={onPicked}
      />

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent closeLabel={tc('close')}>
          <DialogHeader>
            <DialogTitle>{t('attachTitle')}</DialogTitle>
            <DialogDescription>{t('attachHint')}</DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              picker.current?.click();
              setChoosing(false);
            }}
          >
            <FileUp aria-hidden />
            {t('uploadNew')}
          </Button>
          {documents.others.length > 0 ? (
            <ul className="grid max-h-[50dvh] gap-1.5 overflow-y-auto">
              {documents.others.map((document) => {
                const Icon = LABEL_ICONS[document.label];
                return (
                  <li key={document.id} className="min-w-0">
                    <button
                      type="button"
                      className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      onClick={() => {
                        void documents.attach(document);
                        setChoosing(false);
                      }}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate font-medium">{document.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noOthers')}</p>
          )}
        </DialogContent>
      </Dialog>

      <AddDocumentDialog form={add} />
    </section>
  );
}

/** Opens the file in a new tab, straight from the device when it is there. */
function LinkedDocument({
  document,
  onDetach,
}: {
  document: TravelDocument;
  onDetach: () => void;
}) {
  const { t } = useTranslation('documentLinks');
  const { t: td } = useTranslation('documents');
  const file = useDocumentFile(document);
  const Icon = LABEL_ICONS[document.label];
  const content = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="grid min-w-0 flex-1">
        <span className="truncate font-medium">{document.title}</span>
        {file.status === 'unavailable' ? (
          <span className="text-xs text-muted-foreground">{td('remoteOnly')}</span>
        ) : null}
      </span>
      {file.status === 'loading' ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : file.status === 'ready' ? (
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <CloudOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </>
  );
  const rowClass = 'flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm';

  return (
    <div className="flex min-w-0 items-center rounded-lg border">
      {file.status === 'ready' ? (
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('openNamed', { name: document.title })}
          className={`${rowClass} transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none`}
        >
          {content}
        </a>
      ) : (
        <span className={rowClass}>{content}</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground"
        aria-label={t('detachNamed', { name: document.title })}
        onClick={onDetach}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
