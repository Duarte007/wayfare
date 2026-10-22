import type { Messages } from './types.js';

export type { Messages };

export const SUPPORTED_LOCALES = ['en', 'pt-BR', 'zh-CN', 'es', 'ja'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

const LOADERS: Record<SupportedLocale, () => Promise<Messages>> = {
  en: () => import('./locales/en.js').then((m) => m.en),
  'pt-BR': () => import('./locales/pt-BR.js').then((m) => m.ptBR),
  'zh-CN': () => import('./locales/zh-CN.js').then((m) => m.zhCN),
  es: () => import('./locales/es.js').then((m) => m.es),
  ja: () => import('./locales/ja.js').then((m) => m.ja),
};

/**
 * One locale's messages, as its own chunk: the app downloads only the language in use. (The web
 * app's service worker precaches every chunk, so switching language still works offline.) For all
 * locales at once (tests, tooling), import `resources` from `@wayfare/i18n/resources`.
 */
export function loadMessages(locale: SupportedLocale): Promise<Messages> {
  return LOADERS[locale]();
}

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  'zh-CN': '简体中文',
  es: 'Español',
  ja: '日本語',
};

/** Picks the best supported locale from a list such as `navigator.languages`. */
export function matchLocale(preferred: readonly string[]): SupportedLocale {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === lower);
    if (exact) return exact;
    const base = lower.split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'zh') return 'zh-CN';
    const byBase = SUPPORTED_LOCALES.find((l) => l.split('-')[0] === base);
    if (byBase) return byBase;
  }
  return DEFAULT_LOCALE;
}
