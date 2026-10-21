import type { en } from './locales/en.js';

type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };

/** Shape every locale must match: same namespaces and keys as English, any string values. */
export type Messages = DeepStrings<typeof en>;
