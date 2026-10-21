import {
  CONFIDENCE_THRESHOLD,
  DOCUMENT_LABELS,
  normalizeTitle,
  suggestLabel,
  suggestTitle,
  type DocumentLabel,
  type TravelDocument,
  type Visibility,
} from '@wayfare/shared';
import { storagePathFor } from './document-file';

export const DOCUMENT_TITLE_MAX = 200;

/** Per-user corrections learned from past uploads: file-name token -> label. */
export type LabelBoosts = Readonly<Record<string, DocumentLabel>>;

export interface DocumentInput {
  title: string;
  label: DocumentLabel;
  /** Documents are private unless the user chooses to share them with the group. */
  shared: boolean;
}

/** What the add dialog starts with: a suggested title and label from the file name. */
export interface DocumentDraft extends DocumentInput {
  suggestedLabel: DocumentLabel;
  confidence: number;
  /** Quick choices when the suggestion isn't confident (best first, never "other"). */
  alternatives: DocumentLabel[];
}

export type DocumentError = 'title_required';

export function draftFromFileName(fileName: string, boosts: LabelBoosts = {}): DocumentDraft {
  const suggestion = suggestLabel(fileName, { boosts });
  return {
    title: suggestTitle(fileName, suggestion.label).slice(0, DOCUMENT_TITLE_MAX),
    label: suggestion.label,
    shared: false,
    suggestedLabel: suggestion.label,
    confidence: suggestion.confidence,
    alternatives: suggestion.confidence < CONFIDENCE_THRESHOLD ? suggestion.alternatives : [],
  };
}

export function documentToInput(document: TravelDocument): DocumentInput {
  return {
    title: document.title,
    label: document.label,
    shared: document.visibility === 'group',
  };
}

export function validateDocument(input: DocumentInput): DocumentError[] {
  return input.title.trim() ? [] : ['title_required'];
}

export interface NewDocumentFile {
  mime: string;
  size: number;
}

/**
 * The documents row. New rows get their storage path from owner/trip/id (what the bucket's
 * policies check); an edit keeps the owner and path of `existing`.
 */
export function buildDocument(
  input: DocumentInput,
  context: {
    id: string;
    tripId: string;
    userId: string;
    file?: NewDocumentFile;
    /** The rules' suggestion, so the server knows whether the label came from the user. */
    suggestion?: { label: DocumentLabel; confidence: number };
  },
  existing?: TravelDocument,
): TravelDocument {
  const visibility: Visibility = input.shared ? 'group' : 'private';
  const title = input.title.trim().slice(0, DOCUMENT_TITLE_MAX);
  if (existing) {
    const relabelled = input.label !== existing.label;
    return {
      ...existing,
      title,
      label: input.label,
      visibility,
      ...(relabelled ? { label_source: 'user' as const, label_confidence: null } : {}),
    };
  }
  if (!context.file) throw new Error('A new document needs its file');
  const fromRules = context.suggestion?.label === input.label && input.label !== 'other';
  return {
    id: context.id,
    trip_id: context.tripId,
    owner_id: context.userId,
    created_by: context.userId,
    visibility,
    assignees: [],
    title,
    label: input.label,
    tags: [],
    mime: context.file.mime,
    size_bytes: context.file.size,
    storage_path: storagePathFor(context.userId, context.tripId, context.id),
    label_source: fromRules ? 'rules' : 'user',
    label_confidence: fromRules ? (context.suggestion?.confidence ?? null) : null,
  };
}

export interface DocumentFilter {
  query: string;
  /** null = every type. */
  label: DocumentLabel | null;
}

/**
 * Search over the title, tags and the label's name in the user's language (so "passaporte"
 * finds passports in Portuguese), ignoring case and accents.
 */
export function filterDocuments<T extends Pick<TravelDocument, 'title' | 'tags' | 'label'>>(
  documents: readonly T[],
  filter: DocumentFilter,
  labelName: (label: DocumentLabel) => string,
): T[] {
  const words = normalizeSearch(filter.query).split(' ').filter(Boolean);
  return documents.filter((document) => {
    if (filter.label && document.label !== filter.label) return false;
    if (words.length === 0) return true;
    const haystack = normalizeSearch(
      [document.title, ...document.tags, labelName(document.label)].join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });
}

function normalizeSearch(text: string): string {
  // normalizeTitle drops a trailing ".ext"; a search for "hotel.pdf" should still keep "pdf".
  return normalizeTitle(`${text}.xx`);
}

/** Grouped by type (in the app's label order), then by title. */
export function sortDocuments<T extends Pick<TravelDocument, 'title' | 'label'>>(
  documents: readonly T[],
  locale?: string,
): T[] {
  const order = (label: DocumentLabel) => DOCUMENT_LABELS.indexOf(label);
  return [...documents].sort(
    (a, b) => order(a.label) - order(b.label) || a.title.localeCompare(b.title, locale),
  );
}

/** Labels present in the list, in the app's order, for the filter. */
export function labelsIn(documents: readonly Pick<TravelDocument, 'label'>[]): DocumentLabel[] {
  const present = new Set(documents.map((d) => d.label));
  return DOCUMENT_LABELS.filter((label) => present.has(label));
}
