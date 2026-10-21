import { ArrowDown, ArrowUp, EllipsisVertical, Moon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import type { ItineraryStop, TripDetails } from '../../trips/domain/trip-overview';
import { useItineraryEditor } from '../application/useItineraryEditor';
import { NightsStepper } from './NightsStepper';

/** ⋮ menu of one city: change nights, move up/down, remove. */
export function CityActionsMenu({
  details,
  item,
  index,
  count,
}: {
  details: TripDetails;
  item: ItineraryStop;
  index: number;
  count: number;
}) {
  const { t } = useTranslation('itinerary');
  const { t: tc } = useTranslation();
  const editor = useItineraryEditor(details);
  const city = item.place?.name ?? '—';
  const [dialog, setDialog] = useState<'nights' | 'remove' | null>(null);
  const [nights, setNights] = useState(item.nights);

  return (
    <>
      {/* Non-modal: the page stays readable to screen readers while the menu is open. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('cityActions', { city })}>
            <EllipsisVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setNights(item.nights);
              setDialog('nights');
            }}
          >
            <Moon aria-hidden />
            {t('editNights')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === 0}
            onSelect={() => void editor.move(item.stop.id, -1)}
          >
            <ArrowUp aria-hidden />
            {t('moveUp')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === count - 1}
            onSelect={() => void editor.move(item.stop.id, 1)}
          >
            <ArrowDown aria-hidden />
            {t('moveDown')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog('remove')}>
            <Trash2 aria-hidden />
            {t('removeCity')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === 'nights'} onOpenChange={(open) => setDialog(open ? 'nights' : null)}>
        <DialogContent closeLabel={tc('close')}>
          <DialogHeader>
            <DialogTitle>{t('nightsIn', { city })}</DialogTitle>
          </DialogHeader>
          <NightsStepper value={nights} onChange={setNights} />
          <p className="text-sm text-muted-foreground">{t('nightsShiftHint')}</p>
          <DialogFooter>
            <Button
              size="lg"
              disabled={nights === item.nights}
              onClick={() =>
                void editor.setNights(item.stop.id, nights).then(() => setDialog(null))
              }
            >
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={dialog === 'remove'}
        onOpenChange={(open) => setDialog(open ? 'remove' : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeTitle', { city })}</AlertDialogTitle>
            <AlertDialogDescription>{t('removeBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void editor.remove(item.stop.id)}
            >
              <Trash2 aria-hidden />
              {t('remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
