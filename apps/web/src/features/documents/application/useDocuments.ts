import type { DocumentLabel } from '@wayfare/shared';
import { useEffect, useMemo, useState } from 'react';
import { filterDocuments, labelsIn, sortDocuments } from '../domain/document';
import type { DocumentEntry } from '../domain/document-ports';
import { useDocumentsDependencies } from './DocumentsProvider';

/** The trip's documents from the device; `undefined` while reading. */
export function useTripDocuments(tripId: string): DocumentEntry[] | undefined {
  const { repository } = useDocumentsDependencies();
  const [state, setState] = useState<{ tripId: string; entries: DocumentEntry[] }>();
  useEffect(
    () => repository.observeTrip(tripId, (entries) => setState({ tripId, entries })),
    [repository, tripId],
  );
  return state?.tripId === tripId ? state.entries : undefined;
}

/** The list with its search box and type filter. */
export function useDocumentList(
  tripId: string,
  labelName: (label: DocumentLabel) => string,
  locale?: string,
) {
  const entries = useTripDocuments(tripId);
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState<DocumentLabel | null>(null);

  const sorted = useMemo(() => {
    const byId = new Map((entries ?? []).map((e) => [e.document.id, e]));
    return sortDocuments(
      (entries ?? []).map((e) => e.document),
      locale,
    ).map((d) => byId.get(d.id)!);
  }, [entries, locale]);

  const visible = useMemo(() => {
    const matching = new Set(
      filterDocuments(
        sorted.map((e) => e.document),
        { query, label },
        labelName,
      ).map((d) => d.id),
    );
    return sorted.filter((e) => matching.has(e.document.id));
  }, [sorted, query, label, labelName]);

  // Only offer types that are on the list (plus the one picked, so it can be seen and cleared).
  const labels = useMemo(() => {
    const present = labelsIn(sorted.map((e) => e.document));
    return label && !present.includes(label) ? [...present, label] : present;
  }, [sorted, label]);

  return {
    loading: entries === undefined,
    total: sorted.length,
    entries: visible,
    labels,
    query,
    setQuery,
    label,
    setLabel,
  };
}
