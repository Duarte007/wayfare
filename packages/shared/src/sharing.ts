import type { Visibility } from './schemas.js';

export interface Shareable {
  created_by?: string | undefined;
  visibility: Visibility;
  assignees: readonly string[];
}

/**
 * Itinerary views for a group trip:
 * - 'group': the shared plan everyone follows (group items for everyone).
 * - a member id: that person's own itinerary (items assigned to them or everyone, plus
 *   their private items when the viewer is that person).
 */
export type ItineraryView = 'group' | { memberId: string };

export function inView<T extends Shareable>(
  item: T,
  view: ItineraryView,
  viewerId: string,
): boolean {
  if (item.visibility === 'private') {
    // Private items are only ever shown to their creator, in their own view.
    return item.created_by === viewerId && view !== 'group' && view.memberId === viewerId;
  }
  if (view === 'group') return item.assignees.length === 0;
  return item.assignees.length === 0 || item.assignees.includes(view.memberId);
}

export function filterView<T extends Shareable>(
  items: readonly T[],
  view: ItineraryView,
  viewerId: string,
): T[] {
  return items.filter((item) => inView(item, view, viewerId));
}

const PERSONAL_LABELS = new Set(['passport', 'visa', 'insurance', 'health', 'money']);

/** Suggested visibility for a new document: identity and health papers stay private. */
export function defaultDocumentVisibility(label: string): Visibility {
  return PERSONAL_LABELS.has(label) ? 'private' : 'group';
}
