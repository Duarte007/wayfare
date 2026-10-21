import { User, Users } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { isItineraryMode, type ItineraryMode } from '../domain/group';

/** "Mine / Everyone" above a group trip's itinerary. */
export function ItineraryModeSwitch({
  mode,
  onChange,
}: {
  mode: ItineraryMode;
  onChange: (mode: ItineraryMode) => void;
}) {
  const { t } = useTranslation('group');
  const hintId = useId();
  return (
    <div className="grid gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label={t('viewLabel')}
        aria-describedby={hintId}
        value={mode}
        // Radix sends '' when the active item is pressed again; keep one selected.
        onValueChange={(value) => isItineraryMode(value) && onChange(value)}
        className="grid w-full grid-cols-2 sm:w-fit"
      >
        <ToggleGroupItem value="mine" className="px-4">
          <User aria-hidden />
          {t('viewMine')}
        </ToggleGroupItem>
        <ToggleGroupItem value="everyone" className="px-4">
          <Users aria-hidden />
          {t('viewEveryone')}
        </ToggleGroupItem>
      </ToggleGroup>
      <p id={hintId} className="text-sm text-muted-foreground">
        {mode === 'mine' ? t('viewMineHint') : t('viewEveryoneHint')}
      </p>
    </div>
  );
}
