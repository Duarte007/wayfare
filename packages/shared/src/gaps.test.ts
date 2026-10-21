import { describe, expect, it } from 'vitest';
import { computeGaps } from './gaps.js';

const stops = [
  { id: 'bj', start_date: '2026-10-23', end_date: '2026-10-28', position: 0 },
  { id: 'cd', start_date: '2026-10-28', end_date: '2026-10-31', position: 1 },
];

describe('computeGaps', () => {
  it('reports uncovered nights, missing legs and missing documents', () => {
    const gaps = computeGaps({
      stops,
      stays: [{ id: 's1', stop_id: 'bj', check_in: '2026-10-23', check_out: '2026-10-26' }],
      legs: [],
      documents: [{ id: 'd1', label: 'passport' }],
      links: [],
    });
    expect(gaps).toEqual([
      { kind: 'missing_stay', stopId: 'bj', nights: ['2026-10-26', '2026-10-27'] },
      { kind: 'missing_stay', stopId: 'cd', nights: ['2026-10-28', '2026-10-29', '2026-10-30'] },
      { kind: 'missing_leg', fromStopId: 'bj', toStopId: 'cd' },
      { kind: 'stay_without_voucher', stayId: 's1' },
      { kind: 'missing_document', label: 'insurance' },
    ]);
  });

  it('is empty for a fully planned trip', () => {
    const gaps = computeGaps({
      stops,
      stays: [
        { id: 's1', stop_id: 'bj', check_in: '2026-10-23', check_out: '2026-10-28' },
        { id: 's2', stop_id: 'cd', check_in: '2026-10-28', check_out: '2026-10-31' },
      ],
      legs: [{ id: 'l1', from_stop_id: 'bj', to_stop_id: 'cd' }],
      documents: [
        { id: 'd1', label: 'passport' },
        { id: 'd2', label: 'insurance' },
      ],
      links: [
        { document_id: 'd3', entity_type: 'leg', entity_id: 'l1' },
        { document_id: 'd4', entity_type: 'stay', entity_id: 's1' },
        { document_id: 'd5', entity_type: 'stay', entity_id: 's2' },
      ],
    });
    expect(gaps).toEqual([]);
  });
});
