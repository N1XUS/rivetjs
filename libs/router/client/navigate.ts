// Programmatic navigation for file-routed apps. Requests queue here and reach the app's router
// through a `rivet:go` document event its generated `App` listens to (the same delegated router the
// link interception uses), so they work from any code without a router reference: CSR, dev mounts
// and resumed pages (whose runtime and App chunk may not have booted yet). The App listens only when
// the app uses this module (`rivetRouter` detects it; its routes element then carries
// `data-rivet-go`); otherwise requests load the document at once.
import type { LinkHref } from "../index.ts";
import type { Head, LoaderDeps } from "../shared/data.ts";
import { underBase, withBase } from "../shared/base.ts";
import { slashPath, TRAILING_SLASH } from "../shared/slash.ts";

/** Options of `navigate()`. */
export interface NavigateOptions {
  /** Replace the current history entry instead of pushing one. */
  replace?: boolean;
  /** App keys merged into the new entry's `history.state` (the router adds `i` and `rivet`). */
  state?: Readonly<Record<string, unknown>>;
  /** `false`: keep the scroll position instead of scrolling to the top / `#hash` target. */
  scroll?: boolean;
  /** `false`: leave focus where it is instead of moving it to the new page's heading. */
  focus?: boolean;
  /** View transition types for this navigation (like `<Link transition>`); `false`: no animation. */
  transition?: string | readonly string[] | false;
}
/** @internal A queued request, served by the app router (`_serve`). */
export interface NavigateRequest extends NavigateOptions {
  readonly url: URL;
  /** Same URL, fresh route data (`invalidate()`); data already in hand skips the request; a key test reruns matching loaders only. */
  readonly invalidate?: true | FreshData | ((key: string) => boolean);
  readonly done: () => void;
}

const queue: NavigateRequest[] = [];
/** @internal Take the queued requests (the app router serves them). */
export const _take = (): NavigateRequest[] => queue.splice(0);
/**
 * @internal The router brand's entry (`_brand`, booted App only: its `rivet:go` listener serves the request): a
 * navigation (outside the base path: a document load) or, with `invalidate`, fresh data for the shown URL.
 */
export function _go(url: URL, invalidate?: true | FreshData): Promise<void> {
  if (!invalidate && !underBase(url.pathname)) return (location.assign(url.href), new Promise<void>(() => {}));
  if (!invalidate && TRAILING_SLASH !== "ignore") url.pathname = slashPath(url.pathname, TRAILING_SLASH);
  return new Promise<void>((done) => {
    queue.push({ url, ...(invalidate ? { invalidate } : {}), done });
    document.dispatchEvent(new CustomEvent("rivet:go"));
  });
}

type Loader = { b?(): void; r?(): unknown };
// Unserved requests wait this long for the router, then load the document.
const WAIT = 10_000;

/** Route data in the data-endpoint shape (an enhanced action's single-flight answer). */
export interface FreshData {
  readonly data?: readonly unknown[];
  readonly head?: Head;
  /** The loaders' `event.depends()` keys (the answer's `deps`). */
  readonly deps?: LoaderDeps;
}
/**
 * What `invalidate()` reruns: loaders that called `event.depends(key)` with a matching key — one key
 * (a `URL` counts as its `href`), any of a list, or those a predicate accepts (it gets each key).
 */
export type InvalidateTarget = string | URL | readonly (string | URL)[] | ((key: string) => boolean);

function serve(url: URL, options: NavigateOptions & { invalidate?: NavigateRequest["invalidate"] }, fallback: () => void): Promise<void> {
  return new Promise<void>((resolve) => {
    const d = document;
    const ask = () => pending() && d.dispatchEvent(new CustomEvent("rivet:go"));
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Only the resumed-page wait (below) listens.
    const settle = () => timer && (clearTimeout(timer), d.removeEventListener("rivet:attach", ask));
    const request: NavigateRequest = { ...options, url, done: () => (settle(), resolve()) };
    const pending = () => queue.includes(request);
    const drop = () => (settle(), queue.splice(queue.indexOf(request), 1), fallback());
    queue.push(request);
    ask();
    if (!pending()) return;
    // No App listening (the app was built without navigate() detected) or no resume loader: a document load.
    const loader = (d as Document & { $r?: Loader }).$r;
    if (!loader || !d.querySelector("[data-rivet-go]")) return drop();
    // Resumed page: the App's listener attaches when the resume runtime drains its pending listeners (at idle, or
    // before the first delegated handler runs) and says so (`rivet:attach`): ask again then; its chunk loads on the
    // first `rivet:go`. Boot the runtime now; no answer within WAIT: a document load.
    d.addEventListener("rivet:attach", ask);
    timer = setTimeout(() => pending() && drop(), WAIT);
    if (!loader.r?.()) loader.b?.();
  });
}

/**
 * Navigate like a link click, from anywhere (event handlers, effects, other libraries): same
 * `rivet:navigate` (cancelable) event, transitions, pending state, announcer, focus and scroll
 * bookkeeping. Resolves once the new page committed (or immediately for a hash-only change, a
 * canceled navigation or the current URL). `to` strings starting with `/` are app paths (the URL base
 * path is added). Cross-origin URLs, URLs outside the base and pages without a client router load
 * the document (`location.assign`; the promise then never settles). Non-HTTP(S) URLs reject.
 */
export function navigate(to: LinkHref | (string & {}) | URL, options: NavigateOptions = {}): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("navigate() needs a browser"));
  // App paths (`/items/1`) get the URL base path; full and relative URLs are taken as they are.
  const url = new URL(typeof to === "string" ? withBase(to) : to, location.href);
  if (!/^https?:$/.test(url.protocol)) return Promise.reject(new TypeError("navigate() requires an HTTP(S) URL"));
  const load = () => location[options.replace ? "replace" : "assign"](url.href);
  // Another origin, or outside the app's base path: a document load.
  if (url.origin !== location.origin || !underBase(url.pathname)) {
    load();
    return new Promise<void>(() => {});
  }
  // `rivetRouter({ trailingSlash })`: the app's paths in their canonical form (folded away by default).
  if (TRAILING_SLASH !== "ignore") url.pathname = slashPath(url.pathname, TRAILING_SLASH);
  return serve(url, options, load);
}

/**
 * Re-run the current page's loaders (fresh route data for the same URL) and re-render it in place:
 * no history entry, transition, scroll or focus move (the focused control keeps focus by id). Also
 * clears the intent-prefetch cache. `fresh` (data in the data-endpoint shape, such as an enhanced
 * action's single-flight answer) skips the request. Resolves when the fresh page committed; without
 * a client router the document reloads.
 *
 * `invalidate(key | keys | (key) => boolean)`: only the loaders whose `event.depends()` keys match
 * rerun (one data request; the others are kept). The page re-renders when its own loader reruns;
 * otherwise only the layouts that reran update in place. Nothing matches: no request. Keys not known
 * yet (dev mounts, apps without layouts before their first client navigation): every loader reruns.
 */
export function invalidate(target?: FreshData | InvalidateTarget): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  return serve(new URL(location.href), { invalidate: invalidation(target) }, () => location.reload());
}
const href = (key: string | URL): string => (typeof key === "string" ? key : key.href);
function invalidation(target: FreshData | InvalidateTarget | undefined): NavigateRequest["invalidate"] {
  if (typeof target === "function") return target;
  if (typeof target === "string" || target instanceof URL) {
    const key = href(target);
    return (k) => k === key;
  }
  if (Array.isArray(target)) {
    const keys = new Set((target as readonly (string | URL)[]).map(href));
    return (k) => keys.has(k);
  }
  return (target as FreshData | undefined)?.data ? (target as FreshData) : true;
}
/** Alias of `invalidate()`. */
export const revalidate: typeof invalidate = invalidate;

/**
 * Navigate to the current path with new search params (the hash is dropped). `update`: the new
 * params, or a function of a copy of the current ones. Like any search change, the route re-runs
 * (loaders, page re-render); scroll and focus stay unless `scroll` / `focus` say otherwise.
 */
export function setSearchParams(
  update: URLSearchParams | Record<string, string> | ((current: URLSearchParams) => URLSearchParams | Record<string, string> | void),
  options: NavigateOptions = {},
): Promise<void> {
  const url = new URL(location.href);
  const current = new URLSearchParams(url.search);
  const next = typeof update === "function" ? (update(current) ?? current) : update;
  url.search = new URLSearchParams(next as URLSearchParams | Record<string, string>).toString();
  url.hash = "";
  return navigate(url, { scroll: false, focus: false, ...options });
}
