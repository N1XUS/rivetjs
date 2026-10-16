// Document prefetch (`<Link prefetch="document" | "prerender">`, `rivetRouter({ prefetch })`): the tags
// every page's head gets when the app uses it, and the prerender helper for app code.
// Web-standard, no DOM at import time: the server entry wraps the document shell with `documentPrefetch`,
// browser code may import `whenActivated` alone (the rest tree-shakes away).
import type { DocumentShell } from "../server/render.ts";
import { FALLBACK } from "./prefetch-fallback.min.ts";

/** What a link loads ahead of a document navigation: the HTML (`document`) or the whole page in the background (`prerender`). */
export type DocumentPrefetch = "document" | "prerender";
/**
 * When Chromium acts on the rules (Speculation Rules `eagerness`): `conservative` on pointer / touch
 * down, `moderate` also after the pointer rests on a link ~200 ms, `eager` sooner still (on desktop:
 * a short hover; Chromium decides the exact heuristics).
 */
export type PrefetchEagerness = "conservative" | "moderate" | "eager";

/** Document prefetch options (Speculation Rules with a fallback). */
export interface DocumentPrefetchOptions {
  /**
   * App default (`rivetRouter({ prefetch })`): links without their own `data-rivet-prefetch` choice
   * (plain `<a>` too) prefetch this way. Absent: only links marked `document` / `prerender`.
   */
  readonly default?: DocumentPrefetch;
  /**
   * The client router intercepts same-app links (every server / static app with more than one
   * route): those navigations never load a document (the router prefetches their data + page chunk
   * on intent itself), so only links that load documents take part: `data-rivet-reload` /
   * `rel=external` links, and — with `routes` — links whose path no route matches.
   */
  readonly routed?: boolean;
  /**
   * RegExp source over `URL.pathname.slice(1)` matching every path a route of the app (page or
   * endpoint) matches (generated: `routePathRegExp` in `build/codegen.ts`). Links to other paths load
   * documents and take part; endpoint paths never do (only when marked `reload`). Implies `routed`.
   */
  readonly routes?: string;
  /** Speculation Rules eagerness (`rivetRouter({ prefetchEagerness })`); default `moderate`. The fallback keeps its own intent timing. */
  readonly eagerness?: PrefetchEagerness;
}

/** Links the browser would navigate in this tab (no download, no other target). */
const SAME_TAB = ":not([download],[target]:not([target=_self]))";

/** Links of a client-routed app that load a document whatever their path (the router never intercepts them). */
const RELOAD = "[data-rivet-reload],[rel~=external]";

/**
 * CSS selector of the links prefetched with `kind` (`"all"`: either kind). Routed apps: only
 * `data-rivet-reload` / `rel=external` links — with `routes`, path-based detection is not a selector
 * (see `speculationRules`), so the selector leaves it out.
 */
export function prefetchSelector(kind: DocumentPrefetch | "all", options: DocumentPrefetchOptions = {}): string {
  const marked = kind === "all" ? "a[data-rivet-prefetch=document],a[data-rivet-prefetch=prerender]" : `a[data-rivet-prefetch=${kind}]`;
  const any = options.default && (kind === "all" || options.default === kind) ? ",a:not([data-rivet-prefetch])" : "";
  return `:is(${marked}${any})[href]${options.routed && options.routes === undefined ? `:is(${RELOAD})` : ""}${SAME_TAB}`;
}

/** URLPattern-escape a path (`:` `*` `?` `+` `(` `)` `{` `}` `\` are syntax). */
const pattern = (path: string) => path.replace(/[\\:*?+(){}]/g, "\\$&");
/** Script text is JSON: `<` escaped so no `</script` can close it. */
const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * Speculation Rules (Chromium) for a page at `url`: document rules over the prefetch selectors,
 * same origin only (`/*`), not the page itself (either trailing-slash form), `moderate` eagerness by default (pointer resting ~200 ms on a
 * link, or pointer down). The browser applies them to links added later too (no registry needed).
 */
export function speculationRules(url: URL, options: DocumentPrefetchOptions = {}): string {
  // The page's own path with or without its trailing slash (`/a` and `/a/` are the same page by default).
  const path = url.pathname.replace(/\/+$/, "");
  const self = path ? pattern(path) + "{/}?" : "/";
  // Routed app with its route paths: a reload link, or a path no route matches (URLPattern regexp group).
  const routes = options.routes;
  const documents = routes === undefined ? [] : [{ or: [{ selector_matches: RELOAD }, { not: { href_matches: routes ? "/(" + routes + ")" : "/" } }] }];
  const rule = (kind: DocumentPrefetch) => [
    {
      source: "document",
      where: { and: [{ href_matches: "/*" }, { not: { href_matches: self } }, { selector_matches: prefetchSelector(kind, options) }, ...documents] },
      eagerness: options.eagerness ?? "moderate",
    },
  ];
  return json({ prefetch: rule("document"), prerender: rule("prerender") });
}

/** Head tags: the rules (Chromium) and the inline fallback (`<link rel=prefetch>` / `fetch` on intent elsewhere). */
export function prefetchTags(url: URL, nonce: string | undefined, options: DocumentPrefetchOptions = {}): string {
  const attr = nonce !== undefined ? ` nonce="${nonce.replace(/[^\w+/=-]/g, "")}"` : "";
  const selector = prefetchSelector("all", options);
  // Routed app with its route paths: the fallback applies the same path rule (a RegExp literal: the source
  // escapes every `/`, and `<` / line terminators are percent-encoded in it).
  const routes = options.routes === undefined ? "" : ",/^\\/(?:" + options.routes + ")$/";
  return (
    `<script type="speculationrules"${attr}>${speculationRules(url, options)}</script>` + `<script${attr}>${FALLBACK}(${json(selector)}${routes})</script>`
  );
}

/** Wrap a document shell: every page gets the prefetch tags right before `</head>` (generated `entry.server.tsx`). */
export function documentPrefetch(shell: DocumentShell, options: DocumentPrefetchOptions = {}): DocumentShell {
  // Written into the page as a RegExp literal: no `<` (`</script`), no line terminator, no unescaped `/`.
  if (options.routes !== undefined && /[<\n\r\u2028\u2029]|(^|[^\\])(\\\\)*\//.test(options.routes))
    throw new TypeError("documentPrefetch: invalid routes source");
  return (input) => {
    const parts = shell(input);
    const tags = prefetchTags(input.url, input.nonce, options);
    const at = parts.start.lastIndexOf("</head>");
    return at < 0 ? { start: parts.start + tags, end: parts.end } : { start: parts.start.slice(0, at) + tags + parts.start.slice(at), end: parts.end };
  };
}

/**
 * Run `fn` now, or — on a page the browser is prerendering (`<Link prefetch="prerender">`) — once the
 * user actually navigates to it (`prerenderingchange`). For page-view analytics and other "the user
 * saw this page" side effects. No-op outside a browser.
 */
export function whenActivated(fn: () => void): void {
  if (typeof document === "undefined") return;
  if ((document as { prerendering?: boolean }).prerendering) document.addEventListener("prerenderingchange", () => fn(), { once: true });
  else fn();
}
