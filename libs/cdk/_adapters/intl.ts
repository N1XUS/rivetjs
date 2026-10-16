// Ported from react-spectrum (@internationalized/string LocalizedStringDictionary /
// LocalizedStringFormatter, react-aria i18n/useLocalizedStringFormatter), Apache-2.0, © Adobe.
//
// LOCAL ADAPTER: localized strings of a module (`<module>/intl.ts`: every locale of the original's
// `intl/<module>/*.json`, plain data) and a small ICU subset formatter (`{arg}`, `plural` with `#`
// and `=n`, `select`). No import-time globals: number formats / plural rules are created on first use
// and cached (`i18n/intl-cache.ts`).

import { cachedIntl } from "../i18n/intl-cache.ts";

/** Locale → message key → ICU message. */
export type LocalizedStrings = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Locale of `element` (nearest `lang`), else the document's, else the browser's, else `en-US`. */
export function localeOf(element?: Element | null): string {
  const lang = element?.closest("[lang]")?.getAttribute("lang") || (typeof document !== "undefined" ? document.documentElement.lang : "");
  return lang || (typeof navigator !== "undefined" ? navigator.language : "") || "en-US";
}

/** Messages of the best matching locale: exact, then same language, then `en-US`. */
export function stringsFor(strings: LocalizedStrings, locale = "en-US"): Readonly<Record<string, string>> {
  if (strings[locale]) return strings[locale]!;
  const language = locale.split("-")[0]!.toLowerCase();
  for (const key of Object.keys(strings)) if (key.split("-")[0]!.toLowerCase() === language) return strings[key]!;
  return strings["en-US"] ?? {};
}

/** Format `key` of `strings` for `locale` with ICU arguments (react-aria `stringFormatter.format`). */
export function formatMessage(strings: LocalizedStrings, locale: string | undefined, key: string, args: Record<string, unknown> = {}): string {
  const message = stringsFor(strings, locale)[key] ?? stringsFor(strings, "en-US")[key] ?? key;
  return format(message, args, locale ?? "en-US");
}

// --- ICU subset ------------------------------------------------------------------------------

function format(message: string, args: Record<string, unknown>, locale: string, hash?: string): string {
  let out = "";
  let i = 0;
  while (i < message.length) {
    const c = message[i]!;
    if (c === "{") {
      const end = matching(message, i);
      out += argument(message.slice(i + 1, end), args, locale);
      i = end + 1;
    } else if (c === "#" && hash !== undefined) {
      out += hash;
      i++;
    } else if (c === "'" && message[i + 1] === "'") {
      out += "'";
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function matching(message: string, open: number): number {
  let depth = 0;
  for (let i = open; i < message.length; i++) {
    if (message[i] === "{") depth++;
    else if (message[i] === "}" && --depth === 0) return i;
  }
  return message.length - 1;
}

function argument(body: string, args: Record<string, unknown>, locale: string): string {
  const first = body.indexOf(",");
  if (first < 0) return String(args[body.trim()] ?? "");
  const name = body.slice(0, first).trim();
  const rest = body.slice(first + 1);
  const second = rest.indexOf(",");
  const type = (second < 0 ? rest : rest.slice(0, second)).trim();
  const value = args[name];
  if (type === "number") return cachedIntl(Intl.NumberFormat, locale).format(Number(value));
  if (second < 0) return String(value ?? "");
  const options = cases(rest.slice(second + 1));
  if (type === "plural" || type === "selectordinal") {
    const n = Number(value);
    const exact = options.get("=" + n);
    const hash = cachedIntl(Intl.NumberFormat, locale).format(n);
    if (exact !== undefined) return format(exact, args, locale, hash);
    const rule = cachedIntl(Intl.PluralRules, locale, { type: type === "plural" ? "cardinal" : "ordinal" }).select(n);
    return format(options.get(rule) ?? options.get("other") ?? "", args, locale, hash);
  }
  // select
  return format(options.get(String(value)) ?? options.get("other") ?? "", args, locale);
}

function cases(source: string): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i]!)) i++;
    const open = source.indexOf("{", i);
    if (open < 0) break;
    const selector = source.slice(i, open).trim();
    const close = matching(source, open);
    map.set(selector, source.slice(open + 1, close));
    i = close + 1;
  }
  return map;
}
