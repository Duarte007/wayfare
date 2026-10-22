import type { SupportedLocale } from './index.js';
import { en } from './locales/en.js';
import { es } from './locales/es.js';
import { ja } from './locales/ja.js';
import { ptBR } from './locales/pt-BR.js';
import { zhCN } from './locales/zh-CN.js';
import type { Messages } from './types.js';

/**
 * Every locale's messages in one object, for tests and tooling. The web app does not import this:
 * it loads only the active locale with `loadMessages`.
 */
export const resources: Record<SupportedLocale, Messages> = {
  en,
  'pt-BR': ptBR,
  'zh-CN': zhCN,
  es,
  ja,
};

export const NAMESPACES = Object.keys(en) as (keyof Messages)[];
