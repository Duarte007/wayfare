import type { LucideIcon } from 'lucide-react';
import { Route } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { labelFor, type LinkTarget } from '../domain/document-link';
import { LABEL_ICONS } from './document-display';

/** "Hotel Lotus · Beijing", "Beijing → Shanghai · Train G1", "Great Wall tour · Beijing". */
export function useTargetName(): (target: LinkTarget) => string {
  const { t } = useTranslation('trips');
  return useCallback(
    (target: LinkTarget) => {
      if (target.type !== 'leg') return `${target.name} · ${target.city}`;
      const how = [t(`mode_${target.mode}`), target.service].filter(Boolean).join(' ');
      return `${target.from} → ${target.to} · ${how}`;
    },
    [t],
  );
}

export function targetIcon(target: LinkTarget): LucideIcon {
  const label = labelFor(target);
  return target.type === 'leg' && label === 'other' ? Route : LABEL_ICONS[label];
}
