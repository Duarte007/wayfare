import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@wayfare/i18n';
import { useTranslation } from 'react-i18next';

export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <span>{t('language')}</span>
      <select
        className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
        value={i18n.language}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
