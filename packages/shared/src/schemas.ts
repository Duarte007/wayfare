import { z } from 'zod';

/** Calendar date without time zone, e.g. "2026-10-23". */
export const isoDate = z.iso.date();

export const LOCALES = ['en', 'pt-BR', 'zh-CN', 'es', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const localeSchema = z.enum(LOCALES);

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
export const documentLabelSchema = z.enum(DOCUMENT_LABELS);

/** Group trips: 'group' items are seen by every member, 'private' ones only by their creator. */
export const VISIBILITIES = ['group', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Columns that let one trip hold both the shared plan and each member's own items. */
const sharingColumns = {
  created_by: z.uuid().optional(),
  visibility: z.enum(VISIBILITIES).default('group'),
  /** Members this item applies to; empty means everyone in the group. */
  assignees: z.array(z.uuid()).default([]),
};

const syncColumns = {
  id: z.uuid(),
  version: z.number().int().nonnegative().optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
};

export const placeSchema = z.object({
  ...syncColumns,
  trip_id: z.uuid(),
  name: z.string().min(1).max(200),
  name_local: z.string().max(200).nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  country_code: z.string().length(2),
  city: z.string().max(120).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  address_local: z.string().max(500).nullable().optional(),
});
export type Place = z.infer<typeof placeSchema>;

export const tripSchema = z
  .object({
    ...syncColumns,
    owner_id: z.uuid(),
    name: z.string().min(1).max(120),
    start_date: isoDate,
    end_date: isoDate,
  })
  .refine((t) => t.start_date <= t.end_date, { message: 'end_date must not be before start_date' });
export type Trip = z.infer<typeof tripSchema>;

export const stopSchema = z.object({
  ...syncColumns,
  ...sharingColumns,
  trip_id: z.uuid(),
  place_id: z.uuid(),
  /** First night in this city. */
  start_date: isoDate,
  /** Departure day (exclusive for nights). */
  end_date: isoDate,
  position: z.number().int().nonnegative(),
  color_index: z.number().int().min(0).max(7),
});
export type Stop = z.infer<typeof stopSchema>;

export const staySchema = z.object({
  ...syncColumns,
  ...sharingColumns,
  trip_id: z.uuid(),
  stop_id: z.uuid(),
  name: z.string().min(1).max(200),
  check_in: isoDate,
  check_out: isoDate,
  booking_ref: z.string().max(100).nullable().optional(),
  booking_url: z.url().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type Stay = z.infer<typeof staySchema>;

export const legSchema = z.object({
  ...syncColumns,
  ...sharingColumns,
  trip_id: z.uuid(),
  from_stop_id: z.uuid(),
  to_stop_id: z.uuid(),
  mode: z.enum(TRANSPORT_MODES),
  carrier: z.string().max(100).nullable().optional(),
  number: z.string().max(20).nullable().optional(),
  depart_at: z.iso.datetime({ offset: true }).nullable().optional(),
  depart_tz: z.string().max(64).nullable().optional(),
  arrive_at: z.iso.datetime({ offset: true }).nullable().optional(),
  arrive_tz: z.string().max(64).nullable().optional(),
  booking_ref: z.string().max(100).nullable().optional(),
});
export type Leg = z.infer<typeof legSchema>;

export const activitySchema = z.object({
  ...syncColumns,
  ...sharingColumns,
  trip_id: z.uuid(),
  stop_id: z.uuid(),
  title: z.string().min(1).max(200),
  date: isoDate.nullable().optional(),
  /** Local time in the city, "HH:mm" or "HH:mm:ss" as Postgres returns it. */
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
  needs_booking: z.boolean().default(false),
  booked: z.boolean().default(false),
  url: z.url().nullable().optional(),
  source: z.enum(['user', 'ai']).default('user'),
  notes: z.string().max(5000).nullable().optional(),
});
export type Activity = z.infer<typeof activitySchema>;

export const ENTITY_TYPES = ['stop', 'stay', 'leg', 'activity'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const documentSchema = z.object({
  ...syncColumns,
  ...sharingColumns,
  // Documents are personal unless shared: a passport scan should not reach the whole group.
  visibility: z.enum(VISIBILITIES).default('private'),
  trip_id: z.uuid(),
  owner_id: z.uuid(),
  title: z.string().min(1).max(200),
  label: documentLabelSchema,
  tags: z.array(z.string().max(40)).max(20).default([]),
  mime: z.string(),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024),
  storage_path: z.string().nullable().optional(),
  extracted_text: z.string().nullable().optional(),
  label_confidence: z.number().min(0).max(1).nullable().optional(),
  label_source: z.enum(['rules', 'user', 'ai']).nullable().optional(),
});
export type TravelDocument = z.infer<typeof documentSchema>;

export const documentLinkSchema = z.object({
  document_id: z.uuid(),
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.uuid(),
});
export type DocumentLink = z.infer<typeof documentLinkSchema>;

export const tripMemberSchema = z.object({
  trip_id: z.uuid(),
  user_id: z.uuid(),
  role: z.enum(MEMBER_ROLES),
});
export type TripMember = z.infer<typeof tripMemberSchema>;
