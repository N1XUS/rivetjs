// Compile-time translation marker. The Rivet compiler replaces every call; reaching this code means
// the module was not compiled with the i18n plugin.

import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { _requestLocale } from "@rivetjs/router/route-context";

/** Augmented by the generated declarations (i18n Vite plugin): key → params. */
export interface Messages {}
/** Augmented by the generated declarations: one property per configured locale. */
export interface Locales {}
/** A configured locale code (typed from the generated declarations; `string` before they exist). */
export type Locale = keyof Locales extends never ? string : keyof Locales & string;
/** Message parameters. */
export type Params = Readonly<Record<string, unknown>>;
type Key = keyof Messages extends never ? string : keyof Messages & string;
type Args<K extends Key> = K extends keyof Messages
  ? {} extends Messages[K]
    ? [params?: Messages[K]]
    : [params: Messages[K]]
  : [params?: Params];
/** Tag params are `(children) => content` functions (generated declarations); any tag makes the message JSX content. */
type Tags<P> = { [N in keyof P]-?: NonNullable<P[N]> extends (children: never) => unknown ? N : never }[keyof P];
type Result<K> = K extends keyof Messages ? ([Tags<Messages[K]>] extends [never] ? string : Content) : string;
/** `nav.${string}` for every key `nav.…`: the type of `` `nav.${id}` `` with a `string` id. */
type Namespace<K extends string> = K extends `${infer Head}.${string}` ? `${Head}.${string}` : never;
type PrefixKey = keyof Messages extends never ? never : Namespace<Key>;
/** `K` is a template pattern (`nav.${string}`), not a literal key: only then is `Record<K, 1>` an index signature `{}` fits. */
type Pattern<K extends string> = {} extends Record<K, 1> ? K : never;
export interface Translate {
  /** A message: a string, or JSX content when the message has tags. */
  <K extends Key>(key: K, ...args: Args<K>): Result<K>;
  /** A key chosen at runtime under a fixed prefix (`` t(`nav.${id}`) ``): plain-text messages without params. */
  <K extends PrefixKey>(key: K & Pattern<K>): string;
  /** Explicit locale, for code that runs outside a render (loaders, actions, after `await`). */
  in<K extends Key>(locale: Locale, key: K, ...args: Args<K>): string;
}
const uncompiled = (): never => {
  throw new Error("@rivetjs/i18n: t() was not compiled. Add i18n() before rivet() in the Vite plugins.");
};
/** Translate a message key. The compiler replaces every call with the locale's message; `t.in(locale, key)` picks the locale explicitly. */
export const t: Translate = Object.assign(uncompiled, { in: uncompiled }) as unknown as Translate;

/**
 * The page's locale. Server: the request's (`locals.locale`, set by `i18nGuard`; none settled: the first locale), read while rendering — call it in
 * component setup, not after an `await` (loaders and actions: `event.locals.locale`). Browser: a constant of the locale's
 * client build (`i18n()` swaps this module, so the call is a string literal and nothing of this function ships); dev:
 * the page's locale. Both sides return the same value, so markup built from it resumes as rendered.
 */
export function locale(): Locale {
  const value = _requestLocale();
  if (value === undefined)
    throw new Error(
      "@rivetjs/i18n: locale() has no request locale. Call it while a page renders (component setup) in an app with i18n (i18nGuard sets locals.locale; loaders and actions read event.locals.locale).",
    );
  return value as Locale;
}
