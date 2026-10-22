import { describe, expect, it } from 'vitest';
import {
  BASE_CHECKLIST,
  CHECKLIST_TEMPLATE_KEYS,
  checklistSuggestions,
  checklistTemplateOf,
} from './checklist-templates.js';
import { CHECKLIST_GROUPS } from './constants.js';
import { checklistItemSchema } from './schemas.js';

describe('checklist templates', () => {
  it('has unique keys that are valid i18n keys and known groups', () => {
    expect(new Set(CHECKLIST_TEMPLATE_KEYS).size).toBe(CHECKLIST_TEMPLATE_KEYS.length);
    for (const key of CHECKLIST_TEMPLATE_KEYS) expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(
      checklistSuggestions(['CN', 'JP', 'US', 'FR']).every((s) =>
        (CHECKLIST_GROUPS as readonly string[]).includes(s.group),
      ),
    ).toBe(true);
  });

  it('gives every trip the base list, even without countries', () => {
    expect(checklistSuggestions([]).map((s) => s.key)).toEqual(
      BASE_CHECKLIST.items.map((i) => i.key),
    );
  });

  it('adds the templates of the trip countries once, whatever the case', () => {
    const keys = checklistSuggestions(['cn', 'CN', 'PT', 'ES']).map((s) => s.key);
    expect(keys).toContain('cn_visa');
    expect(keys.filter((k) => k === 'etias')).toHaveLength(1);
    expect(keys).not.toContain('us_esta');
  });

  it('maps stored keys back to their template', () => {
    expect(checklistTemplateOf('etias')).toBe('ETIAS');
    expect(checklistTemplateOf('passport_validity')).toBe('base');
    expect(checklistTemplateOf('gone')).toBeUndefined();
  });

  it('parses a server row with defaults', () => {
    const row = checklistItemSchema.parse({
      id: '5f0c1c39-7f4e-4d2e-9a43-2b8d7f6a1e01',
      trip_id: '5f0c1c39-7f4e-4d2e-9a43-2b8d7f6a1e02',
      group_key: 'documents',
      title: 'Passport',
    });
    expect(row).toMatchObject({ done: false, position: 0, visibility: 'group', assignees: [] });
  });
});
