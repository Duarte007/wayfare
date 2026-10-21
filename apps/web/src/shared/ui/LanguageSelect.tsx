import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@wayfare/i18n';
import { ChevronDown, Globe } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/** `compact` sits in a corner (sign-in); `field` is a full-width control with a visible label. */
export function LanguageSelect({ variant = 'compact' }: { variant?: 'compact' | 'field' }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const field = variant === 'field';
  return (
    <div className={field ? 'grid gap-1.5' : 'inline-flex items-center gap-2 text-sm text-muted'}>
      {field ? null : <Globe className="size-4" aria-hidden />}
      <label htmlFor={id} className={field ? 'text-sm font-semibold' : 'sr-only'}>
        {t('language')}
      </label>
      <div className="relative">
        {field ? (
          <Globe
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
            aria-hidden
          />
        ) : null}
        <select
          id={id}
          className={`appearance-none border border-line bg-surface text-ink ${
            field
              ? 'min-h-12 w-full rounded-2xl py-3 pr-10 pl-12 text-base'
              : 'min-h-11 rounded-xl py-2 pr-9 pl-3'
          }`}
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
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>
    </div>
  );
}
