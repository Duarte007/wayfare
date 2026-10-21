import { FileUp } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import type { useAddDocument } from '../application/useDocumentForms';
import { DocumentFields } from './DocumentFields';
import { formatSize } from './document-display';

/** Opens once a file is picked, prefilled with the suggested title and type. */
export function AddDocumentDialog({ form }: { form: ReturnType<typeof useAddDocument> }) {
  const { t, i18n } = useTranslation('documents');
  const { t: tc } = useTranslation();
  const { draft } = form;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await form.save();
  };

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => (open ? null : form.cancel())}>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('addTitle')}</DialogTitle>
          <DialogDescription>{t('addHint')}</DialogDescription>
        </DialogHeader>
        {draft ? (
          <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-5">
            <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm">
              <FileUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="grid min-w-0">
                <span className="text-xs text-muted-foreground">{t('file')}</span>
                <span className="truncate font-medium">{form.fileName}</span>
              </span>
              {form.fileSize !== null ? (
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {formatSize(form.fileSize, i18n.language)}
                </span>
              ) : null}
            </div>
            <DocumentFields
              input={draft}
              update={form.update}
              errors={form.errors}
              alternatives={draft.alternatives}
            />
            <DialogFooter>
              <Button type="submit" size="lg" disabled={form.saving}>
                {t('saveDocument')}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
