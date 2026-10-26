// Ported from react-spectrum (Apache-2.0, © Adobe): @react-aria/i18n (I18nProvider, useLocale,
// isRTL, useDateFormatter cache) and @internationalized/string (LocalizedStringDictionary locale
// matching, `{name}` interpolation). Minimal subset needed by the date widgets.
//
// Rivet differences:
// - Default locale: `<html lang>` in the browser (what @rivetjs/i18n writes for the page's locale),
//   then `navigator.language`; "en-US" on the server. React Aria defaults to `navigator.language`.
// - Components never run in the browser on resumed pages: the locale is resolved while rendering
//   on the server and stored (as a string) in widget state. `I18nProvider` therefore matters for
//   server rendering and client-rendered subtrees.
// - `I18nProvider` lives in `@rivetjs/cdk/i18n-provider` (JSX); this module is plain TypeScript.
// - Localized strings are plain `{name}` templates (react-aria compiles its JSON to functions).
import { createContext, useContext } from "@rivetjs/reactivity";
import { DateFormatter } from "../date/DateFormatter.ts";

export type { Direction } from "../collections/types.ts";
import type { Direction } from "../collections/types.ts";
export interface Locale {
  /** BCP 47 language tag, e.g. `en-US`. */
  locale: string;
  /** Writing direction of the locale. */
  direction: Direction;
}

// https://en.wikipedia.org/wiki/Right-to-left
const RTL_SCRIPTS = new Set(["Arab", "Syrc", "Samr", "Mand", "Thaa", "Mend", "Nkoo", "Adlm", "Rohg", "Hebr"]);
const RTL_LANGS = new Set(["ae", "ar", "arc", "bcc", "bqi", "ckb", "dv", "fa", "glk", "he", "ku", "mzn", "nqo", "pnb", "ps", "sd", "ug", "ur", "yi"]);

// Pure per locale string (Intl data): memoised, bounded. Widgets ask per instance and per segment
// (`new Intl.Locale(…).maximize()` ≈ 1–3 µs each: 7% of a Select mount, HOTPATH 2026-10-09).
const rtlCache = new Map<string, boolean>();
/** Whether `localeString` is written right to left. */
export function isRTL(localeString: string): boolean {
  let rtl = rtlCache.get(localeString);
  if (rtl === undefined) {
    if (rtlCache.size >= 256) rtlCache.clear();
    rtlCache.set(localeString, (rtl = computeRTL(localeString)));
  }
  return rtl;
}
// Languages CLDR writes left to right in every script and region it gives them: their direction needs no likely-subtags
// lookup (`maximize` costs ~1 ms at 1× on its first call — the first event of a resumed page pays it) unless a script
// subtag says otherwise.
const LTR_LANGS = new Set([
  "bg",
  "ca",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "fi",
  "fr",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "lt",
  "lv",
  "nb",
  "nl",
  "nn",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sr",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
  "zh",
]);
function computeRTL(localeString: string): boolean {
  const [lang, second] = localeString.split("-");
  if (LTR_LANGS.has(lang!.toLowerCase()) && (second?.length !== 4 || !RTL_SCRIPTS.has(second[0]!.toUpperCase() + second.slice(1).toLowerCase()))) return false;
  if (Intl.Locale) {
    const locale = new Intl.Locale(localeString).maximize() as Intl.Locale & {
      getTextInfo?: () => { direction: string };
      textInfo?: { direction: string };
    };
    const textInfo = typeof locale.getTextInfo === "function" ? locale.getTextInfo() : locale.textInfo;
    if (textInfo) return textInfo.direction === "rtl";
    if (locale.script) return RTL_SCRIPTS.has(locale.script);
  }
  return RTL_LANGS.has(localeString.split("-")[0]!);
}

/** Locale of the environment: browser `<html lang>`, then `navigator.language`; server `en-US`. */
export function getDefaultLocale(): Locale {
  const requested = (typeof document !== "undefined" && document.documentElement?.lang) || (typeof navigator !== "undefined" && navigator.language) || "en-US";
  // The environment is read on every call (`<html lang>` / `navigator.language` may change); the validation and
  // direction of one requested string are pure, so the last one is reused (a fresh object per call, as before).
  if (requested !== lastRequested) {
    let locale = requested;
    // Validation only (a malformed tag throws): `getCanonicalLocales` is syntax-only, `DateTimeFormat.supportedLocalesOf`
    // loads the formatter's locale data first (4–5 ms at 1× on the first call — the first event of a resumed page pays it).
    try {
      Intl.getCanonicalLocales(locale);
    } catch {
      locale = "en-US";
    }
    lastRequested = requested;
    lastLocale = locale;
    lastDirection = isRTL(locale) ? "rtl" : "ltr";
  }
  return { locale: lastLocale, direction: lastDirection };
}
let lastRequested: string | undefined,
  lastLocale = "en-US",
  lastDirection: Direction = "ltr";

/** Context carrying the current `Locale` (null: environment default). */
export const LocaleContext = createContext<Locale | null>(null);

/** Current locale: the nearest `I18nProvider`, else the environment default. */
export function useLocale(): Locale {
  return useContext(LocaleContext) ?? getDefaultLocale();
}

/** `locale` (when given) or the current one. */
export function resolveLocale(locale?: string | null): string {
  return locale || useLocale().locale;
}

const formatters = new Map<string, DateFormatter>();
/** Cached `DateFormatter` for `locale` + `options` (react-aria `useDateFormatter`). */
export function getDateFormatter(locale: string, options: Intl.DateTimeFormatOptions = {}): DateFormatter {
  const key = locale + JSON.stringify(options);
  let formatter = formatters.get(key);
  if (!formatter) {
    if (formatters.size > 256) formatters.clear();
    formatters.set(key, (formatter = new DateFormatter(locale, options)));
  }
  return formatter;
}

/** Localized string tables: locale → key → `{name}` template. */
export type LocalizedStrings<K extends string = string> = Record<string, Record<K, string>>;

// A locale table a production browser build trimmed to its languages (`@rivetjs/compiler` `locale-tables.ts`):
// `{ l: languages, f: () => full table }` under `Symbol.for("rivet.locales")`. The full table once loaded, else the
// trimmed one, starting the load for a language outside `l`. File-local on purpose (copies in `_adapters/intl.ts`,
// `i18n/index.ts`, `overlay/overlay-strings.ts`): a shared module became its own chunk (+1 request on 559 ui frames).
const TRIMMED = Symbol.for("rivet.locales");
function localeTable<T extends object>(strings: T, locale: string | null | undefined): T {
  const trimmed = (strings as { [TRIMMED]?: { l: readonly string[]; f(): Promise<object>; t?: object; p?: Promise<void> } })[TRIMMED];
  if (!trimmed) return strings;
  if (!trimmed.t && !trimmed.p && locale && !trimmed.l.includes(locale.split("-")[0]!.toLowerCase()))
    trimmed.p = trimmed.f().then(
      (full) => void (trimmed.t = full),
      () => void (trimmed.p = undefined),
    );
  return (trimmed.t as T | undefined) ?? strings;
}

/** Strings of `locale` from `strings`: exact match, language-script, language, any region of the language, else `defaultLocale`. */
export function getStringsForLocale<K extends string>(table: LocalizedStrings<K>, locale: string, defaultLocale = "en-US"): Record<K, string> {
  const strings = localeTable(table, locale);
  if (strings[locale]) return strings[locale];
  const [language, script] = localeParts(locale);
  if (script && strings[language + "-" + script]) return strings[language + "-" + script]!;
  if (strings[language]) return strings[language];
  for (const key in strings) if (key.startsWith(language + "-")) return strings[key]!;
  return strings[defaultLocale]!;
}

// `[language, script]` of a locale string (pure; memoised like `isRTL`).
const partsCache = new Map<string, readonly [string, string | undefined]>();
function localeParts(locale: string): readonly [string, string | undefined] {
  let parts = partsCache.get(locale);
  if (!parts) {
    const parsed = Intl.Locale ? new Intl.Locale(locale) : null;
    parts = [parsed ? parsed.language : locale.split("-")[0]!, parsed?.script];
    if (partsCache.size >= 256) partsCache.clear();
    partsCache.set(locale, parts);
  }
  return parts;
}

/** Interpolate `{name}` placeholders. */
export function formatString(template: string, variables?: Record<string, string | number | boolean>): string {
  return variables ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in variables ? String(variables[name]) : match)) : template;
}
