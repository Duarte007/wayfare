import { documentSchema, type TravelDocument } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import {
  buildDocument,
  documentToInput,
  draftFromFileName,
  filterDocuments,
  labelsIn,
  sortDocuments,
  validateDocument,
} from './document';

const ids = {
  doc: '0b4e7c1e-1d7e-4c55-9d2a-1f0f6f7f0001',
  trip: '0b4e7c1e-1d7e-4c55-9d2a-1f0f6f7f0002',
  user: '0b4e7c1e-1d7e-4c55-9d2a-1f0f6f7f0003',
};

function doc(patch: Partial<TravelDocument>): TravelDocument {
  return {
    id: crypto.randomUUID(),
    trip_id: ids.trip,
    owner_id: ids.user,
    visibility: 'private',
    assignees: [],
    title: 'Doc',
    label: 'other',
    tags: [],
    mime: 'application/pdf',
    size_bytes: 10,
    ...patch,
  };
}

describe('draftFromFileName', () => {
  it('suggests a flight with its number from a boarding pass', () => {
    const draft = draftFromFileName('boarding-pass-CA1234.pdf');
    expect(draft).toMatchObject({
      title: 'Flight CA1234',
      label: 'flight',
      suggestedLabel: 'flight',
      shared: false,
      alternatives: [],
    });
  });

  it('offers quick choices when it is unsure, and starts on "other"', () => {
    const draft = draftFromFileName('reserva.pdf');
    expect(draft.label).toBe('other');
    expect(draft.alternatives).toContain('stay');
  });

  it('uses what the user taught it', () => {
    expect(draftFromFileName('xyzcorp-confirmation.pdf').label).toBe('other');
    expect(draftFromFileName('xyzcorp-confirmation.pdf', { xyzcorp: 'insurance' }).label).toBe(
      'insurance',
    );
  });
});

describe('buildDocument', () => {
  it('builds a private, schema-valid row with the storage path from owner, trip and id', () => {
    const row = buildDocument(
      { title: '  Flight CA1234 ', label: 'flight', shared: false },
      {
        id: ids.doc,
        tripId: ids.trip,
        userId: ids.user,
        file: { mime: 'application/pdf', size: 2048 },
        suggestion: { label: 'flight', confidence: 0.9 },
      },
    );
    expect(documentSchema.parse(row)).toEqual(row);
    expect(row).toMatchObject({
      title: 'Flight CA1234',
      visibility: 'private',
      owner_id: ids.user,
      created_by: ids.user,
      storage_path: `${ids.user}/${ids.trip}/${ids.doc}`,
      label_source: 'rules',
      label_confidence: 0.9,
    });
  });

  it('marks a label the user picked, and shares when asked', () => {
    const row = buildDocument(
      { title: 'Hotel', label: 'stay', shared: true },
      {
        id: ids.doc,
        tripId: ids.trip,
        userId: ids.user,
        file: { mime: 'image/png', size: 1 },
        suggestion: { label: 'other', confidence: 0.2 },
      },
    );
    expect(row).toMatchObject({
      visibility: 'group',
      label_source: 'user',
      label_confidence: null,
    });
  });

  it('keeps owner and path on edit', () => {
    const existing = doc({ storage_path: 'a/b/c', label: 'flight', label_source: 'rules' });
    const row = buildDocument(
      { title: 'New', label: 'flight', shared: true },
      { id: existing.id, tripId: ids.trip, userId: 'someone-else' },
      existing,
    );
    expect(row).toMatchObject({
      title: 'New',
      owner_id: ids.user,
      storage_path: 'a/b/c',
      visibility: 'group',
      label_source: 'rules',
    });
    const relabelled = buildDocument(
      { ...documentToInput(existing), label: 'train' },
      { id: existing.id, tripId: ids.trip, userId: ids.user },
      existing,
    );
    expect(relabelled.label_source).toBe('user');
  });

  it('requires a title', () => {
    expect(validateDocument({ title: ' ', label: 'other', shared: false })).toEqual([
      'title_required',
    ]);
  });
});

describe('filterDocuments', () => {
  const names: Record<string, string> = {
    passport: 'Passaporte',
    flight: 'Voo',
    stay: 'Hospedagem',
  };
  const labelName = (label: string) => names[label] ?? label;
  const docs = [
    doc({ title: 'Passaporte Ana', label: 'passport' }),
    doc({ title: 'Flight CA1234', label: 'flight', tags: ['ida'] }),
    doc({ title: 'Hotel São Paulo', label: 'stay' }),
  ];

  it('matches title, tags and the label name, ignoring case and accents', () => {
    const titles = (query: string) =>
      filterDocuments(docs, { query, label: null }, labelName).map((d) => d.title);
    expect(titles('')).toHaveLength(3);
    expect(titles('sao paulo')).toEqual(['Hotel São Paulo']);
    expect(titles('IDA')).toEqual(['Flight CA1234']);
    expect(titles('voo')).toEqual(['Flight CA1234']);
    expect(titles('ana passaporte')).toEqual(['Passaporte Ana']);
    expect(titles('nothing')).toEqual([]);
  });

  it('filters by label', () => {
    expect(filterDocuments(docs, { query: '', label: 'stay' }, labelName)).toHaveLength(1);
    expect(filterDocuments(docs, { query: 'hotel', label: 'flight' }, labelName)).toEqual([]);
  });

  it('sorts by type then title, and lists the types present', () => {
    const sorted = sortDocuments([docs[2]!, docs[1]!, docs[0]!]).map((d) => d.label);
    expect(sorted).toEqual(['passport', 'flight', 'stay']);
    expect(labelsIn(docs)).toEqual(['passport', 'flight', 'stay']);
  });
});
