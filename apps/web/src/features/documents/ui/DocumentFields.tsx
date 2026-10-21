import { DOCUMENT_LABELS, type DocumentLabel } from '@wayfare/shared';
import { Type } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { Field } from '@/shared/ui/ui';
import { DOCUMENT_TITLE_MAX, type DocumentError, type DocumentInput } from '../domain/document';
import { LABEL_ICONS } from './document-display';

/** Title, type (with quick choices when the suggestion was unsure) and sharing. */
export function DocumentFields({
  input,
  update,
  errors,
  alternatives = [],
  autoFocus,
}: {
  input: DocumentInput;
  update: (patch: Partial<DocumentInput>) => void;
  errors: DocumentError[];
  alternatives?: DocumentLabel[];
  autoFocus?: boolean;
}) {
  const { t } = useTranslation('documents');
  const { t: tl } = useTranslation('labels');
  const ids = { type: useId(), suggestions: useId(), shared: useId() };

  return (
    <>
      <Field
        label={t('docTitle')}
        icon={Type}
        placeholder={t('docTitlePlaceholder')}
        value={input.title}
        onChange={(e) => update({ title: e.target.value })}
        error={errors.includes('title_required') ? t('errorTitle') : undefined}
        maxLength={DOCUMENT_TITLE_MAX}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      <div className="grid gap-2">
        <Label id={ids.type}>{t('type')}</Label>
        <Select
          value={input.label}
          onValueChange={(label) => update({ label: label as DocumentLabel })}
        >
          <SelectTrigger aria-labelledby={ids.type} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_LABELS.map((label) => {
              const Icon = LABEL_ICONS[label];
              return (
                <SelectItem key={label} value={label}>
                  <Icon aria-hidden />
                  {tl(label)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {alternatives.length > 0 ? (
          <div className="grid gap-2" role="group" aria-labelledby={ids.suggestions}>
            <p id={ids.suggestions} className="text-sm text-muted-foreground">
              {t('suggestionsHint')} {t('suggestions')}
            </p>
            <div className="flex flex-wrap gap-2">
              {alternatives.map((label) => {
                const Icon = LABEL_ICONS[label];
                const selected = input.label === label;
                return (
                  <Button
                    key={label}
                    type="button"
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    aria-pressed={selected}
                    onClick={() => update({ label })}
                  >
                    <Icon aria-hidden />
                    {tl(label)}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
        <div className="grid gap-0.5">
          <Label htmlFor={ids.shared}>{t('shareWithGroup')}</Label>
          <p className="text-sm text-muted-foreground">
            {input.shared ? t('sharedHint') : t('privateHint')}
          </p>
        </div>
        <Switch
          id={ids.shared}
          checked={input.shared}
          onCheckedChange={(shared) => update({ shared })}
        />
      </div>
    </>
  );
}
