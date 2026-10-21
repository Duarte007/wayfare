import { learnBoosts, type TravelDocument } from '@wayfare/shared';
import { useState } from 'react';
import { useAuth } from '../../auth/application/AuthProvider';
import {
  buildDocument,
  documentToInput,
  draftFromFileName,
  validateDocument,
  type DocumentDraft,
  type DocumentError,
  type DocumentInput,
} from '../domain/document';
import { mimeOf, validateFile, type FileError } from '../domain/document-file';
import { useDocumentsDependencies } from './DocumentsProvider';

/**
 * Add a document: pick a file, review the suggested title and label, save. The file stays on the
 * device (it opens offline) and uploads on the next sync.
 */
export function useAddDocument(tripId: string) {
  const { repository, boosts } = useDocumentsDependencies();
  const { session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [fileError, setFileError] = useState<FileError | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors: DocumentError[] = draft && submitted ? validateDocument(draft) : [];

  /** Checks the file and prepares the draft; false when the file can't be added. */
  const pick = async (picked: File): Promise<boolean> => {
    const error = validateFile(picked);
    setFileError(error);
    if (error || !session) return false;
    const learned = await boosts.read(session.userId).catch(() => ({}));
    setFile(picked);
    setDraft(draftFromFileName(picked.name, learned));
    setSubmitted(false);
    return true;
  };

  const update = (patch: Partial<DocumentInput>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));

  const cancel = () => {
    setFile(null);
    setDraft(null);
    setSubmitted(false);
  };

  const dismissFileError = () => setFileError(null);

  /** True when saved. */
  const save = async (): Promise<boolean> => {
    setSubmitted(true);
    if (!draft || !file || !session || saving || validateDocument(draft).length > 0) return false;
    setSaving(true);
    try {
      const document = buildDocument(draft, {
        id: crypto.randomUUID(),
        tripId,
        userId: session.userId,
        file: { mime: mimeOf(file)!, size: file.size },
        suggestion: { label: draft.suggestedLabel, confidence: draft.confidence },
      });
      await repository.add(document, file);
      // A corrected label teaches the next similar file name.
      if (draft.label !== draft.suggestedLabel && draft.label !== 'other') {
        const current = await boosts.read(session.userId).catch(() => ({}));
        await boosts
          .write(session.userId, learnBoosts(file.name, draft.label, current))
          .catch(() => undefined);
      }
      cancel();
      return true;
    } finally {
      setSaving(false);
    }
  };

  return {
    fileName: file?.name ?? null,
    fileSize: file?.size ?? null,
    draft,
    fileError,
    errors,
    saving,
    pick,
    update,
    save,
    cancel,
    dismissFileError,
  };
}

/** Edit a document's title, label and sharing, or remove it. */
export function useEditDocument(existing: TravelDocument) {
  const { repository } = useDocumentsDependencies();
  const [input, setInput] = useState<DocumentInput>(() => documentToInput(existing));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = submitted ? validateDocument(input) : [];

  const update = (patch: Partial<DocumentInput>) =>
    setInput((current) => ({ ...current, ...patch }));

  const reset = () => {
    setInput(documentToInput(existing));
    setSubmitted(false);
  };

  const save = async (): Promise<boolean> => {
    setSubmitted(true);
    if (saving || validateDocument(input).length > 0) return false;
    setSaving(true);
    try {
      await repository.save(
        buildDocument(
          input,
          { id: existing.id, tripId: existing.trip_id, userId: existing.owner_id },
          existing,
        ),
      );
      return true;
    } finally {
      setSaving(false);
    }
  };

  const remove = () => repository.remove(existing);

  return { input, update, errors, saving, save, remove, reset };
}
