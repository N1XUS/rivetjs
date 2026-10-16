// Isomorphic locale resolution: ordered strategies, first result in `locales` wins.
// SSR/resume pages never resolve on the client (locale = <html lang>); client resolution is for
// pure CSR and the static-hosting root redirect.
import { BASE, parseCookies } from "@rivetjs/router";
import type { I18nConfig } from "./catalog.ts";

/** What a locale strategy reads from: path, cookies and preferred languages. */
export interface Source {
  path(): string;
  cookie(name: string): string | undefined;
  /** Preferred languages, most preferred first. */
  languages(): readonly string[];
}
/** A custom locale resolution step. */
export interface Strategy {
  name: string;
  server?(req: Request, source: Source): string | undefined | Promise<string | undefined>;
  client?(source: Source): string | undefined;
}
/** Locale resolution config: locales, default locale, routing and cookie. */
export interface ResolveConfig {
  locales: readonly string[];
  defaultLocale: string;
  routing?: I18nConfig["routing"];
  cookie?: I18nConfig["cookie"];
}

/** Default locale resolution order. */
export const DEFAULT_ORDER = ["url", "cookie", "preferredLanguage", "baseLocale"] as const;
/** Name of the locale cookie (`rivet_locale` by default); `null` with `cookie: false`. */
export const cookieName = (config: ResolveConfig): string | null =>
  config.cookie === false ? null : (config.cookie?.name ?? "rivet_locale");

/**
 * Attributes of the locale cookie, shared by the server (`Set-Cookie`) and `document.cookie`:
 * `Path=/`, `SameSite=Lax`, `Max-Age` from `cookie.maxAge` (none: a session cookie), `Secure` on
 * https. Readable by scripts (the static root redirect and `resolveClient` read it).
 */
export function localeCookieOptions(config: ResolveConfig, secure: boolean) {
  const maxAge = config.cookie ? config.cookie.maxAge : undefined;
  return { path: "/", sameSite: "lax", httpOnly: false, secure, ...(maxAge !== undefined ? { maxAge } : {}) } as const;
}

/** `document.cookie` assignment for `locale` (`undefined` with `cookie: false`). */
export function localeCookie(locale: string, config: ResolveConfig, secure: boolean): string | undefined {
  const name = cookieName(config);
  if (!name) return undefined;
  const maxAge = config.cookie ? config.cookie.maxAge : undefined;
  let out = name + "=" + encodeURIComponent(locale) + "; Path=/";
  if (maxAge !== undefined) out += "; Max-Age=" + Math.floor(maxAge);
  out += "; SameSite=Lax";
  if (secure) out += "; Secure";
  return out;
}

/** Best locale for `wanted` (preference order): exact, then base language ("de-CH" → "de"), then a region of it ("de" → "de-AT"). */
export function match(wanted: readonly string[], locales: readonly string[]): string | undefined {
  const lower = locales.map((l) => l.toLowerCase());
  for (const w of wanted) {
    const want = w.toLowerCase();
    const language = want.split("-")[0]!;
    const exact = lower.indexOf(want);
    if (exact >= 0) return locales[exact];
    const base = lower.indexOf(language);
    if (base >= 0) return locales[base];
    const region = lower.findIndex((l) => l.split("-")[0] === language);
    if (region >= 0) return locales[region];
  }
  return undefined;
}

/** Locale → first path segment (lowercase, no slashes). */
function prefixes(config: ResolveConfig): [string, string][] {
  const prefix = config.routing?.prefix;
  if (prefix && typeof prefix === "object")
    return Object.entries(prefix).map(([locale, path]) => [locale, path.replace(/^\/|\/$/g, "").toLowerCase()]);
  return config.locales.map((locale) => [locale, locale.toLowerCase()]);
}

/** The locale named by the path's first segment, honouring a prefix map. */
export function localeFromPath(path: string, config: ResolveConfig): string | undefined {
  if (config.routing?.prefix === "never") return undefined;
  const first = path.split("/")[1]?.toLowerCase() ?? "";
  return first ? prefixes(config).find(([, p]) => p === first)?.[0] : undefined;
}

/** URL path, Cookie header and Accept-Language (q-sorted) of a request. */
export function requestSource(req: Request): Source {
  const url = new URL(req.url);
  let cookies: Map<string, string> | undefined;
  return {
    path: () => url.pathname,
    cookie: (name) => (cookies ??= parseCookies(req.headers.get("cookie"))).get(name),
    languages: () =>
      (req.headers.get("accept-language") ?? "")
        .split(",")
        .map((part) => {
          const [tag = "", ...params] = part.trim().split(";");
          const q = params.find((p) => p.trim().startsWith("q="));
          return { tag: tag.trim(), q: q ? Number(q.trim().slice(2)) : 1 };
        })
        .filter((l) => l.tag && l.tag !== "*" && l.q > 0)
        .sort((a, b) => b.q - a.q)
        .map((l) => l.tag),
  };
}

/** `location.pathname`, `document.cookie` and `navigator.languages`. */
export function browserSource(): Source {
  return {
    path: () => location.pathname,
    cookie: (name) => parseCookies(document.cookie).get(name),
    languages: () => navigator.languages ?? [navigator.language],
  };
}

/** Built-in strategies: `url`, `cookie`, `preferredLanguage`, `baseLocale`. */
export function strategies(config: ResolveConfig): Record<(typeof DEFAULT_ORDER)[number], Strategy> {
  // The locale prefix follows the app base (`BASE`).
  const fromPath = (s: Source) => {
    const path = s.path();
    return localeFromPath(BASE && (path === BASE || path.startsWith(BASE + "/")) ? path.slice(BASE.length) || "/" : path, config);
  };
  const fromCookie = (s: Source) => {
    const name = cookieName(config);
    return name ? s.cookie(name) : undefined;
  };
  const fromLanguages = (s: Source) => match(s.languages(), config.locales);
  return {
    url: { name: "url", server: (_req, s) => fromPath(s), client: fromPath },
    cookie: { name: "cookie", server: (_req, s) => fromCookie(s), client: fromCookie },
    preferredLanguage: { name: "preferredLanguage", server: (_req, s) => fromLanguages(s), client: fromLanguages },
    baseLocale: { name: "baseLocale", server: () => config.defaultLocale, client: () => config.defaultLocale },
  };
}

function strategyList(config: ResolveConfig, order: readonly (string | Strategy)[]): Strategy[] {
  const builtins = strategies(config);
  return order.map((s) => {
    if (typeof s !== "string") return s;
    const found = (builtins as Record<string, Strategy>)[s];
    if (!found) throw new Error(`i18n: unknown strategy "${s}"`);
    return found;
  });
}

/** Request locale: strategies in `order` (names of built-ins or custom ones), else `defaultLocale`. */
export async function resolveServer(
  req: Request,
  config: ResolveConfig,
  order: readonly (string | Strategy)[] = DEFAULT_ORDER,
): Promise<string> {
  const source = requestSource(req);
  for (const strategy of strategyList(config, order)) {
    const locale = await strategy.server?.(req, source);
    if (locale && config.locales.includes(locale)) return locale;
  }
  return config.defaultLocale;
}

/** Browser locale (CSR only): strategies in `order`, else `defaultLocale`. */
export function resolveClient(config: ResolveConfig, order: readonly (string | Strategy)[] = DEFAULT_ORDER): string {
  const source = browserSource();
  for (const strategy of strategyList(config, order)) {
    const locale = strategy.client?.(source);
    if (locale && config.locales.includes(locale)) return locale;
  }
  return config.defaultLocale;
}
