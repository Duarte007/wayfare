import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@wayfare/i18n';
import { Globe } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

/** `compact` sits in a corner (sign-in); `field` is a full-width control with a visible label. */
export function LanguageSelect({ variant = 'compact' }: { variant?: 'compact' | 'field' }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const field = variant === 'field';
  return (
    <div className={field ? 'grid gap-2' : undefined}>
      <Label htmlFor={id} className={field ? undefined : 'sr-only'}>
        {t('language')}
      </Label>
      <Select value={i18n.language} onValueChange={(lng) => void i18n.changeLanguage(lng)}>
        <SelectTrigger id={id} className={cn(field ? 'w-full text-base' : 'bg-card/80')}>
          <Globe className="text-muted-foreground" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align={field ? 'start' : 'end'}>
          {SUPPORTED_LOCALES.map((l) => (
            <SelectItem key={l} value={l} lang={l}>
              {LOCALE_NAMES[l]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
