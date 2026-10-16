// Ported from react-spectrum (react-aria src/i18n/useListFormatter.tsx), Apache-2.0, © Adobe.
//
// Localized list formatting ("A, B, and C") for SelectValue / ComboBoxValue.
// Rivet: `useListFormatter(options)` → `listFormatter(locale, options)`; the locale is an explicit
// string (resolved at render) and formatters are cached per locale + options (`intl-cache.ts`;
// upstream memoizes per component).

import { cachedIntl } from "./intl-cache.ts";

/** Cached `Intl.ListFormat` for `locale` + `options` (react-aria `useListFormatter`). */
export function listFormatter(locale: string, options?: Intl.ListFormatOptions): Intl.ListFormat {
  return cachedIntl(Intl.ListFormat, locale, options);
}
