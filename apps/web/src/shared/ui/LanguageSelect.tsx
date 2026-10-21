import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@wayfare/i18n';
import { ChevronDown, Globe } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const id = useId();
  return (
    <div className="inline-flex items-center gap-2 text-sm text-muted">
      <Globe className="size-4" aria-hidden />
      <label htmlFor={id} className="sr-only">
        {t('language')}
      </label>
      <div className="relative">
        <select
          id={id}
          className="min-h-11 appearance-none rounded-xl border border-line bg-surface py-2 pr-9 pl-3 text-ink"
          value={i18n.language}
          onChange={(e) => void i18n.changeLanguage(e.target.value)}
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l} lang={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
          aria-hidden
        />
      </div>
    </div>
  );
}
