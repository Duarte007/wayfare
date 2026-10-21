import type { TravelDocument } from '@wayfare/shared';
import { Download, ExternalLink, Loader2, Trash2, WifiOff } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Separator } from '@/shared/ui/separator';
import { useDocumentFile } from '../application/useDocumentFile';
import { useEditDocument } from '../application/useDocumentForms';
import { canPreviewImage, downloadName } from '../domain/document-file';
import { DocumentFields } from './DocumentFields';
import { DocumentLinks } from './DocumentLinks';
import { LABEL_ICONS } from './document-display';

/** Opens a document (from the device when possible), edits it or removes it. */
export function DocumentDialog({
  document,
  trigger,
}: {
  document: TravelDocument;
  trigger: ReactNode;
}) {
  const { t } = useTranslation('documents');
  const { t: tc } = useTranslation();
  const [open, setOpen] = useState(false);
  const form = useEditDocument(document);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (await form.save()) setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle className="pr-10 break-words">{document.title}</DialogTitle>
          <DialogDescription>{t('editHint')}</DialogDescription>
        </DialogHeader>
        <FileViewer document={document} enabled={open} />
        <Separator />
        <DocumentLinks document={document} />
        <Separator />
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-5">
          <DocumentFields input={form.input} update={form.update} errors={form.errors} />
          <DialogFooter className="sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="text-destructive">
                  <Trash2 aria-hidden />
                  {t('remove')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('removeTitle', { name: document.title })}</AlertDialogTitle>
                  <AlertDialogDescription>{t('removeBody')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => void form.remove().then(() => setOpen(false))}
                  >
                    <Trash2 aria-hidden />
                    {t('remove')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button type="submit" size="lg" disabled={form.saving}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FileViewer({ document, enabled }: { document: TravelDocument; enabled: boolean }) {
  const { t } = useTranslation('documents');
  const file = useDocumentFile(document, enabled);
  const Icon = LABEL_ICONS[document.label];

  if (file.status === 'loading') {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('loadingFile')}
      </p>
    );
  }
  if (file.status === 'unavailable') {
    return (
      <p className="flex items-start gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm">
        <WifiOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        {t('unavailable')}
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {canPreviewImage(document.mime) ? (
        <img
          src={file.url}
          alt={t('previewOf', { name: document.title })}
          className="max-h-[50dvh] w-full rounded-lg border bg-muted object-contain"
        />
      ) : (
        <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
          <Icon className="size-6 shrink-0" aria-hidden />
          {t('noPreview')}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={file.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            {t('open')}
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={file.url} download={downloadName(document.title, document.mime)}>
            <Download aria-hidden />
            {t('download')}
          </a>
        </Button>
      </div>
    </div>
  );
}
