import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type { LocalizedCalendarProps } from './LocalizedCalendar';

const LocalizedCalendar = lazy(() => import('./LocalizedCalendar'));

/** The date picker's calendar, fetched the first time a picker opens (precached for offline). */
export function LazyCalendar(props: LocalizedCalendarProps) {
  return (
    <Suspense
      fallback={
        <div className="grid h-80 w-80 place-items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      }
    >
      <LocalizedCalendar {...props} />
    </Suspense>
  );
}
