import { describe, expect, it } from 'vitest';
import { formatDateRange, localToday } from './dates';

describe('formatDateRange', () => {
  it('formats in the user language without shifting days', () => {
    const en = formatDateRange('2027-04-03', '2027-04-12', 'en');
    expect(en).toMatch(/Apr/);
    expect(en).toMatch(/3/);
    expect(en).toMatch(/12/);
    expect(formatDateRange('2027-04-03', '2027-04-12', 'pt-BR')).toMatch(/abr/);
    // Japanese short dates are numeric: 2027/04/03～2027/04/12
    expect(formatDateRange('2027-04-03', '2027-04-12', 'ja')).toMatch(/2027\/04\/03/);
  });
});

describe('localToday', () => {
  it('uses the local calendar date', () => {
    expect(localToday(new Date(2027, 0, 5, 23, 30))).toBe('2027-01-05');
  });
});
