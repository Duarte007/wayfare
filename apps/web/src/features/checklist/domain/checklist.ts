import {
  addDays,
  CHECKLIST_GROUPS,
  checklistSuggestions,
  checklistTemplateOf,
  daysBetween,
  type ChecklistGroup,
  type ChecklistItem,
  type ChecklistSuggestion,
  type Place,
  type Stop,
  type Visibility,
} from '@wayfare/shared';

export interface ChecklistItemInput {
  title: string;
  group: ChecklistGroup;
  /** YYYY-MM-DD, or '' for no deadline. */
  dueDate: string;
  /** Members it is for; empty means everyone. */
  assignees: string[];
  shared: boolean;
}

export type ChecklistItemError = 'title_required';

export const CHECKLIST_TITLE_MAX = 200;

/** Items due within this many days count as "soon". */
export const DUE_SOON_DAYS = 7;

export function groupOf(item: Pick<ChecklistItem, 'group_key'>): ChecklistGroup {
  return (CHECKLIST_GROUPS as readonly string[]).includes(item.group_key)
    ? (item.group_key as ChecklistGroup)
    : 'other';
}

export function emptyChecklistInput(group: ChecklistGroup = 'other'): ChecklistItemInput {
  return { title: '', group, dueDate: '', assignees: [], shared: true };
}

export function checklistItemToInput(item: ChecklistItem): ChecklistItemInput {
  return {
    title: item.title,
    group: groupOf(item),
    dueDate: item.due_date ?? '',
    assignees: [...item.assignees],
    shared: item.visibility !== 'private',
  };
}

export function validateChecklistItem(input: ChecklistItemInput): ChecklistItemError[] {
  return input.title.trim() ? [] : ['title_required'];
}

/** Next free position: new items go to the end of the list. */
export function nextPosition(items: readonly Pick<ChecklistItem, 'position'>[]): number {
  return items.reduce((max, i) => Math.max(max, i.position + 1), 0);
}

export function buildChecklistItem(
  input: ChecklistItemInput,
  context: { id: string; tripId: string; createdBy: string; position: number },
  existing?: ChecklistItem,
): ChecklistItem {
  const visibility: Visibility = input.shared ? 'group' : 'private';
  return {
    ...(existing ?? { done: false, template_key: null }),
    id: context.id,
    trip_id: context.tripId,
    created_by: existing?.created_by ?? context.createdBy,
    position: existing?.position ?? context.position,
    title: input.title.trim().slice(0, CHECKLIST_TITLE_MAX),
    group_key: input.group,
    due_date: input.dueDate || null,
    // Private items are only for whoever added them.
    assignees: input.shared ? [...new Set(input.assignees)].sort() : [],
    visibility,
  };
}

export function setDone(item: ChecklistItem, done: boolean): ChecklistItem {
  return { ...item, done };
}

export type DueStatus = 'overdue' | 'soon' | null;

/** Open items past their day are overdue; those due within a week are soon. */
export function dueStatus(
  item: Pick<ChecklistItem, 'done' | 'due_date'>,
  today: string,
): DueStatus {
  if (item.done || !item.due_date) return null;
  const days = daysBetween(today, item.due_date);
  if (days < 0) return 'overdue';
  return days <= DUE_SOON_DAYS ? 'soon' : null;
}

export function checklistProgress(items: readonly Pick<ChecklistItem, 'done'>[]): {
  done: number;
  total: number;
} {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

export interface ChecklistSection {
  group: ChecklistGroup;
  items: ChecklistItem[];
}

/** Sections in a fixed order; inside one, open items first, then by due date and position. */
export function groupChecklist(items: readonly ChecklistItem[]): ChecklistSection[] {
  const sorted = [...items].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
      a.position - b.position ||
      a.title.localeCompare(b.title),
  );
  return CHECKLIST_GROUPS.map((group) => ({
    group,
    items: sorted.filter((i) => groupOf(i) === group),
  })).filter((s) => s.items.length > 0);
}

/** Destination countries: those of the trip's cities (places no city points at are left out). */
export function tripCountries(
  places: readonly Pick<Place, 'id' | 'country_code'>[],
  stops: readonly Pick<Stop, 'place_id'>[],
): string[] {
  const used = new Set(stops.map((s) => s.place_id));
  return [
    ...new Set(places.filter((p) => used.has(p.id)).map((p) => p.country_code.toUpperCase())),
  ];
}

export interface PendingSuggestions {
  /** Template items not on the list yet. */
  items: ChecklistSuggestion[];
  /**
   * True when the list is empty or a destination brings a template the list has nothing from
   * yet (a country added later): worth a prominent offer. Otherwise the offer stays quiet, so
   * items someone removed on purpose don't nag.
   */
  prominent: boolean;
}

export function pendingSuggestions(
  countries: readonly string[],
  items: readonly Pick<ChecklistItem, 'template_key'>[],
): PendingSuggestions {
  const existingKeys = new Set(items.map((i) => i.template_key).filter(Boolean) as string[]);
  const coveredTemplates = new Set(
    [...existingKeys].map((k) => checklistTemplateOf(k)).filter(Boolean),
  );
  const pending = checklistSuggestions(countries).filter((s) => !existingKeys.has(s.key));
  const prominent =
    pending.length > 0 &&
    (items.length === 0 || pending.some((s) => !coveredTemplates.has(s.templateId)));
  return { items: pending, prominent };
}

/**
 * Due date for a template item: `dueDaysBefore` the trip starts, but never before today (a
 * deadline already gone just means "now") and never after the start.
 */
export function suggestionDueDate(
  suggestion: Pick<ChecklistSuggestion, 'dueDaysBefore'>,
  tripStart: string,
  today: string,
): string | null {
  if (suggestion.dueDaysBefore === undefined) return null;
  const due = addDays(tripStart, -suggestion.dueDaysBefore);
  if (due >= today) return due;
  return today <= tripStart ? today : null;
}

/**
 * Items for the picked suggestions. `title` is already translated by the caller, so other
 * members read text even in another language; `template_key` stops it being added twice.
 */
export function buildSuggestedItems(
  picked: readonly (ChecklistSuggestion & { title: string })[],
  context: {
    tripId: string;
    tripStart: string;
    today: string;
    createdBy: string;
    existing: readonly ChecklistItem[];
    newId: () => string;
  },
): ChecklistItem[] {
  const taken = new Set(context.existing.map((i) => i.template_key).filter(Boolean));
  let position = nextPosition(context.existing);
  return picked
    .filter((s) => !taken.has(s.key))
    .map((s) => ({
      id: context.newId(),
      trip_id: context.tripId,
      created_by: context.createdBy,
      group_key: s.group,
      title: s.title.trim().slice(0, CHECKLIST_TITLE_MAX),
      done: false,
      due_date: suggestionDueDate(s, context.tripStart, context.today),
      template_key: s.key,
      position: position++,
      visibility: 'group' as const,
      assignees: [],
    }));
}
