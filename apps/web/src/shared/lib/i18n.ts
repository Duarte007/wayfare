import { loadMessages, matchLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@wayfare/i18n';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { readPref, writePref } from './storage';

const LOCALE_KEY = 'wayfare.locale';

function isSupported(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

function initialLocale(): SupportedLocale {
  const saved = readPref(LOCALE_KEY);
  if (saved && isSupported(saved)) return saved;
  return matchLocale(typeof navigator === 'undefined' ? [] : navigator.languages);
}

/** Chinese and Japanese share characters drawn differently; `lang` picks the right font. */
function applyLang(locale: string) {
  document.documentElement.lang = locale;
}

/** Adds a locale's messages (its own chunk, precached by the service worker) if not loaded yet. */
async function ensureLocale(locale: SupportedLocale): Promise<void> {
  if (i18n.hasResourceBundle(locale, 'common')) return;
  const messages = await loadMessages(locale);
  for (const [ns, bundle] of Object.entries(messages)) {
    i18n.addResourceBundle(locale, ns, bundle, true, true);
  }
}

/** Switches the app language, loading its messages first so no screen flashes raw keys. */
export async function changeLocale(locale: string): Promise<void> {
  if (!isSupported(locale)) return;
  await ensureLocale(locale);
  await i18n.changeLanguage(locale);
}

/**
 * Resolves once the active locale's messages are in place. Only that locale is downloaded; every
 * locale's messages are complete (a test checks the keys), so the English fallback is not needed
 * up front.
 */
export const i18nReady: Promise<void> = (async () => {
  const locale = initialLocale();
  const messages = await loadMessages(locale);
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      resources: { [locale]: messages },
      lng: locale,
      fallbackLng: 'en',
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  applyLang(i18n.language);
  i18n.on('languageChanged', (lng) => {
    applyLang(lng);
    writePref(LOCALE_KEY, lng);
  });
})();

export default i18n;
