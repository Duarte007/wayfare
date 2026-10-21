/**
 * Which "install the app" hint to show, if any:
 * - `prompt`: the browser offered an install prompt (`beforeinstallprompt`); a button opens it.
 * - `ios`: Safari on iPhone/iPad has no prompt; explain Share → Add to Home Screen.
 */
export type InstallHint = 'prompt' | 'ios' | null;

export interface InstallContext {
  /** Already running as an installed app (home screen, dock). */
  standalone: boolean;
  /** The browser fired `beforeinstallprompt` and the event is still usable. */
  canPrompt: boolean;
  iosSafari: boolean;
  /** The person closed the hint before. */
  dismissed: boolean;
}

export function chooseInstallHint({
  standalone,
  canPrompt,
  iosSafari,
  dismissed,
}: InstallContext): InstallHint {
  if (standalone || dismissed) return null;
  if (canPrompt) return 'prompt';
  if (iosSafari) return 'ios';
  return null;
}

export interface DeviceInfo {
  userAgent: string;
  /** iPadOS reports a Mac user agent; touch support tells them apart. */
  maxTouchPoints: number;
}

/** Safari on iOS/iPadOS: the only browser there where "Add to Home Screen" is reliably offered. */
export function isIosSafari({ userAgent, maxTouchPoints }: DeviceInfo): boolean {
  const iPhoneOrIPad =
    /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!iPhoneOrIPad) return false;
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|YaBrowser|DuckDuckGo/.test(userAgent);
  return /Safari\//.test(userAgent) && !otherBrowser;
}
