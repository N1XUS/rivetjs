# @rivetjs/cdk/i18n
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Locale resolution, RTL detection, cached date formatters, localized string tables - minimal React Aria i18n subset for the date widgets.

## Entry points
- `./i18n` -> `index.ts`: `Locale` (`locale`, `direction`), `Direction`, `isRTL(locale)`, `getDefaultLocale()`, `LocaleContext`, `useLocale()`, `resolveLocale(locale?)`, `getDateFormatter(locale, opts)` (cached `DateFormatter`), `LocalizedStrings`, `getStringsForLocale(strings, locale, default="en-US")`, `formatString(template, vars)`
- `./i18n/filter` -> `filter.ts`: `createFilter(options?, locale?)` -> `{ startsWith, endsWith, contains }` (RA useFilter), `getCollator(locale, options?)` (RA useCollator, cached per locale + sorted options)
- `./i18n/list-formatter` -> `list-formatter.ts`: `listFormatter(locale, options?)` cached `Intl.ListFormat` (RA useListFormatter; via `cachedIntl`)
- `./i18n/intl-cache` -> `intl-cache.ts`: `cachedIntl(ctor, locale, options?)` shared `Intl.*` instance cache (Rivet; key = ctor + locale + sorted `key=value` options; per-ctor map cleared at 256). Users: `_adapters/intl.ts` (ICU NumberFormat + PluralRules), `calendar/behaviour.tsx` (DisplayNames, ListFormat), `select/select-value.tsx`, `slider/state.ts` (ListFormat unit), `compare/behaviour.ts` (percent `aria-valuetext`), ui `kpi`, `chart` `defaultFormat`, `utils/calendar.ts`. Never `new Intl.X(…)` / `toLocaleString(locale, options)` in render / binding / per-item paths (7–60 µs per construction vs 0.2 µs `format`; PERF-LIBS F7)
- `./i18n-provider` -> `i18n-provider.tsx`: `<I18nProvider locale>`, `I18nProviderProps`; re-exports `LocaleContext`, `useLocale`, `Locale`

## Layout
- `index.ts` - plain TS (no JSX); imports `../date/DateFormatter.ts`
- `i18n-provider.tsx` - Provider wrapper
- consumers: `calendar/`, `date-field/`, `state/{calendar,date-field,date-picker,date-intl}.ts`, `select/index.tsx`, `_adapters/intl.ts`, `*/intl.ts` (generated string tables)
- tests: `tests/i18n-filter.test.ts` (filter.ts, list-formatter.ts, intl-cache.ts; Rivet tests, upstream has none); otherwise covered via date widgets `tests-components/{calendar-keyboard,calendar-parts,calendar-state,date-picker-state}.test.ts`
- docs examples: `apps/cdk-docs/examples/{i18n-provider,i18n-strings}/`

## Upstream
- react-spectrum `@react-aria/i18n` (I18nProvider, useLocale, isRTL, useDateFormatter cache) + `@internationalized/string` (LocalizedStringDictionary locale matching, `{name}` interpolation) (Apache-2.0)
- `filter.ts` / `list-formatter.ts`: RA useFilter / useCollator / useListFormatter; hooks -> plain functions taking a locale string (returned closures are not serializable: keep the locale in state, call `createFilter` in handlers)
- Rivet differences (header): default locale = `<html lang>` then `navigator.language`, server `en-US` (upstream: `navigator.language`); locale resolved during server render and stored as string in widget state; `I18nProvider` in separate JSX subpath; strings are plain `{name}` templates (upstream compiles JSON to functions)

## Rules / invariants
- components never run in the browser on resumed pages: resolve the locale at render, store the string in state; `I18nProvider` matters for SSR + client-rendered subtrees only
- `I18nProvider` children: plain JSX (lazy slot, `renderSlot`) or `{() => <Page/>}`
- `getStringsForLocale` fallback order: exact, language-script, language, any region of the language, `defaultLocale`
- `getDateFormatter` cache cleared past 256 entries
- memoised per locale string (pure Intl data, bounded 256): `isRTL` (`Intl.Locale(…).maximize()`; DERIVED-C2 2026-10-21: no lookup for `LTR_LANGS` — languages CLDR writes left to right in every script / region — unless a script subtag is right to left, `maximize` ~1 ms at 1× on first use; `tests/i18n-direction.test.ts` checks the list against the lookup), `getDefaultLocale` validates with `Intl.getCanonicalLocales` (syntax only; `DateTimeFormat.supportedLocalesOf` loaded formatter data: 4–5 ms at 1× on a resumed page's first event; `state/date-field.ts` `getLocale` likewise), `getStringsForLocale`'s language / script parse; `getDefaultLocale` reads `<html lang>` / `navigator.language` every call and reuses the last string's validation + direction (fresh object per call). Select / ComboBox 300 mounts −13–14%, DatePicker −19% with the date memos (HOTPATH 2026-10-09)
- `*/intl.ts` tables are generated - do not edit by hand
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk-components libs/cdk/tests-components/calendar-state.test.ts libs/cdk/tests-components/date-picker-state.test.ts`

## Gotchas
- `Direction` type re-exported from `../collections/types.ts`; `isRTL` (Intl.Locale textInfo) and `../bidi` `isRtlLocale` (regex) are separate implementations
- no unit tests for `getStringsForLocale` / `formatString`; `isRTL` fast path + `getDefaultLocale` fallback: `tests/i18n-direction.test.ts`

## See also
- [../CLAUDE.md](../CLAUDE.md), [../bidi/CLAUDE.md](../bidi/CLAUDE.md)
- `apps/cdk-docs/content/foundations/i18n.md`, `docs/guides/i18n.md`
