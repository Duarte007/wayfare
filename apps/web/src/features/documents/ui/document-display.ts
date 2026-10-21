import type { DocumentLabel } from '@wayfare/shared';
import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  BookUser,
  Bus,
  FileText,
  HeartPulse,
  Plane,
  ShieldCheck,
  Stamp,
  Ticket,
  TrainFront,
  Wallet,
} from 'lucide-react';

export const LABEL_ICONS: Record<DocumentLabel, LucideIcon> = {
  passport: BookUser,
  visa: Stamp,
  flight: Plane,
  train: TrainFront,
  bus_ferry: Bus,
  stay: BedDouble,
  insurance: ShieldCheck,
  activity: Ticket,
  health: HeartPulse,
  money: Wallet,
  other: FileText,
};

/** "820 KB", "3.4 MB", in the user's language. */
export function formatSize(bytes: number, locale: string): string {
  const [unit, value] =
    bytes >= 1024 * 1024
      ? (['megabyte', bytes / (1024 * 1024)] as const)
      : (['kilobyte', Math.max(1, bytes / 1024)] as const);
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: unit === 'megabyte' ? 1 : 0,
  }).format(value);
}
