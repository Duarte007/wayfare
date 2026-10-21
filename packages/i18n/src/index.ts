import { en } from './locales/en.js';
import { es } from './locales/es.js';
import { ja } from './locales/ja.js';
import { ptBR } from './locales/pt-BR.js';
import { zhCN } from './locales/zh-CN.js';
import type { Messages } from './types.js';

export type { Messages };

export const SUPPORTED_LOCALES = ['en', 'pt-BR', 'zh-CN', 'es', 'ja'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const NAMESPACES = Object.keys(en) as (keyof Messages)[];

/** All translations are bundled so switching language works offline. */
export const resources: Record<SupportedLocale, Messages> = {
  en,
  'pt-BR': ptBR,
  'zh-CN': zhCN,
  es,
  ja,
};

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
