// Message runtime used by compiled `t()` code: only what depends on runtime values (plural/select
// category, Intl formatting, `t.in` locale pick). Static messages never import this module.
// Intl constructors cost far more than format(); every instance is cached per locale + options.
const pluralRules = new Map<string, Intl.PluralRules>();
const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function rules(locale: string, ordinal: boolean): Intl.PluralRules {
  const key = (ordinal ? "o:" : "c:") + locale;
  let r = pluralRules.get(key);
  if (!r) pluralRules.set(key, (r = new Intl.PluralRules(locale, { type: ordinal ? "ordinal" : "cardinal" })));
  return r;
}

/** `=N` case first, then the locale's plural category, then `other`. */
export function plural(
  locale: string,
  n: number,
  cases: Readonly<Record<string, () => string>>,
  ordinal = false,
): string {
  const exact = cases["=" + n];
  if (exact) return exact();
  return (cases[rules(locale, ordinal).select(n)] ?? cases.other!)();
}

export function select(value: unknown, cases: Readonly<Record<string, () => string>>): string {
  const key = String(value);
  return (Object.hasOwn(cases, key) ? cases[key]! : cases.other!)();
}

export function number(locale: string, n: number, options?: Intl.NumberFormatOptions): string {
  const key = "n:" + locale + ":" + (options ? JSON.stringify(options) : "");
  let f = formatters.get(key) as Intl.NumberFormat | undefined;
  if (!f) formatters.set(key, (f = new Intl.NumberFormat(locale, options)));
  return f.format(n);
}

export function date(
  locale: string,
  d: Date | number,
  options?: Intl.DateTimeFormatOptions,
  timeZone?: string,
): string {
  const key = "d:" + locale + ":" + (timeZone ?? "") + ":" + (options ? JSON.stringify(options) : "");
  let f = formatters.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) formatters.set(key, (f = new Intl.DateTimeFormat(locale, timeZone ? { ...options, timeZone } : options)));
  return f.format(d);
}

/** `t.in(locale, …)`: the value for `locale`, or the first locale's when unknown. */
export function pick<T>(locale: string, locales: readonly string[], values: readonly (() => T)[]): T {
  const i = locales.indexOf(locale);
  return values[i < 0 ? 0 : i]!();
}
