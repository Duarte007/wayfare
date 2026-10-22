import { resources } from '@wayfare/i18n/resources';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import i18n, { changeLocale, i18nReady } from './i18n';

describe('i18n', () => {
  beforeAll(() => i18nReady);
  afterAll(() => changeLocale('en'));

  it('starts with only the active locale loaded', () => {
    expect(i18n.language).toBe('en');
    expect(i18n.t('loading')).toBe(resources.en.common.loading);
    expect(i18n.hasResourceBundle('ja', 'common')).toBe(false);
  });

  it('loads another locale before switching to it', async () => {
    await changeLocale('ja');
    expect(i18n.language).toBe('ja');
    expect(i18n.t('loading')).toBe(resources.ja.common.loading);
    expect(i18n.t('title', { ns: 'checklist' })).toBe(resources.ja.checklist.title);
    expect(document.documentElement.lang).toBe('ja');
    expect(localStorage.getItem('wayfare.locale')).toBe('ja');
  });

  it('ignores a language the app does not ship', async () => {
    await changeLocale('ja');
    await changeLocale('xx');
    expect(i18n.language).toBe('ja');
  });
});
