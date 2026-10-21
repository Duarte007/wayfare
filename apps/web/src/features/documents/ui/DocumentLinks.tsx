import type { TravelDocument } from '@wayfare/shared';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { useDocumentLinks } from '../application/useDocumentLinks';
import { LINK_GROUPS } from '../domain/document-link';
import { targetIcon, useTargetName } from './link-display';

const keyOf = (target: { type: string; id: string }) => `${target.type}:${target.id}`;

/** "Linked to": the stays, legs and activities this document is attached to, and a picker. */
export function DocumentLinks({ document }: { document: TravelDocument }) {
  const { t } = useTranslation('documentLinks');
  const links = useDocumentLinks(document);
  const nameOf = useTargetName();
  const ids = { heading: useId(), picker: useId() };
  // A new key empties the picker after each choice.
  const [pickerKey, setPickerKey] = useState(0);

  if (links.loading) return null;

  const onPick = (value: string) => {
    const target = links.available.find((a) => keyOf(a) === value);
    setPickerKey((k) => k + 1);
    if (target) void links.link(target);
  };

  return (
    <section aria-labelledby={ids.heading} className="grid gap-3">
      <div className="grid gap-0.5">
        <h3 id={ids.heading} className="font-semibold">
          {t('linkedTo')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('linkedHint')}</p>
      </div>
      {links.linked.length > 0 ? (
        <ul className="flex min-w-0 flex-wrap gap-2">
          {links.linked.map((target) => {
            const Icon = targetIcon(target);
            const name = nameOf(target);
            return (
              <li
                key={keyOf(target)}
                className="flex max-w-full min-w-0 items-center gap-1.5 rounded-full border bg-muted pl-3 text-sm"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground"
                  aria-label={t('unlinkNamed', { name })}
                  onClick={() => void links.unlink(target)}
                >
                  <X aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('notLinked')}</p>
      )}
      {links.available.length > 0 ? (
        <div className="grid gap-2">
          <Label id={ids.picker}>{t('addLink')}</Label>
          <Select key={pickerKey} onValueChange={onPick}>
            <SelectTrigger aria-labelledby={ids.picker} className="w-full min-w-0">
              <SelectValue placeholder={t('linkPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {LINK_GROUPS.map((group) => {
                const items = links.available.filter((a) => a.type === group);
                if (items.length === 0) return null;
                return (
                  <SelectGroup key={group}>
                    <SelectLabel>{t(`group_${group}`)}</SelectLabel>
                    {items.map((target) => {
                      const Icon = targetIcon(target);
                      return (
                        <SelectItem key={keyOf(target)} value={keyOf(target)}>
                          <Icon aria-hidden />
                          <span className="truncate">{nameOf(target)}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      ) : links.linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('nothingToLink')}</p>
      ) : null}
    </section>
  );
}
