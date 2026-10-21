import type { PlaceSuggestion } from '@wayfare/shared';
import { CalendarDays, CloudOff, Loader2, MapPin, Plus, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateRange } from '@/shared/lib/dates';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Field } from '@/shared/ui/ui';
import type { TripDetails } from '../../trips/domain/trip-overview';
import { useItineraryEditor } from '../application/useItineraryEditor';
import { usePlaceSearch } from '../application/usePlaceSearch';
import { NightsStepper } from './NightsStepper';

/** "Add city": search a place, choose the nights; dates follow from the cities before it. */
export function AddCityDialog({
  details,
  first = false,
}: {
  details: TripDetails;
  first?: boolean;
}) {
  const { t } = useTranslation('itinerary');
  const { t: tc } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);
  const [nights, setNights] = useState(3);
  const [saving, setSaving] = useState(false);
  const editor = useItineraryEditor(details);

  const reset = () => {
    setQuery('');
    setPlace(null);
    setNights(3);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!place) return;
    setSaving(true);
    try {
      await editor.addCity(place, nights);
      setOpen(false);
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={first ? 'default' : 'outline'} size={first ? 'lg' : 'default'}>
          <Plus aria-hidden />
          {first ? t('addFirstCity') : t('addCity')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('addCity')}</DialogTitle>
          <DialogDescription>{t('addCityHint')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-5">
          {place ? (
            <ChosenPlace place={place} onChange={() => setPlace(null)} />
          ) : (
            <PlacePicker query={query} onQuery={setQuery} onPick={setPlace} />
          )}
          {place ? (
            <>
              <NightsStepper value={nights} onChange={setNights} />
              <Preview details={details} preview={editor.previewAdd(nights)} />
            </>
          ) : null}
          <DialogFooter>
            <Button type="submit" size="lg" disabled={!place || saving}>
              {t('addCity')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlacePicker({
  query,
  onQuery,
  onPick,
}: {
  query: string;
  onQuery: (q: string) => void;
  onPick: (p: PlaceSuggestion) => void;
}) {
  const { t, i18n } = useTranslation('itinerary');
  const search = usePlaceSearch(query, i18n.language);
  return (
    <div className="grid gap-3">
      <Field
        label={t('searchCity')}
        icon={Search}
        placeholder={t('searchPlaceholder')}
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        autoComplete="off"
        autoFocus
        type="search"
      />
      <div aria-live="polite" className="grid gap-2">
        {search.status === 'loading' ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('searching')}
          </p>
        ) : search.status === 'offline' ? (
          <Alert variant="info">
            <CloudOff aria-hidden />
            <AlertDescription>{t('searchOffline')}</AlertDescription>
          </Alert>
        ) : search.status === 'error' ? (
          <Alert variant="destructive">
            <AlertDescription>{t('searchError')}</AlertDescription>
          </Alert>
        ) : search.status === 'done' && search.places.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noResults')}</p>
        ) : search.status === 'done' ? (
          <ul className="grid gap-1" aria-label={t('results')}>
            {search.places.map((p) => (
              <li key={`${p.lat},${p.lng}`}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
                  <PlaceLabel place={p} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function PlaceLabel({ place }: { place: PlaceSuggestion }) {
  return (
    <span className="grid min-w-0">
      <span className="truncate font-semibold">
        {place.name}
        {place.name_local ? (
          <span className="ml-2 font-normal text-muted-foreground" lang="und">
            {place.name_local}
          </span>
        ) : null}
      </span>
      <span className="truncate text-sm text-muted-foreground">
        {[place.region, place.country].filter(Boolean).join(', ')}
      </span>
    </span>
  );
}

function ChosenPlace({ place, onChange }: { place: PlaceSuggestion; onChange: () => void }) {
  const { t } = useTranslation('itinerary');
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-3 py-2">
      <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <PlaceLabel place={place} />
      </div>
      <Button variant="ghost" size="sm" onClick={onChange}>
        {t('change')}
      </Button>
    </div>
  );
}

function Preview({
  details,
  preview,
}: {
  details: TripDetails;
  preview: { start: string; end: string; newTripEnd: string | null };
}) {
  const { t, i18n } = useTranslation('itinerary');
  return (
    <div className="grid gap-1 text-sm">
      <p className="inline-flex items-center gap-2 font-medium">
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        {formatDateRange(preview.start, preview.end, i18n.language)}
      </p>
      {preview.newTripEnd ? (
        <p className="text-muted-foreground">
          {t('extendsTrip', {
            date: formatDateRange(preview.newTripEnd, preview.newTripEnd, i18n.language),
            trip: details.trip.name,
          })}
        </p>
      ) : null}
    </div>
  );
}
