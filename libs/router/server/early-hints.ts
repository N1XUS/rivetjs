// Early hints (`createApp({ earlyHints })`): `Link` header values for a page — its linked stylesheets, the build-asset
// font preloads its head carried last time (learned per route), `links` / the resume runtime the app asked for. The
// node adapter sends them as `103 Early Hints` before guards and loaders run; every page response carries them as a
// `Link` header too, which CDNs (Cloudflare, Fastly) turn into 103s for later requests. Web-standard, no state here.
// Preloads only for build assets (`<base>/assets/…`: hashed, immutable): Chromium reuses an early-hint preload only
// when it is cacheable — a revalidated file (`public/`, `no-cache`) is fetched twice, and FCP got 100 ms worse in the
// EARLY-HINTS bench (fast loader, 100 ms RTT). Nothing else is learned from a render: the hints of one visitor's render
// go to every later visitor of the route, and a head built from loader data (a preconnect to a tenant's host, a
// per-user URL) would hand that out. Preconnects come from `links` only.
import type { Head, HeadLink } from "../shared/data.ts";

/** `createApp({ earlyHints })`. */
export interface EarlyHintsOptions {
  /** Also hint the resume runtime entry (`rel=modulepreload`): pages that start it early (visible preloads). Default false. */
  readonly runtime?: boolean;
  /** Extra `Link` values sent as given, e.g. `"<https://cdn.example>; rel=preconnect"`. */
  readonly links?: readonly string[];
}

/** Registered symbol: a per-request `(links) => void` the node adapter puts on the Request it builds (one writer of 103s). */
export const EARLY_HINTS = Symbol.for("rivet.earlyHints");
export type HintWriter = (links: readonly string[]) => void;

// A URL written into a header value: no whitespace / controls, nothing that ends the `<…>` or splits the list.
const SAFE = /^[^\s\0-\x1f\x7f<>"',;\\]+$/;
const TOKEN = /^[\w./+-]+$/;

/** Whether `url` is a build asset below `base` (hashed file name, served immutable). */
export const isAsset = (url: string, base: string): boolean => url.startsWith(base + "/assets/");

/** `<url>; rel=preload; as=style` per linked (not inlined) build-asset stylesheet. */
export function styleLinks(urls: readonly string[], inline: Readonly<Record<string, string>> | undefined, base = ""): string[] {
  const out: string[] = [];
  for (const url of urls) if (!(inline && Object.hasOwn(inline, url)) && SAFE.test(url) && isAsset(url, base)) out.push(`<${url}>; rel=preload; as=style`);
  return out;
}

/**
 * Build-asset font preloads of a merged head: build files are the same for every visitor; anything else in a head may
 * come from loader data (preconnects, images) and is left out.
 */
export function headLinks(head: Head | undefined, base = ""): string[] {
  const out: string[] = [];
  for (const link of head?.links ?? []) {
    const value = linkValue(link, base);
    if (value) out.push(value);
  }
  return out;
}

function linkValue(link: HeadLink, base: string): string | undefined {
  if (!SAFE.test(link.href)) return undefined;
  const rel = link.rel.toLowerCase();
  const cors = link.crossorigin === "use-credentials" ? "; crossorigin=use-credentials" : link.crossorigin ? "; crossorigin" : "";
  if (rel === "preload" && link.as === "font" && isAsset(link.href, base))
    return `<${link.href}>; rel=preload; as=font${link.type && TOKEN.test(link.type) ? "; type=" + link.type : ""}${cors}`;
  return undefined;
}

/** Per route id: its `Link` values, re-derived when the learned head links change. */
export interface Hinter {
  links(routeId: string): readonly string[];
  /** A render's merged head: its build-asset font preloads become the route's from now on. */
  learn(routeId: string, head: Head | undefined): void;
}

/** `createApp`'s hinter: `styles` + the route's `routeStyles` (not inlined), learned head links, `links`, the runtime. */
export function createHinter(
  option: true | EarlyHintsOptions,
  app: {
    readonly styles: readonly string[];
    readonly routeStyles?: Readonly<Record<string, readonly string[]>> | ((routeId: string) => unknown);
    readonly inlineFor?: (list: readonly string[]) => Readonly<Record<string, string>> | undefined;
    readonly base: string;
    readonly runtime?: string | undefined;
  },
): Hinter {
  const extra =
    option === true
      ? []
      : [...(option.links ?? []), ...(option.runtime && app.runtime && SAFE.test(app.runtime) ? [`<${app.runtime}>; rel=modulepreload`] : [])];
  const learned = new Map<string, string>();
  const memo = new Map<string, readonly string[]>();
  return {
    links(routeId) {
      let links = memo.get(routeId);
      if (links) return links;
      const own = app.routeStyles && typeof app.routeStyles !== "function" ? app.routeStyles[routeId] : undefined;
      const list = own?.length ? [...app.styles, ...own] : app.styles;
      const head = learned.get(routeId);
      links = [...styleLinks(list, app.inlineFor?.(list), app.base), ...(head ? head.split("\n") : []), ...extra];
      memo.set(routeId, links);
      return links;
    },
    learn(routeId, head) {
      const value = headLinks(head, app.base).join("\n");
      if (value !== (learned.get(routeId) ?? "")) (value ? learned.set(routeId, value) : learned.delete(routeId), memo.delete(routeId));
    },
  };
}
