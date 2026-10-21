import type { CSSProperties } from 'react';

// Spelled out so Tailwind sees every class; index = stop.color_index (0–7, see styles.css).
const FILLS = [
  'bg-city-0',
  'bg-city-1',
  'bg-city-2',
  'bg-city-3',
  'bg-city-4',
  'bg-city-5',
  'bg-city-6',
  'bg-city-7',
] as const;
const INKS = [
  'text-city-0-ink',
  'text-city-1-ink',
  'text-city-2-ink',
  'text-city-3-ink',
  'text-city-4-ink',
  'text-city-5-ink',
  'text-city-6-ink',
  'text-city-7-ink',
] as const;
const BORDERS = [
  'border-city-0-ink',
  'border-city-1-ink',
  'border-city-2-ink',
  'border-city-3-ink',
  'border-city-4-ink',
  'border-city-5-ink',
  'border-city-6-ink',
  'border-city-7-ink',
] as const;

const at = <T>(list: readonly T[], index: number): T => list[((index % 8) + 8) % 8]!;

export const cityFill = (colorIndex: number) => at(FILLS, colorIndex);
export const cityInk = (colorIndex: number) => at(INKS, colorIndex);
export const cityBorder = (colorIndex: number) => at(BORDERS, colorIndex);

/** A travel day is split corner to corner: the city you leave, then the one you reach. */
export function travelFill(from: number, to: number): CSSProperties {
  const v = (i: number) => `var(--city-${((i % 8) + 8) % 8})`;
  return { background: `linear-gradient(135deg, ${v(from)} 50%, ${v(to)} 50%)` };
}

/** Up to three letters of a city name, enough to tell cities apart next to the legend. */
export function shortName(name: string | undefined): string {
  return Array.from(name ?? '?')
    .slice(0, 3)
    .join('');
}
