/**
 * Fonts and icons the map style uses, served from our own origin (`public/map`): no third-party
 * CDN, so labels also load in places that block them. Only Latin glyph ranges ship; Chinese,
 * Japanese and Korean labels are drawn with the device's own fonts (`localIdeographFontFamily`).
 */
export const MAP_FONTS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'] as const;
export const MAP_GLYPH_RANGES = ['0-255', '256-511', '8192-8447'] as const;
export const MAP_SPRITES = ['light', 'light@2x', 'dark', 'dark@2x'] as const;

/** Every asset file, as a path under the assets base URL. */
export function mapAssetPaths(): string[] {
  return [
    ...MAP_FONTS.flatMap((font) => MAP_GLYPH_RANGES.map((range) => `fonts/${font}/${range}.pbf`)),
    ...MAP_SPRITES.flatMap((sprite) => [`sprites/${sprite}.json`, `sprites/${sprite}.png`]),
  ];
}

/**
 * The file for a glyph request, or null when we don't ship it (an unknown font or a script the
 * device draws itself); the map then gets an empty glyph set instead of a failed request.
 */
export function glyphPath(fontstack: string, range: string): string | null {
  const font = fontstack
    .split(',')
    .map((f) => f.trim())
    .find((f) => (MAP_FONTS as readonly string[]).includes(f));
  if (!font || !(MAP_GLYPH_RANGES as readonly string[]).includes(range)) return null;
  return `fonts/${font}/${range}.pbf`;
}
