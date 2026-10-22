// Target-independent kit pieces: route head level context, head builders and component props.
import { createContext, type Context } from "@rivetjs/reactivity";
import { inlineScript } from "@rivetjs/router/head";
import { slashPath, TRAILING_SLASH, type TrailingSlash } from "@rivetjs/router";
import type { Head, HeadLink, HeadMeta, HeadScript, InlineScript, ScriptStrategy } from "@rivetjs/router";
import type { ImageDescriptor } from "@rivetjs/runtime/image";
export type { Head, HeadLink, HeadMeta, HeadScript, InlineScript, ScriptStrategy } from "@rivetjs/router";

/** Route level of the components below (router codegen: layouts 0…n−1, page n). */
export const HeadLevel: Context<number> = createContext<number>(0);

/** Trusted Types policy kit's script bootstrap and client head updates use (add it to `trustedTypes`). */
export const KIT_POLICY = "rivet-script";

/**
 * Inline script from a code string, outside the `?script` build path: reviewed code only (it runs
 * with the page's nonce / hash). The name is the warning.
 */
export const unsafeInlineScript = (code: string): InlineScript => inlineScript(code);

/** Text of JSX children (`<Title>Item {name}</Title>`). */
export function childText(children: unknown): string {
  if (children === null || children === undefined || children === false || children === true) return "";
  if (typeof children === "function") return childText((children as () => unknown)());
  if (Array.isArray(children)) return children.map(childText).join("");
  return String(children);
}

// ---- builders (pure: route `head` exports and `<Head value>` alike) ----

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
};

/** Absolute URL for `href` against `baseUrl` (or `url`'s origin); relative without either is an error. */
export function absolute(href: string, base?: string | URL): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return href;
  if (base === undefined) throw new TypeError(`"${href}" must be absolute for social/SEO tags: pass baseUrl (or a URL) to the builder`);
  return new URL(href, base).href;
}
const baseOf = (url: string | URL | undefined, baseUrl: string | undefined) =>
  baseUrl ?? (url instanceof URL ? url.origin : url && /^https?:/.test(url) ? url : undefined);

/** Options of `canonical()`. */
export interface CanonicalOptions {
  baseUrl?: string;
  /**
   * Path form, as the router's `trailingSlash` (`slashPath`): `ignore` (as written), `never` (strip a
   * trailing slash), `always` (add one; file paths such as `/feed.xml` stay as they are). Default: the
   * app's `rivetRouter({ trailingSlash })` policy (`TRAILING_SLASH`), so canonicals match its 308s.
   */
  trailingSlash?: TrailingSlash;
  /** Query parameters kept (everything else and the hash are dropped). */
  query?: readonly string[];
}
/** `<link rel=canonical>`: absolute, query stripped except the allowlist, no hash. */
export function canonical(url: string | URL, options: CanonicalOptions = {}): HeadLink {
  const target = new URL(absolute(String(url), baseOf(url, options.baseUrl)));
  const kept = new URLSearchParams();
  for (const name of options.query ?? []) for (const value of target.searchParams.getAll(name)) kept.append(name, value);
  target.search = kept.size ? "?" + kept.toString() : "";
  target.hash = "";
  target.pathname = slashPath(target.pathname, options.trailingSlash ?? TRAILING_SLASH);
  return { rel: "canonical", href: target.href };
}

/** Options of `alternates()`. */
export interface AlternatesOptions {
  /** Locale → href (relative hrefs resolve against `baseUrl`). */
  locales: Readonly<Record<string, string>>;
  /** `x-default` href (default: the first locale's). */
  xDefault?: string | false;
  baseUrl?: string;
}
/** hreflang alternates (+ `x-default`). */
export function alternates(options: AlternatesOptions): HeadLink[] {
  const entries = Object.entries(options.locales);
  const links = entries.map(([hreflang, href]) => ({ rel: "alternate", hreflang, href: absolute(href, options.baseUrl) }));
  const fallback = options.xDefault === undefined ? entries[0]?.[1] : options.xDefault;
  if (fallback) links.push({ rel: "alternate", hreflang: "x-default", href: absolute(fallback, options.baseUrl) });
  return links;
}

/** Options of `openGraph()`. */
export interface OpenGraphOptions {
  title?: string;
  description?: string;
  url?: string | URL;
  /** Image URL or a `?image` descriptor (fallback format, with width/height/type). */
  image?: ImageDescriptor | string;
  imageAlt?: string;
  type?: string;
  siteName?: string;
  locale?: string;
  localeAlternates?: readonly string[];
  baseUrl?: string;
}
/** `og:*` meta. */
export function openGraph(options: OpenGraphOptions): HeadMeta[] {
  const base = baseOf(options.url, options.baseUrl);
  const meta: HeadMeta[] = [];
  const add = (property: string, content: string | number | undefined) =>
    content !== undefined && content !== "" && meta.push({ property, content: String(content) });
  add("og:title", options.title);
  add("og:description", options.description);
  if (options.url !== undefined) add("og:url", absolute(String(options.url), base));
  add("og:type", options.type ?? (options.title !== undefined ? "website" : undefined));
  add("og:site_name", options.siteName);
  add("og:locale", options.locale);
  for (const locale of options.localeAlternates ?? []) meta.push({ property: "og:locale:alternate", content: locale, key: "og:locale:alternate:" + locale });
  const image = options.image;
  if (typeof image === "string") add("og:image", absolute(image, base));
  else if (image) {
    add("og:image", absolute(image.src, base));
    add("og:image:width", image.width);
    add("og:image:height", image.height);
    add("og:image:type", MIME[/\.([a-z0-9]+)(?:[?#]|$)/i.exec(image.src)?.[1]?.toLowerCase() ?? ""]);
  }
  add("og:image:alt", options.imageAlt);
  return meta;
}

/** Options of `twitterCard()`. */
export interface TwitterCardOptions {
  card?: "summary" | "summary_large_image" | "app" | "player";
  site?: string;
  creator?: string;
  /** Only when they differ from Open Graph (Twitter falls back to `og:*`). */
  title?: string;
  description?: string;
  image?: string;
}
/** `twitter:*` meta (card, handles; title/description/image fall back to OG). */
export function twitterCard(options: TwitterCardOptions = {}): HeadMeta[] {
  const meta: HeadMeta[] = [{ name: "twitter:card", content: options.card ?? "summary_large_image" }];
  for (const key of ["site", "creator", "title", "description", "image"] as const) {
    const value = options[key];
    if (value !== undefined) meta.push({ name: "twitter:" + key, content: value });
  }
  return meta;
}

/** Options of `seo()`: title, description, Open Graph, canonical, Twitter card and robots. */
export interface SeoOptions extends Omit<OpenGraphOptions, "title" | "description"> {
  title?: string;
  description?: string;
  /** `false`: no canonical link (default: from `url`). */
  canonical?: false | CanonicalOptions;
  twitter?: TwitterCardOptions | false;
  /** `noindex` / `nofollow` robots meta. */
  robots?: string;
}
/** Title, description, canonical, Open Graph and Twitter in one head. */
export function seo(options: SeoOptions): Head {
  const meta: HeadMeta[] = [];
  if (options.description !== undefined) meta.push({ name: "description", content: options.description });
  if (options.robots !== undefined) meta.push({ name: "robots", content: options.robots });
  meta.push(...openGraph(options));
  if (options.twitter !== false) meta.push(...twitterCard(options.twitter ?? {}));
  const links: HeadLink[] =
    options.url !== undefined && options.canonical !== false
      ? [canonical(options.url, { ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}), ...(options.canonical ?? {}) })]
      : [];
  return { ...(options.title !== undefined ? { title: options.title } : {}), meta, ...(links.length ? { links } : {}) };
}

/** A JSON-LD block for `head.scripts` (`id` dedupes; without one blocks accumulate). */
export const jsonLd = <T extends object>(data: T, id?: string): HeadScript => (id !== undefined ? { jsonLd: data, id } : { jsonLd: data });

// ---- component props ----

/** Props of `<Meta>`. */
export type MetaProps = HeadMeta;
/** Props of `<HeadLink>`. */
export type HeadLinkProps = HeadLink;
/** Props of `<Script>`: an external script with a load strategy, or a static inline script. */
export type ScriptProps =
  | {
      src: string;
      type?: "module" | "classic";
      strategy?: ScriptStrategy;
      id?: string;
      integrity?: string;
      crossorigin?: "anonymous" | "use-credentials";
      referrerpolicy?: string;
    }
  | { inline: InlineScript; strategy?: "blocking" | "eager" | "defer" | "body"; data?: unknown; id?: string };
/** Props of `<JsonLd>`. */
export interface JsonLdProps<T extends object = object> {
  data: T;
  id?: string;
}
/** Options of `themeScript()`. */
export interface ThemeScriptProps {
  /** localStorage key (default `theme`). */
  storageKey?: string;
  /** Attribute set on `<html>` (default `data-theme`); `class` toggles a class instead. */
  attribute?: string;
  /** Used when nothing is stored: `system` follows `prefers-color-scheme` (default). */
  defaultTheme?: string;
}
/** Blocking inline script setting the stored theme before first paint (static per props: stable hash). */
export function themeScript({ storageKey = "theme", attribute = "data-theme", defaultTheme = "system" }: ThemeScriptProps = {}): HeadScript {
  const json = JSON.stringify;
  const code =
    `(()=>{let t;try{t=localStorage.getItem(${json(storageKey)})}catch{}t=t||${json(defaultTheme)};` +
    `if(t=="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";` +
    (attribute === "class" ? `document.documentElement.classList.add(t)` : `document.documentElement.setAttribute(${json(attribute)},t)`) +
    `})()`;
  return { inline: inlineScript(code), strategy: "blocking", id: "rivet-theme" };
}
