// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the design tokens: every text/background pair the UI uses must meet WCAG AA (4.5:1)
 * in both themes. Values are read from styles.css, so changing a color can't silently break it.
 */
const css = readFileSync(fileURLToPath(new URL('../../styles.css', import.meta.url)), 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
  );
}

const light = tokens(css.match(/@theme\s*{([^}]*)}/)![1]!);
const dark = tokens(css.match(/:root\[data-theme='dark'\]\s*{([^}]*)}/)![1]!);

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** [text token, background token] pairs used by components. */
const PAIRS: [string, string][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['on-accent', 'accent'],
  ['accent', 'accent-soft'],
  ['sky', 'sky-soft'],
  ['ink', 'sky-soft'],
  ['danger', 'surface'],
  ['bg', 'ink'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, theme) => {
  it.each(PAIRS)('%s on %s meets WCAG AA', (fg, bg) => {
    expect(theme[fg], fg).toBeDefined();
    expect(theme[bg], bg).toBeDefined();
    expect(contrast(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('browser chrome colors', () => {
  const read = (path: string) =>
    readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  const html = read('../../../index.html');
  const vite = read('../../../vite.config.ts');

  it('theme-color metas follow the bg token of each scheme', () => {
    expect(html).toContain(`content="${light.bg}" media="(prefers-color-scheme: light)"`);
    expect(html).toContain(`content="${dark.bg}" media="(prefers-color-scheme: dark)"`);
  });

  it('PWA manifest uses the light bg token', () => {
    expect(vite).toContain(`theme_color: '${light.bg}'`);
    expect(vite).toContain(`background_color: '${light.bg}'`);
  });
});

describe('focus style', () => {
  it('lives in the base layer so a field can show its ring on the wrapper, not the bare input', () => {
    const base = css.match(/@layer base\s*{([\s\S]*?)\n}/)?.[1] ?? '';
    expect(base).toContain(':focus-visible');
    expect(css.replace(/@layer base\s*{[\s\S]*?\n}/, '')).not.toMatch(/^:focus-visible/m);
  });
});
