import type { ChecklistGroup } from './schemas.js';

/**
 * Starter checklists. Country-specific advice lives here, as data, never in the UI: adding a
 * destination means adding a template (and its titles in the `checklist.templates` i18n keys).
 */
export interface ChecklistTemplateItem {
  /** Stable id stored in `checklist_items.template_key`; also the i18n key `templates.<key>`. */
  key: string;
  group: ChecklistGroup;
  /** Due this many days before the trip starts; absent when it has no deadline. */
  dueDaysBefore?: number;
}

export interface ChecklistTemplate {
  /** 'base' for the list every trip gets, otherwise a region id such as an ISO country code. */
  id: string;
  /** ISO 3166-1 alpha-2 codes this template applies to; empty for the base list. */
  countries: readonly string[];
  items: readonly ChecklistTemplateItem[];
}

export const BASE_CHECKLIST: ChecklistTemplate = {
  id: 'base',
  countries: [],
  items: [
    { key: 'passport_validity', group: 'documents', dueDaysBefore: 60 },
    { key: 'entry_rules', group: 'documents', dueDaysBefore: 45 },
    { key: 'document_copies', group: 'documents', dueDaysBefore: 3 },
    { key: 'emergency_contacts', group: 'documents', dueDaysBefore: 3 },
    { key: 'travel_insurance', group: 'health', dueDaysBefore: 14 },
    { key: 'vaccines_medicines', group: 'health', dueDaysBefore: 30 },
    { key: 'cards_abroad', group: 'money', dueDaysBefore: 7 },
    { key: 'local_cash', group: 'money', dueDaysBefore: 2 },
    { key: 'phone_plan', group: 'tech', dueDaysBefore: 7 },
    { key: 'power_adapters', group: 'packing', dueDaysBefore: 3 },
  ],
};

/** Countries where the European travel authorisation (ETIAS) applies. */
const ETIAS_COUNTRIES = [
  'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IS',
  'IT', 'LI', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
] as const; // prettier-ignore

export const COUNTRY_CHECKLISTS: readonly ChecklistTemplate[] = [
  {
    id: 'CN',
    countries: ['CN'],
    items: [
      { key: 'cn_visa', group: 'documents', dueDaysBefore: 45 },
      { key: 'cn_payment_apps', group: 'money', dueDaysBefore: 14 },
      { key: 'cn_vpn', group: 'tech', dueDaysBefore: 7 },
      { key: 'cn_offline_maps', group: 'tech', dueDaysBefore: 3 },
      { key: 'cn_translation_app', group: 'tech', dueDaysBefore: 3 },
    ],
  },
  {
    id: 'JP',
    countries: ['JP'],
    items: [
      { key: 'jp_visit_japan_web', group: 'documents', dueDaysBefore: 3 },
      { key: 'jp_ic_card', group: 'money', dueDaysBefore: 3 },
      { key: 'jp_cash', group: 'money', dueDaysBefore: 2 },
      { key: 'jp_rail_pass', group: 'documents', dueDaysBefore: 21 },
    ],
  },
  {
    id: 'US',
    countries: ['US'],
    items: [
      { key: 'us_esta', group: 'documents', dueDaysBefore: 30 },
      { key: 'us_health_costs', group: 'health', dueDaysBefore: 14 },
    ],
  },
  {
    id: 'GB',
    countries: ['GB'],
    items: [{ key: 'gb_eta', group: 'documents', dueDaysBefore: 21 }],
  },
  {
    id: 'CA',
    countries: ['CA'],
    items: [{ key: 'ca_eta', group: 'documents', dueDaysBefore: 21 }],
  },
  {
    id: 'AU',
    countries: ['AU'],
    items: [{ key: 'au_eta', group: 'documents', dueDaysBefore: 21 }],
  },
  {
    id: 'KR',
    countries: ['KR'],
    items: [{ key: 'kr_keta', group: 'documents', dueDaysBefore: 21 }],
  },
  {
    id: 'IN',
    countries: ['IN'],
    items: [{ key: 'in_evisa', group: 'documents', dueDaysBefore: 30 }],
  },
  {
    id: 'ETIAS',
    countries: ETIAS_COUNTRIES,
    items: [{ key: 'etias', group: 'documents', dueDaysBefore: 30 }],
  },
];

export const CHECKLIST_TEMPLATES: readonly ChecklistTemplate[] = [
  BASE_CHECKLIST,
  ...COUNTRY_CHECKLISTS,
];

export interface ChecklistSuggestion extends ChecklistTemplateItem {
  /** The template it comes from ('base' or a region id). */
  templateId: string;
}

/** The base list plus every template that applies to one of the trip's countries. */
export function checklistSuggestions(countryCodes: readonly string[]): ChecklistSuggestion[] {
  const countries = new Set(countryCodes.map((c) => c.toUpperCase()));
  const seen = new Set<string>();
  const suggestions: ChecklistSuggestion[] = [];
  for (const template of CHECKLIST_TEMPLATES) {
    const applies =
      template.countries.length === 0 || template.countries.some((c) => countries.has(c));
    if (!applies) continue;
    for (const item of template.items) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      suggestions.push({ ...item, templateId: template.id });
    }
  }
  return suggestions;
}

/** Which template a stored `template_key` came from; undefined for keys no template knows. */
export function checklistTemplateOf(templateKey: string): string | undefined {
  return CHECKLIST_TEMPLATES.find((t) => t.items.some((i) => i.key === templateKey))?.id;
}

/** Every template key, e.g. to check that each one has a title in every language. */
export const CHECKLIST_TEMPLATE_KEYS: readonly string[] = CHECKLIST_TEMPLATES.flatMap((t) =>
  t.items.map((i) => i.key),
);
