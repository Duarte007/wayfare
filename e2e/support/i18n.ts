import { resources, type SupportedLocale } from '@wayfare/i18n';

/**
 * A plain (no ICU parameters) app string in the project's locale, e.g. `msg('en', 'app.goToTrips')`.
 * Used by the specs that run in more than one language; the flow specs read pt-BR literally.
 */
export function msg(locale: string | undefined, key: string): string {
  const [ns, name] = key.split('.') as [string, string];
  const messages = resources[(locale ?? 'en') as SupportedLocale] as unknown as Record<
    string,
    Record<string, string>
  >;
  const value = messages[ns]?.[name];
  if (typeof value !== 'string') throw new Error(`no message ${key} for ${locale}`);
  return value;
}
