import { CHECKLIST_GROUPS, type ChecklistSuggestion } from '@wayfare/shared';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { useAddSuggestions, type ChecklistView } from '../application/useChecklist';

/** Preview of the template items for the trip's destinations; the user picks what to add. */
export function SuggestionsDialog({ view, trigger }: { view: ChecklistView; trigger: ReactNode }) {
  const { t } = useTranslation('checklist');
  const { t: tc } = useTranslation();
  const suggestions = view.suggestions.items;
  const addSuggestions = useAddSuggestions(view);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const idPrefix = useId();

  const toggle = (key: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (picked.size === 0 || saving) return;
    setSaving(true);
    try {
      await addSuggestions(
        suggestions
          .filter((s) => picked.has(s.key))
          .map((s) => ({ ...s, title: t(`templates.${s.key}`) })),
      );
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const sections = CHECKLIST_GROUPS.map((group) => ({
    group,
    items: suggestions.filter((s) => s.group === group),
  })).filter((s) => s.items.length > 0);

  const row = (s: ChecklistSuggestion) => {
    const id = `${idPrefix}-${s.key}`;
    return (
      <li key={s.key} className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center">
          <Checkbox
            id={id}
            checked={picked.has(s.key)}
            onCheckedChange={(on) => toggle(s.key, on === true)}
            aria-describedby={s.dueDaysBefore !== undefined ? `${id}-due` : undefined}
          />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5 py-2.5">
          <label htmlFor={id} className="cursor-pointer text-sm leading-snug font-medium">
            {t(`templates.${s.key}`)}
          </label>
          {s.dueDaysBefore !== undefined ? (
            <span id={`${id}-due`} className="text-xs text-muted-foreground">
              {t('daysBefore', { count: s.dueDaysBefore })}
            </span>
          ) : null}
        </span>
      </li>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Everything starts picked: the list is already filtered to what's missing.
        if (next) setPicked(new Set(suggestions.map((s) => s.key)));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('suggestTitle')}</DialogTitle>
          <DialogDescription>{t('suggestHint')}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid min-w-0 gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPicked(new Set(suggestions.map((s) => s.key)))}
            >
              {t('selectAll')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPicked(new Set())}>
              {t('selectNone')}
            </Button>
          </div>
          {sections.map((section) => (
            <fieldset key={section.group} className="grid min-w-0 gap-1">
              <legend className="mb-1 text-sm font-bold text-muted-foreground">
                {t(`groups.${section.group}`)}
              </legend>
              <ul className="grid gap-0.5">{section.items.map(row)}</ul>
            </fieldset>
          ))}
          <DialogFooter>
            <Button type="submit" size="lg" disabled={picked.size === 0 || saving}>
              {t('suggestAdd', { count: picked.size })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
