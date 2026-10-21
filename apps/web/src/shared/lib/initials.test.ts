import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it.each([
    ['Ana Souza', null, 'AS'],
    ['Ana', null, 'A'],
    ['Maria da Silva Santos', null, 'MS'],
    [null, 'teste.dono@example.com', 'TD'],
    ['王小明', null, '王'],
    ['Ana (teste)', null, 'AT'],
    ['José Ñúñez', null, 'JÑ'],
    ['  ', 'bia@example.com', 'B'],
    [null, null, '?'],
  ])('%s / %s → %s', (name, email, expected) => {
    expect(initials(name, email)).toBe(expected);
  });
});
