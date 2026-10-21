import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import { matchLocale, resources, SUPPORTED_LOCALES } from './index.js';

function flatten(obj: object, prefix = ''): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string'
      ? [[`${prefix}${k}`, v] as [string, string]]
      : flatten(v, `${prefix}${k}.`),
  );
}

describe('translations', () => {
  const enKeys = flatten(resources.en).map(([k]) => k);

  it.each(SUPPORTED_LOCALES)('%s has the same keys as English', (locale) => {
    expect(flatten(resources[locale]).map(([k]) => k)).toEqual(enKeys);
  });

  it.each(SUPPORTED_LOCALES)('%s messages are valid ICU and format', (locale) => {
    for (const [key, message] of flatten(resources[locale])) {
      const fmt = new IntlMessageFormat(message, locale);
      expect(
        () =>
          fmt.format({
            count: 2,
            city: 'X',
            from: 'A',
            to: 'B',
            email: 'e',
            name: 'n',
            leg: 'L',
            stay: 'S',
            day: 1,
            total: 2,
          }),
        key,
      ).not.toThrow();
    }
  });
});

describe('matchLocale', () => {
  it('maps browser languages to supported locales', () => {
    expect(matchLocale(['pt-PT'])).toBe('pt-BR');
    expect(matchLocale(['zh-TW', 'en'])).toBe('zh-CN');
    expect(matchLocale(['es-MX'])).toBe('es');
    expect(matchLocale(['ja-JP'])).toBe('ja');
    expect(matchLocale(['de-DE'])).toBe('en');
  });
});
