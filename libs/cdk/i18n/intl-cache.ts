// Shared cache of `Intl` formatter instances (Rivet; upstream React Aria memoizes per hook call).
//
// Constructing an `Intl.NumberFormat` / `PluralRules` / `DisplayNames` / `ListFormat` /
// `DateTimeFormat` costs 7–60 µs; `format` on a cached instance ≈ 0.2 µs. Render paths, bindings and
// handlers call `cachedIntl(Intl.NumberFormat, locale, options)` instead of `new Intl.X(…)`.
// Key = constructor + locale + options (sorted `key=value` pairs, so two option objects with the same
// entries share one instance). One map per constructor, cleared past 256 entries.
// Plain module function: resumable bindings / handlers may call it (only plain data is captured).

// `options` is required in the type so constructors with a required options argument (`DisplayNames`) fit.
type Ctor<O, T> = new (locales: string | undefined, options: O) => T;

const caches = new Map<Function, Map<string, unknown>>();

/** Stable key of a flat options object (`Intl.*Options` values are primitives or string arrays). */
function optionsKey(options: object | undefined): string {
  if (!options) return "";
  const keys = Object.keys(options);
  if (keys.length === 0) return "";
  if (keys.length > 1) keys.sort();
  let key = "";
  for (const k of keys) {
    const value = (options as Record<string, unknown>)[k];
    if (value !== undefined) key += k + "=" + String(value) + ";";
  }
  return key;
}

/** Cached `new ctor(locale, options)`, e.g. `cachedIntl(Intl.NumberFormat, "en-US", { style: "currency", currency: "USD" })`. */
export function cachedIntl<O extends object, T>(ctor: Ctor<O, T>, locale: string | undefined, options?: NoInfer<O>): T {
  let cache = caches.get(ctor) as Map<string, T> | undefined;
  if (!cache) caches.set(ctor, (cache = new Map()));
  const key = (locale ?? "") + "|" + optionsKey(options);
  let instance = cache.get(key);
  if (instance === undefined) {
    if (cache.size >= 256) cache.clear();
    cache.set(key, (instance = new ctor(locale, options as O)));
  }
  return instance;
}
