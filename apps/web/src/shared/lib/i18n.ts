import { matchLocale, resources, SUPPORTED_LOCALES, type SupportedLocale } from '@wayfare/i18n';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { readPref, writePref } from './storage';

const LOCALE_KEY = 'wayfare.locale';

function initialLocale(): SupportedLocale {
  const saved = readPref(LOCALE_KEY);
  if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved))
    return saved as SupportedLocale;
  return matchLocale(typeof navigator === 'undefined' ? [] : navigator.languages);
}

/** Chinese and Japanese share characters drawn differently; `lang` picks the right font. */
function applyLang(locale: string) {
  document.documentElement.lang = locale;
}

void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources: Object.fromEntries(Object.entries(resources).map(([l, msgs]) => [l, msgs])),
    lng: initialLocale(),
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

export default i18n;
