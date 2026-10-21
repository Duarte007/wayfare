import { useState } from 'react';
import { readPref, writePref } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

const THEME_KEY = 'wayfare.theme';

export function readTheme(): ThemePreference {
  const saved = readPref(THEME_KEY);
  return THEME_PREFERENCES.includes(saved as ThemePreference)
    ? (saved as ThemePreference)
    : 'system';
}

/** `system` follows the device; the tokens in styles.css react to `data-theme`. */
export function applyTheme(theme: ThemePreference, root: HTMLElement = document.documentElement) {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
}

export function useTheme(): [ThemePreference, (theme: ThemePreference) => void] {
  const [theme, setTheme] = useState(readTheme);
  const update = (next: ThemePreference) => {
    applyTheme(next);
    writePref(THEME_KEY, next);
    setTheme(next);
  };
  return [theme, update];
}
