import type { TravelDocument } from '@wayfare/shared';
import { useMemo } from 'react';
import { useTripDetails } from '../../trips/application/useTripDetails';
import {
  buildLink,
  documentsLinkedTo,
  linkCounts,
  linkTargets,
  targetsOf,
  type LinkEntity,
} from '../domain/document-link';
import { useDocumentsDependencies } from './DocumentsProvider';

/**
 * What a document is attached to, and what else in the trip it could be attached to. Links are
 * written on the device at once and queued for sync.
 */
export function useDocumentLinks(document: TravelDocument) {
  const { repository } = useDocumentsDependencies();
  const details = useTripDetails(document.trip_id);
  const targets = useMemo(() => (details ? linkTargets(details) : []), [details]);
  const linked = useMemo(
    () => targetsOf(document.id, details?.links ?? [], targets),
    [document.id, details, targets],
  );
  const available = targets.filter((t) => !linked.includes(t));

  return {
    loading: details === undefined,
    linked,
    available,
    link: (target: LinkEntity) => repository.link(buildLink(document.id, document.trip_id, target)),
    unlink: (target: LinkEntity) =>
      repository.unlink(buildLink(document.id, document.trip_id, target)),
  };
}

/**
 * The documents attached to one stay, leg or activity (only those on this device), and the
 * trip's other documents that can be attached to it.
 */
export function useEntityDocuments(tripId: string, entity: LinkEntity, locale?: string) {
  const { repository } = useDocumentsDependencies();
  const details = useTripDetails(tripId);
  const { type, id } = entity;

  const { linked, others } = useMemo(() => {
    const documents = details?.documents ?? [];
    const attached = documentsLinkedTo(documents, details?.links ?? [], { type, id }, locale);
    const ids = new Set(attached.map((d) => d.id));
    return {
      linked: attached,
      others: documents
        .filter((d) => !ids.has(d.id))
        .sort((a, b) => a.title.localeCompare(b.title, locale)),
    };
  }, [details, type, id, locale]);

  return {
    loading: details === undefined,
    linked,
    others,
    attach: (document: TravelDocument) => repository.link(buildLink(document.id, tripId, entity)),
    detach: (document: TravelDocument) => repository.unlink(buildLink(document.id, tripId, entity)),
  };
}

/** How many of the device's documents each stay, leg or activity has. */
export function useLinkCounts(details: {
  documents: readonly { id: string }[];
  links: Parameters<typeof linkCounts>[1];
}) {
  const counts = useMemo(
    () => linkCounts(details.documents, details.links),
    [details.documents, details.links],
  );
  return (entity: LinkEntity) => counts.get(`${entity.type}:${entity.id}`) ?? 0;
}
