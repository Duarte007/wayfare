import { describe, expect, it } from 'vitest';
import { chooseInstallHint, isIosSafari } from './install-hint';

const base = { standalone: false, canPrompt: false, iosSafari: false, dismissed: false };

describe('chooseInstallHint', () => {
  it('offers the browser prompt when there is one', () => {
    expect(chooseInstallHint({ ...base, canPrompt: true })).toBe('prompt');
  });

  it('explains Add to Home Screen on iOS Safari', () => {
    expect(chooseInstallHint({ ...base, iosSafari: true })).toBe('ios');
  });

  it('shows nothing once installed, once dismissed, or when the browser cannot install', () => {
    expect(chooseInstallHint({ ...base, canPrompt: true, standalone: true })).toBeNull();
    expect(chooseInstallHint({ ...base, iosSafari: true, standalone: true })).toBeNull();
    expect(chooseInstallHint({ ...base, canPrompt: true, dismissed: true })).toBeNull();
    expect(chooseInstallHint(base)).toBeNull();
  });
});

describe('isIosSafari', () => {
  const iPhoneSafari =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

  it('recognises Safari on iPhone and on iPadOS (which reports a Mac)', () => {
    expect(isIosSafari({ userAgent: iPhoneSafari, maxTouchPoints: 5 })).toBe(true);
    const iPad =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
    expect(isIosSafari({ userAgent: iPad, maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafari({ userAgent: iPad, maxTouchPoints: 0 })).toBe(false);
  });

  it('ignores other iOS browsers and desktop or Android browsers', () => {
    const chromeIos = iPhoneSafari.replace('Version/18.0', 'CriOS/130.0');
    expect(isIosSafari({ userAgent: chromeIos, maxTouchPoints: 5 })).toBe(false);
    const android =
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
    expect(isIosSafari({ userAgent: android, maxTouchPoints: 5 })).toBe(false);
  });
});
