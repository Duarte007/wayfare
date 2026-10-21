import {
  CHECKLIST_TEMPLATE_KEYS,
  checklistItemSchema,
  checklistSuggestions,
  type ChecklistItem,
} from '@wayfare/shared';
import { resources, SUPPORTED_LOCALES } from '@wayfare/i18n';
import { describe, expect, it } from 'vitest';
import {
  buildChecklistItem,
  buildSuggestedItems,
  checklistItemToInput,
  checklistProgress,
  dueStatus,
  emptyChecklistInput,
  groupChecklist,
  nextPosition,
  pendingSuggestions,
  suggestionDueDate,
  tripCountries,
  validateChecklistItem,
} from './checklist';

const item = (patch: Partial<ChecklistItem>): ChecklistItem => ({
  id: crypto.randomUUID(),
  trip_id: 't1',
  group_key: 'documents',
  title: 'x',
  done: false,
  position: 0,
  visibility: 'group',
  assignees: [],
  ...patch,
});

describe('checklist items', () => {
  it('requires a title and builds a server-valid row', () => {
    const [u1, u2] = [crypto.randomUUID(), crypto.randomUUID()].sort();
    expect(validateChecklistItem(emptyChecklistInput())).toEqual(['title_required']);
    const built = buildChecklistItem(
      {
        title: '  Book transfer ',
        group: 'tech',
        dueDate: '2027-04-20',
        assignees: [u2!, u1!, u2!],
        shared: true,
      },
      { id: crypto.randomUUID(), tripId: crypto.randomUUID(), createdBy: u1!, position: 3 },
    );
    expect(built).toMatchObject({
      title: 'Book transfer',
      group_key: 'tech',
      due_date: '2027-04-20',
      assignees: [u1, u2],
      visibility: 'group',
      done: false,
      template_key: null,
      position: 3,
      created_by: u1,
    });
    expect(() => checklistItemSchema.parse(built)).not.toThrow();
  });

  it('keeps who made it, its place, tick and template when edited; private drops assignees', () => {
    const existing = item({
      created_by: 'u9',
      position: 7,
      done: true,
      template_key: 'travel_insurance',
      assignees: ['u2'],
    });
    const edited = buildChecklistItem(
      { ...checklistItemToInput(existing), title: 'Insurance', shared: false },
      { id: existing.id, tripId: 't1', createdBy: 'u1', position: 99 },
      existing,
    );
    expect(edited).toMatchObject({
      created_by: 'u9',
      position: 7,
      done: true,
      template_key: 'travel_insurance',
      visibility: 'private',
      assignees: [],
    });
  });

  it('flags overdue and soon open items only', () => {
    const today = '2027-05-10';
    expect(dueStatus({ done: false, due_date: '2027-05-09' }, today)).toBe('overdue');
    expect(dueStatus({ done: false, due_date: '2027-05-17' }, today)).toBe('soon');
    expect(dueStatus({ done: false, due_date: '2027-05-18' }, today)).toBeNull();
    expect(dueStatus({ done: true, due_date: '2027-05-01' }, today)).toBeNull();
    expect(dueStatus({ done: false, due_date: null }, today)).toBeNull();
  });

  it('groups in a fixed order, open items first, unknown groups under other', () => {
    const sections = groupChecklist([
      item({ title: 'b', group_key: 'money', done: true }),
      item({ title: 'a', group_key: 'money', due_date: '2027-01-01' }),
      item({ title: 'c', group_key: 'documents' }),
      item({ title: 'd', group_key: 'from-the-future' }),
    ]);
    expect(sections.map((s) => [s.group, s.items.map((i) => i.title)])).toEqual([
      ['documents', ['c']],
      ['money', ['a', 'b']],
      ['other', ['d']],
    ]);
    expect(checklistProgress(sections.flatMap((s) => s.items))).toEqual({ done: 1, total: 4 });
    expect(nextPosition([item({ position: 4 }), item({ position: 1 })])).toBe(5);
  });
});

describe('suggestions', () => {
  it('takes countries from the cities, not from orphan places', () => {
    expect(
      tripCountries(
        [
          { id: 'p1', country_code: 'jp' },
          { id: 'p2', country_code: 'JP' },
          { id: 'p3', country_code: 'US' },
        ],
        [{ place_id: 'p1' }, { place_id: 'p2' }],
      ),
    ).toEqual(['JP']);
  });

  it('offers everything for an empty list, quietly once a template is used, loudly for a new country', () => {
    const empty = pendingSuggestions(['JP'], []);
    expect(empty.prominent).toBe(true);
    expect(empty.items.map((s) => s.key)).toContain('jp_ic_card');

    // Base and Japan used; one Japan item removed later: offered, but not pushed.
    const used = checklistSuggestions(['JP'])
      .filter((s) => s.key !== 'jp_cash')
      .map((s) => item({ template_key: s.key }));
    const quiet = pendingSuggestions(['JP'], used);
    expect(quiet).toEqual({
      items: [expect.objectContaining({ key: 'jp_cash' })],
      prominent: false,
    });

    // A city in another country added afterwards.
    const later = pendingSuggestions(['JP', 'US'], used);
    expect(later.prominent).toBe(true);
    expect(later.items.map((s) => s.key)).toEqual(['jp_cash', 'us_esta', 'us_health_costs']);
  });

  it('dates template items before the start, never in the past or after it', () => {
    const s = { dueDaysBefore: 30 };
    expect(suggestionDueDate(s, '2027-06-30', '2027-01-01')).toBe('2027-05-31');
    expect(suggestionDueDate(s, '2027-06-30', '2027-06-20')).toBe('2027-06-20');
    expect(suggestionDueDate(s, '2027-06-30', '2027-07-05')).toBeNull();
    expect(suggestionDueDate({}, '2027-06-30', '2027-01-01')).toBeNull();
  });

  it('stores the translated title and the template key, and never adds one twice', () => {
    const [passport, insurance] = checklistSuggestions([]);
    let n = 0;
    const built = buildSuggestedItems(
      [
        { ...passport!, title: 'Passaporte válido' },
        { ...insurance!, title: 'Seguro' },
      ],
      {
        tripId: 't1',
        tripStart: '2027-06-30',
        today: '2027-01-01',
        createdBy: 'u1',
        existing: [item({ template_key: insurance!.key, position: 2 })],
        newId: () => `id-${n++}`,
      },
    );
    expect(built).toEqual([
      expect.objectContaining({
        id: 'id-0',
        title: 'Passaporte válido',
        template_key: passport!.key,
        group_key: passport!.group,
        position: 3,
        due_date: '2027-05-01',
        done: false,
        created_by: 'u1',
        visibility: 'group',
      }),
    ]);
  });

  it('has a title for every template item in every language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const templates = resources[locale].checklist.templates as Record<string, string>;
      for (const key of CHECKLIST_TEMPLATE_KEYS)
        expect(templates[key], `${locale} ${key}`).toBeTruthy();
    }
  });
});
