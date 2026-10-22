// Plain value lists shared by the schemas, the API and the app. They live apart from schemas.ts so
// the web app can use them without pulling zod (~40 KB gzipped) into the screens that do not
// validate anything.

export const LOCALES = ['en', 'pt-BR', 'zh-CN', 'es', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export const TRANSPORT_MODES = ['flight', 'train', 'bus', 'ferry', 'car', 'other'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const DOCUMENT_LABELS = [
  'passport',
  'visa',
  'flight',
  'train',
  'bus_ferry',
  'stay',
  'insurance',
  'activity',
  'health',
  'money',
  'other',
] as const;
export type DocumentLabel = (typeof DOCUMENT_LABELS)[number];

/** Group trips: 'group' items are seen by every member, 'private' ones only by their creator. */
export const VISIBILITIES = ['group', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ENTITY_TYPES = ['stop', 'stay', 'leg', 'activity'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Checklist sections, in the order they are shown. Unknown keys from the server show as 'other'. */
export const CHECKLIST_GROUPS = [
  'documents',
  'money',
  'health',
  'tech',
  'packing',
  'other',
] as const;
export type ChecklistGroup = (typeof CHECKLIST_GROUPS)[number];
