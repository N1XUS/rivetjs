// @rivetjs/router integration: locale guard, href helpers, SEO alternates.
// Routes take the locale from an optional `[[lang]]` segment; the guard validates it (or resolves
// one), stores it in `locals.locale` / `locals.dir` for the app (variant, manifest, `<html lang dir>`)
// and redirects unprefixed URLs; same-site navigations to a locale record it in the locale cookie.
import { BASE, notFound, redirect, type HeadLink, type RequestEvent } from "@rivetjs/router";
import {
  cookieName,
  DEFAULT_ORDER,
  localeCookie,
  localeCookieOptions,
  localeFromPath,
  resolveServer,
  type ResolveConfig,
  type Strategy,
} from "./resolve.ts";

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
export const dirOf = (locale: string, rtl: readonly string[] = RTL): "ltr" | "rtl" =>
  rtl.includes(locale.split("-")[0]!.toLowerCase()) ? "rtl" : "ltr";

/** Path prefix of `locale` ("" when its URLs carry none). */
function prefixOf(locale: string, config: I18nRouteConfig): string {
  const prefix = config.routing?.prefix ?? "as-needed";
  if (prefix === "never") return "";
  if (typeof prefix === "object") return "/" + (prefix[locale] ?? locale).replace(/^\/|\/$/g, "");
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
  return at + bare + url.search + url.hash;
}

/** `href` in `locale`: its locale prefix (after the app base, `BASE`) replaced by `locale`'s. */
export function localizeHref(href: string, locale: string, config: I18nRouteConfig, base: string = BASE): string {
  const url = new URL(href, "http://x");
  const [at, path] = splitBase(url.pathname, base);
  const bare = delocalizeHref(path + url.search + url.hash, config, "");
  const prefix = prefixOf(locale, config);
  // The localized root is the bare prefix (`/de`, not `/de/`).
  return at + (prefix && /^\/(?:[?#]|$)/.test(bare) ? prefix + bare.slice(1) : prefix + bare);
}

/** `hreflang` alternates for every locale, `x-default` (default locale) and the canonical URL. */
export function alternates(url: URL, config: I18nRouteConfig): HeadLink[] {
  const { baseUrl } = config;
  if (!baseUrl) throw new Error("i18n: alternates() needs baseUrl");
  const bare = delocalizeHref(url.pathname, config);
  const absolute = (locale: string) => new URL(localizeHref(bare, locale, config), baseUrl).href;
  return [
    ...config.locales.map((locale) => ({ rel: "alternate", hreflang: locale, href: absolute(locale) })),
    { rel: "alternate", hreflang: "x-default", href: absolute(config.defaultLocale) },
    { rel: "canonical", href: new URL(url.pathname + url.search, baseUrl).href },
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
  request.headers.get("sec-fetch-site") === "same-origin" &&
  request.headers.get("sec-fetch-mode") === "navigate" &&
  !request.headers.has("sec-purpose");

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
      if (name && chosenNavigation(event.request) && locale !== (await resolveServer(event.request, config, preferences)))
        remember(event, name, locale);
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
