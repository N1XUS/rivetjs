// Ported from react-spectrum (react-aria src/i18n/useFilter.ts, src/i18n/useCollator.ts), Apache-2.0, © Adobe.
//
// Locale-aware string filtering (startsWith / endsWith / contains over an `Intl.Collator` with
// `usage: "search"`), used by ComboBox, Autocomplete and searchable Select.
// Rivet:
// - `useFilter(options)` → `createFilter(options, locale)`; `useCollator(options)` → `getCollator(locale, options)`
//   (same module cache keyed by locale + sorted options). The locale is an explicit string (resolved
//   at render, `resolveLocale()`); omitted → the current locale (`useLocale()`, render time only).
// - The returned functions are plain closures: not serializable. Resumable code keeps the locale
//   string and calls `createFilter` inside handlers / bindings (the collator is cached).

import { resolveLocale } from "./index.ts";

export interface Filter {
  /** Returns whether a string starts with a given substring. */
  startsWith: (string: string, substring: string) => boolean;
  /** Returns whether a string ends with a given substring. */
  endsWith: (string: string, substring: string) => boolean;
  /** Returns whether a string contains a given substring. */
  contains: (string: string, substring: string) => boolean;
}

const cache = new Map<string, Intl.Collator>();

/** Cached `Intl.Collator` for `locale` + `options` (react-aria `useCollator`). */
export function getCollator(locale: string, options?: Intl.CollatorOptions): Intl.Collator {
  const cacheKey =
    locale +
    (options
      ? Object.entries(options)
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .join()
      : "");
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const collator = new Intl.Collator(locale, options);
  cache.set(cacheKey, collator);
  return collator;
}

/**
 * Provides localized string search functionality that is useful for filtering or matching items in
 * a list (react-aria `useFilter`). Options can be provided to adjust the sensitivity to case,
 * diacritics, and other parameters.
 */
export function createFilter(options?: Intl.CollatorOptions, locale?: string): Filter {
  const collator = getCollator(locale ?? resolveLocale(), { usage: "search", ...options });

  // TODO(later): these methods don't currently support the ignorePunctuation option.
  const startsWith = (string: string, substring: string): boolean => {
    if (substring.length === 0) return true;
    // Normalize both strings so we can slice safely
    string = string.normalize("NFC");
    substring = substring.normalize("NFC");
    return collator.compare(string.slice(0, substring.length), substring) === 0;
  };

  const endsWith = (string: string, substring: string): boolean => {
    if (substring.length === 0) return true;
    string = string.normalize("NFC");
    substring = substring.normalize("NFC");
    return collator.compare(string.slice(-substring.length), substring) === 0;
  };

  const contains = (string: string, substring: string): boolean => {
    if (substring.length === 0) return true;
    string = string.normalize("NFC");
    substring = substring.normalize("NFC");
    let scan = 0;
    const sliceLen = substring.length;
    for (; scan + sliceLen <= string.length; scan++) {
      const slice = string.slice(scan, scan + sliceLen);
      if (collator.compare(substring, slice) === 0) return true;
    }
    return false;
  };

  return { startsWith, endsWith, contains };
}
