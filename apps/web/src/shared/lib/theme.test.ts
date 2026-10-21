import { describe, expect, it } from 'vitest';
import { applyTheme, readTheme } from './theme';

describe('theme preference', () => {
  it('defaults to the device setting', () => {
    localStorage.clear();
    expect(readTheme()).toBe('system');
  });

  it('forces light or dark through data-theme and clears it for system', () => {
    const root = document.createElement('html');
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    applyTheme('system', root);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });
});
