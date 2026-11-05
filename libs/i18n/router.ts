// @rivetjs/router integration: locale guard, href helpers, SEO alternates.
// Routes take the locale from an optional `[[lang]]` segment; the guard validates it (or resolves
// one), stores it in `locals.locale` / `locals.dir` for the app (variant, manifest, `<html lang dir>`)
// and redirects unprefixed URLs; same-site navigations to a locale record it in the locale cookie.
import { BASE, notFound, redirect, slashPath, TRAILING_SLASH, type HeadLink, type RequestEvent, type TrailingSlash } from "@rivetjs/router";
import { cookieName, DEFAULT_ORDER, localeCookie, localeCookieOptions, localeFromPath, resolveServer, type ResolveConfig, type Strategy } from "./resolve.ts";

/** i18n config of the router integration: resolution order, base URL and RTL languages. */
export interface I18nRouteConfig extends ResolveConfig {
  /** Absolute origin for `alternates()`. */
  baseUrl?: string;
  /** Resolution order (default url, cookie, preferredLanguage, baseLocale). */
  strategy?: readonly (string | Strategy)[];
  /** Right-to-left base languages (default ar, fa, he, ur, ps, dv, yi). */
  rtl?: readonly string[];
}

const RTL = ["ar", "fa", "he", "ur", "ps", "dv", "yi"];
/** Text direction of a locale. */
export const dirOf = (locale: string, rtl: readonly string[] = RTL): "ltr" | "rtl" => (rtl.includes(locale.split("-")[0]!.toLowerCase()) ? "rtl" : "ltr");

/** Path prefix of `locale` ("" when its URLs carry none). */
function prefixOf(locale: string, config: I18nRouteConfig): string {
  const prefix = config.routing?.prefix ?? "as-needed";
  if (prefix === "never") return "";
  // Lower-case like resolve.ts `prefixes` and vite.ts `clientPathPattern`, which match the segment.
  if (typeof prefix === "object") {
    // An empty mapped segment means no prefix (never `//a`).
    const segment = (Object.hasOwn(prefix, locale) ? prefix[locale]! : locale).replace(/^\/|\/$/g, "").toLowerCase();
    return segment ? "/" + segment : "";
  }
  if (prefix === "as-needed" && locale === config.defaultLocale) return "";
  return "/" + locale.toLowerCase();
}

/** `[base, path below it]` for a URL path under `base` (`/app`), else `["", path]`. */
function splitBase(path: string, base: string): [string, string] {
  return base && (path === base || path.startsWith(base + "/")) ? [base, path.slice(base.length) || "/"] : ["", path];
}

/**
 * `href` without its locale prefix (path, query and hash kept). The locale prefix follows the app
 * base (`BASE`, `/app/de/cart`), which stays in front.
 */
export function delocalizeHref(href: string, config: I18nRouteConfig, base: string = BASE): string {
  const url = new URL(href, "http://x");
  const [at, path] = splitBase(url.pathname, base);
  const bare = localeFromPath(path, config) ? path.replace(/^\/[^/]+/, "") || "/" : path;
  return noProtocolRelative(at + bare + url.search + url.hash);
}

/** A path never starts with `//` (browsers read that as another host): `/de//evil.com` stays on this origin. */
const noProtocolRelative = (href: string) => href.replace(/^\/{2,}/, "/");

/** `href` in `locale`: its locale prefix (after the app base, `BASE`) replaced by `locale`'s. */
export function localizeHref(href: string, locale: string, config: I18nRouteConfig, base: string = BASE): string {
  const url = new URL(href, "http://x");
  const [at, path] = splitBase(url.pathname, base);
  const bare = delocalizeHref(noProtocolRelative(path) + url.search + url.hash, config, "");
  const prefix = prefixOf(locale, config);
  // The localized root is the bare prefix (`/de`, not `/de/`).
  return noProtocolRelative(at + (prefix && /^\/(?:[?#]|$)/.test(bare) ? prefix + bare.slice(1) : prefix + bare));
}

/** Options of `alternates()` (as kit `canonical()`). */
export interface AlternatesOptions {
  /** Path form of every href, as the router's `trailingSlash`. Default: the app's `rivetRouter({ trailingSlash })` policy. */
  trailingSlash?: TrailingSlash;
  /** Query parameters the canonical keeps (everything else and the hash are dropped). */
  query?: readonly string[];
}

/** `hreflang` alternates for every locale, `x-default` (default locale) and the canonical URL (query stripped except `query`, no hash). */
export function alternates(url: URL, config: I18nRouteConfig, options: AlternatesOptions = {}): HeadLink[] {
  const { baseUrl } = config;
  if (!baseUrl) throw new Error("i18n: alternates() needs baseUrl");
  const slash = options.trailingSlash ?? TRAILING_SLASH;
  // One delocalize for all locales: this runs per page render that emits hreflang.
  const [at, path] = splitBase(url.pathname, BASE);
  const bare = localeFromPath(path, config) ? path.replace(/^\/[^/]+/, "") || "/" : path;
  const absolute = (path: string, search = "") => new URL(slashPath(path, slash) + search, baseUrl).href;
  const localized = (locale: string) => {
    const prefix = prefixOf(locale, config);
    return absolute(at + (prefix && bare === "/" ? prefix : prefix + bare));
  };
  const kept = new URLSearchParams();
  for (const name of options.query ?? []) for (const value of url.searchParams.getAll(name)) kept.append(name, value);
  return [
    ...config.locales.map((locale) => ({ rel: "alternate", hreflang: locale, href: localized(locale) })),
    { rel: "alternate", hreflang: "x-default", href: localized(config.defaultLocale) },
    { rel: "canonical", href: absolute(url.pathname, kept.size ? "?" + kept : "") },
  ];
}

/**
 * Error-page locale for unmatched URLs and guards that failed before settling one: `createApp`
 * `i18n.resolve` / `start({ resolveLocale })`. Same strategies as the guard.
 */
export function errorLocale(config: I18nRouteConfig): (request: Request) => Promise<string> {
  return (request) => resolveServer(request, config, config.strategy);
}

/**
 * A same-site document navigation the user started: a followed link or a submitted form
 * (`Sec-Fetch-Site: same-origin`, `Sec-Fetch-Mode: navigate`), not a prefetch/prerender
 * (`Sec-Purpose`) or a client-router data request (those also warm on hover).
 */
const chosenNavigation = (request: Request): boolean =>
  request.headers.get("sec-fetch-site") === "same-origin" && request.headers.get("sec-fetch-mode") === "navigate" && !request.headers.has("sec-purpose");

/**
 * Layout guard: a `lang` param must name a locale (else 404); without one the locale resolves
 * (`strategy`). An unprefixed URL redirects (302) to the resolved locale's prefixed URL, unless that
 * locale has no prefix (`as-needed` default locale) or, under `as-needed`, the request is a same-site
 * navigation (`Sec-Fetch-Site: same-origin`: a followed unprefixed link is an explicit choice of the
 * default locale, as is a cookie naming it). `always` and prefix maps redirect every unprefixed URL.
 * Prefixed URLs never redirect. Sets `locals.locale`, `locals.dir` and `Content-Language`; responses
 * chosen by cookie/headers get `Vary`.
 *
 * Locale cookie: a same-site document navigation (`chosenNavigation`) to a URL naming a locale (its
 * prefix, or unprefixed under `as-needed` = default locale) other than the one cookie and headers
 * pick records the choice (`Set-Cookie`, `localeCookieOptions`). Never from Accept-Language alone,
 * never when the cookie already names it; off with `cookie: false` or a `strategy` without `cookie`.
 */
export function i18nGuard(config: I18nRouteConfig): (event: RequestEvent) => Promise<void> {
  const prefix = config.routing?.prefix ?? "as-needed";
  const order = config.strategy ?? DEFAULT_ORDER;
  const name = order.includes("cookie") ? cookieName(config) : null;
  const preferences = order.filter((s) => s !== "url");
  return async (event) => {
    const param = event.params.lang;
    if (param !== undefined) {
      const locale = localeFromPath("/" + param, config);
      if (!locale) throw notFound();
      if (name && chosenNavigation(event.request) && locale !== (await resolveServer(event.request, config, preferences))) remember(event, name, locale);
      return settle(event, locale);
    }
    const resolved = await resolveServer(event.request, config, config.strategy);
    if (prefix === "never") {
      event.setHeader("vary", "cookie, accept-language");
      return settle(event, resolved);
    }
    const asNeeded = prefix === "as-needed";
    event.setHeader("vary", asNeeded ? "cookie, accept-language, sec-fetch-site" : "cookie, accept-language");
    const followed = asNeeded && event.request.headers.get("sec-fetch-site") === "same-origin";
    if (prefixOf(resolved, config) && !followed) {
      const here = event.url.pathname + event.url.search;
      const target = localizeHref(here, resolved, config);
      if (target !== here) throw redirect(target, 302);
    }
    // Served unprefixed = the default locale; a followed link here chose it over `resolved`.
    if (name && resolved !== config.defaultLocale && chosenNavigation(event.request)) remember(event, name, config.defaultLocale);
    settle(event, config.defaultLocale);
  };
  function settle(event: RequestEvent, locale: string): void {
    event.locals.locale = locale;
    event.locals.dir = dirOf(locale, config.rtl);
    event.setHeader("content-language", locale);
  }
  function remember(event: RequestEvent, name: string, locale: string): void {
    event.cookies.set(name, locale, localeCookieOptions(config, event.url.protocol === "https:"));
  }
}

/**
 * Language switcher (browser): records `locale` in the locale cookie (same attributes as the
 * server's) and loads the current page in it (`localizeHref`), a document navigation, since every
 * locale has its own client build. Plain links work too: the guard records same-site navigations.
 */
export function setLocale(locale: string, config: I18nRouteConfig): void {
  const cookie = localeCookie(locale, config, location.protocol === "https:");
  if (cookie) document.cookie = cookie;
  location.assign(localizeHref(location.pathname + location.search + location.hash, locale, config));
}
