// Client side of file routes: route data over the data endpoint, link interception, intent
// prefetch, scroll restoration and focus. Every export is a no-op or server-safe outside a browser.
import { effect, onCleanup, useContext, type Context } from "@rivetjs/reactivity";
import { _decodeWire } from "@rivetjs/runtime/resume-format";
import { compileRoutes, _popGate, type RouteMatch } from "@rivetjs/runtime/router";
import { HttpError } from "../shared/errors.ts";
import { underBase } from "../shared/base.ts";
import { DATA_PARAM, KEEP_PAGE, KEEP_PARAM, withoutRivet, type Head, type LoaderDeps, type RoutePayload } from "../shared/data.ts";
import { Navigation, _searchSync, type NavigationState, type NavigationType } from "./navigation.ts";
import { _guard } from "./leave.ts";
import { _take as _requests, type _go, type NavigateRequest } from "./navigate.ts";
import { announce } from "./announce.ts";
import { enter, focusOn, fragmentTarget, leave, restoreScroll, reveal } from "./scroll.ts";
import {
  _building,
  _bump,
  _lastMatch,
  _depsLoaded,
  _invalidating,
  _keepIds,
  _plan,
  _refreshed,
  _stale,
  type InvalidationPlan,
  type LayoutTable,
  type Layouts,
} from "./layouts.ts";
export { _layouts, _level, _enter, _take, _landed, _sync, _keepIds, type LayoutTable, type Layouts } from "./layouts.ts";
export { beforeLeave, type LeaveEvent } from "./leave.ts";
export type { ActionResult, Head, RoutePayload } from "../shared/data.ts";
export { Navigation, navigation, IDLE, type NavigationState, type NavigationType } from "./navigation.ts";
// The router's typed navigation component (also `@rivetjs/router/link`).
export { Link, type LinkProps } from "./link.tsx";
export { currentOf, _markActive, type ActiveMode } from "./active.ts";
export { navigate, invalidate, revalidate, setSearchParams, _go, type NavigateOptions, type FreshData, type InvalidateTarget } from "./navigate.ts";
export { useParams, useSearchParams, RouteParamsContext } from "./params.ts";
export { SearchParams } from "./search.ts";
export { _live, _livePage, _liveRouter, _armLive, _liveIntent, _liveLevels, _serveLive, type LivePage } from "./live.ts";
// Server render input and action results (no `.tsx` imports: Node loads it in tests).
import { ServerData, type ServerRoutePayload } from "./route-context.ts";
export { ServerData, actionResult, type ServerRoutePayload } from "./route-context.ts";

/** @internal The app router as the client drives it. */
export interface Navigator {
  navigate?(to: string | URL, options?: { replace?: boolean; revalidate?: boolean }): void;
}
interface Work {
  readonly signal: AbortSignal;
  get<T>(token: Context<T>): T;
}

/**
 * Where client navigation gets route data: the server's data endpoint, prerendered `_data.json`
 * files (static adapter) or nowhere (CSR adapter: pages render without loader data).
 */
export type DataSource = "server" | "static" | "none";
const PREFETCH_TTL = 5_000,
  PREFETCH_MAX = 32;
// Warmed data requests by URL (path + query), oldest first; `keep`: the keep list they were sent with.
type Warm = { at: number; keep: string; response: Promise<Response>; stop: AbortController };
const prefetched = new Map<string, Warm>();
// Drop warmed requests (all, or all but `except`'s), aborting them: unread bodies are released.
function dropPrefetch(except?: string, now?: number): void {
  for (const [url, warm] of prefetched) if (url !== except && (now === undefined || now - warm.at >= PREFETCH_TTL)) (prefetched.delete(url), warm.stop.abort());
}

/** URL of a page's data for client navigation; `keep`: ids of layouts whose data the client has. */
export function dataURL(url: URL, source: DataSource = "server", keep?: string): string {
  if (source === "static") return url.pathname.replace(/\/?$/, "/") + "_data.json";
  // The page's query as written (not re-serialized), the router's params appended; never the page
  // URL's own `_rivet_keep`: only what this client keeps.
  const search = withoutRivet(url.search);
  return url.pathname + (search ? search + "&" : "?") + DATA_PARAM + "=data" + (keep ? "&" + KEEP_PARAM + "=" + encodeURIComponent(keep) : "");
}
const key = (url: URL) => url.pathname + url.search;

// Fresh data handed to `invalidate(fresh)` (an action's single-flight answer), for the next load of its URL.
let seeded: { key: string; body: { data?: unknown[]; head?: Head; deps?: LoaderDeps } } | null = null;

function request(url: URL, source: DataSource, signal?: AbortSignal, keep?: string): Promise<Response> {
  const cached = prefetched.get(key(url));
  prefetched.delete(key(url));
  // Warmed with another keep list (layout state changed since the intent): its answer would be wrong.
  if (cached && Date.now() - cached.at < PREFETCH_TTL && cached.keep === (keep ?? "")) return cached.response;
  cached?.stop.abort();
  return fetch(dataURL(url, source, keep), { signal, headers: { accept: "application/json" }, credentials: "same-origin" });
}

/** `promise`, or a rejection with the signal's reason once it aborts (whichever comes first). */
function settled<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(signal.reason);
    signal.addEventListener("abort", stop, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

/** Decode a data-endpoint body (resume table encoding; built-in entries load their decoders first, `x`). */
export function decodeData(text: string): Promise<unknown> {
  return _decodeWire(text);
}

/**
 * @internal Server render of a generated route level: the handler's loader results (`ServerData`) through the
 * route's result chain synchronously (`ok` / `fail` as the `then` steps of the browser chain, then `land`) — no
 * `Promise.all` / `then` hops per request, no page import (the lazy page view loads itself, rendering
 * synchronously once its module is in). Browser (and no `ServerData`): undefined, the generated chain runs.
 */
export function _ssrLevel<R, T>(work: Work, ok: (data: RoutePayload) => R, fail: (cause: unknown) => R, land: (result: R) => T): T | undefined {
  if (typeof document !== "undefined") return undefined;
  const server = work.get(ServerData);
  if (!server) return undefined;
  let result: R;
  try {
    result = server.error ? fail(new HttpError(server.error.status, server.error.message)) : ok(server);
  } catch (cause) {
    result = fail(cause);
  }
  return land(result);
}

/**
 * Route `load` for generated routes. On the server the handler already ran guards and loaders and
 * provides them through `ServerData`; in the browser it fetches the data endpoint, which runs the
 * same guards. Redirects navigate (replace); failures throw `HttpError` for the route's error view.
 */
const used = new WeakSet<ServerRoutePayload>();
/** Load a generated route's data: from `ServerData` on the server, from the data endpoint in the browser. */
export async function routeData(work: Work, match: { url: URL }, router: Navigator, source: DataSource = "server", keep?: string): Promise<RoutePayload> {
  const server = work.get(ServerData);
  // In the browser (dev mounts) the provided data answers the first load only; later ones fetch.
  if (server && !used.has(server)) {
    if (typeof document !== "undefined") (used.add(server), _depsLoaded(match.url, server.data.length, server.deps));
    if (server.error) throw new HttpError(server.error.status, server.error.message);
    return server;
  }
  if (source === "none") return { data: [] };
  type Body = {
    data?: unknown[];
    head?: Head;
    keep?: number[];
    byURL?: number[];
    deps?: LoaderDeps;
    redirect?: string;
    reload?: true;
    error?: { status: number; message: string };
  };
  let body: Body;
  // `invalidate(fresh)` / `revalidate(fresh)` (an action's single-flight answer): no request.
  const seed = seeded;
  seeded = null;
  if (seed && seed.key === key(match.url)) body = seed.body;
  else {
    // A warmed request is not tied to this load's signal: race it, so a superseded load ends now.
    const response = await settled(request(match.url, source, work.signal, keep), work.signal);
    if (source === "static" && response.status === 404) throw new HttpError(404, "Not found");
    // Not the data endpoint's JSON (a proxy error page, an HTML fallback): the document load shows it.
    // Malformed JSON stays an error (the route's error view; the dev overlay).
    body = /json/.test(response.headers.get("content-type") ?? "json")
      ? ((await decodeData(await settled(response.text(), work.signal))) as Body)
      : { reload: true };
  }
  // The user navigated on meanwhile: no side effects (title, redirects, document loads) for this one.
  work.signal.throwIfAborted();
  // A guard or request handler answered with a non-redirect Response: load the document instead.
  if (body.reload) {
    location.assign(match.url.href);
    return new Promise<RoutePayload>(() => {});
  }
  if (body.redirect !== undefined) {
    const target = new URL(body.redirect, location.href);
    // A target no page route matches (an endpoint, another app on the origin) loads its document.
    if (target.origin === location.origin && underBase(target.pathname) && router.navigate && (!routable || routable(target))) {
      started({ from: current?.from ?? new URL(committed), to: target, type: "replace", trigger: "redirect" });
      go(router, target, true);
    } else
      // Only HTTP(S) targets (never `javascript:`/`data:`): anything else loads the page's document,
      // where the browser applies the server's real answer.
      location.assign(/^https?:$/.test(target.protocol) ? target.href : match.url.href);
    // The navigation replaces this region; never settle.
    return new Promise<RoutePayload>(() => {});
  }
  if (body.error) throw new HttpError(body.error.status, body.error.message);
  _depsLoaded(match.url, body.data?.length ?? 0, body.deps, body.keep);
  if (body.head?.title !== undefined) document.title = body.head.title;
  return {
    data: body.data ?? [],
    ...(body.head ? { head: body.head } : {}),
    ...(body.keep ? { kept: body.keep } : {}),
    ...(body.byURL ? { byURL: body.byURL } : {}),
  };
}

/** A route module's `head` export: tags, or a function of the level's data, the params and the URL. */
type HeadExport = Head | ((input: { data: unknown; params: unknown; url: URL }) => Head | undefined);
/**
 * @internal CSR apps (`mode: "csr"`: no server writes the head): the route's head from its modules' `head` exports —
 * `layouts` outermost first (their module namespaces), then the loaded `page` module — on every route load, the first
 * render included. Sets `document.title` (the innermost title, the innermost `titleTemplate` applied once). `merge`
 * (component head: kit `applyRouteHead` applies the rest): the whole merged head goes on the result.
 */
export function _csrHead<T extends { data: readonly unknown[] }>(
  result: T,
  layouts: readonly unknown[],
  page: unknown,
  match: { params: unknown; url: URL },
  merge?: (entries: readonly { level: number; phase: 0; seq: number; head: Head }[]) => Head | undefined,
): T {
  const heads = [...layouts, page].map((module, level) => {
    const head = (module as { head?: HeadExport } | undefined)?.head;
    return typeof head === "function" ? head({ data: result.data[level], params: match.params, url: match.url }) : head;
  });
  let title: string | undefined, template: string | undefined;
  for (const head of heads) {
    if (head?.title !== undefined) title = head.title;
    if (head?.titleTemplate !== undefined) template = head.titleTemplate;
  }
  if (title !== undefined) document.title = template === undefined ? title : template.replace("%s", title);
  if (!merge) return result;
  const head = merge(heads.flatMap((head, level) => (head ? [{ level, phase: 0 as const, seq: 0, head }] : [])));
  return head ? { ...result, head } : result;
}

/**
 * Same-origin, same-document-eligible anchor for a click/hover event, else null. With the app's page
 * `modules`, a URL no page route matches (an endpoint, a file, another app on the origin) is not
 * routable either: the browser loads its document (no data request, no chunk prefetch).
 */
export function routableAnchor(event: Event, modules?: ModuleTable): HTMLAnchorElement | null {
  if (typeof Element === "undefined" || !(event.target instanceof Element)) return null;
  const anchor = event.target.closest("a");
  if (!anchor || !anchor.href || anchor.hasAttribute("download") || anchor.hasAttribute("data-rivet-reload")) return null;
  if ((anchor.target && anchor.target !== "_self") || /(^|\s)external(\s|$)/.test(anchor.rel)) return null;
  const url = new URL(anchor.href);
  // Outside the app's URL base path: the browser loads it.
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || !underBase(url.pathname)) return null;
  if (!modules) return anchor as HTMLAnchorElement;
  routable ??= (to) => isPage(to, modules);
  return isPage(url, modules) ? (anchor as HTMLAnchorElement) : null;
}

let traversal = false;
// `rivetRouter({ announce: false })`: no route announcer.
let quiet = false;

/** One client navigation, from its start to its commit (`rivet:navigate` event detail, `onNavigate`). */
export interface NavigationInfo {
  readonly from: URL | null;
  readonly to: URL;
  readonly type: NavigationType;
  readonly trigger: "link" | "api" | "popstate" | "redirect";
  /** The clicked anchor (link navigations). */
  readonly anchor?: HTMLAnchorElement;
  /** The link's `data-transition` (`<Link transition>`). */
  readonly transition?: string | null;
  /** Popstate the browser already animated (`hasUAVisualTransition`, e.g. a swipe). */
  readonly visual?: boolean;
  /** @internal The page module's `transition` export, once its chunk is in. */
  route?: unknown;
}
/** @internal Hooks installed by `@rivetjs/router/transitions` once it loads. */
export const _transitions: {
  start?(nav: NavigationInfo): void;
  swap?(apply: () => void, next: ParentNode, nav: NavigationInfo): void;
} = {};
const listeners = new Set<(nav: NavigationInfo) => void | (() => void)>();
let current: NavigationInfo | null = null;
let afters: (() => void)[] = [];
// The URL the routes region shows, and the history index of the current entry (`history.state.i`).
let committed = typeof location === "undefined" ? "" : location.href;
const entryIndex = (): number => (history.state as { i?: number } | null)?.i ?? 0;
let index = typeof history === "undefined" ? 0 : entryIndex();
// Back/forward guards (`beforeLeave`): a cancelled popstate moves neither the runtime router nor this client.
const popBlocked = (event: Event): boolean => !!_guard.blocked?.(event, committed, index);
_popGate.blocked = popBlocked;

/**
 * Run `fn(nav)` when a client navigation starts (link, back/forward, redirect); a function it
 * returns runs once the new page is in the document. Returns an unsubscribe function.
 */
export function onNavigate(fn: (nav: NavigationInfo) => void | (() => void)): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
function started(nav: NavigationInfo): void {
  if (recovering === undefined) ((recovering = false), addEventListener("error", recover), addEventListener("unhandledrejection", recover));
  // Warmed data for other URLs is no longer wanted: abort it (the target's own stays for its load).
  dropPrefetch(key(nav.to));
  keep = 0;
  revalidating = false;
  current = nav;
  afters = [];
  for (const fn of listeners) {
    const after = fn(nav);
    if (typeof after === "function") afters.push(after);
  }
  _transitions.start?.(nav);
}
/** @internal Dev (`dev.ts`): the error overlay shows a failed navigation's error before its document loads. */
export const _recover: { defer?: (load: () => void) => void } = {};
// Listening (`false`, from the first navigation) / loading the document (`true`); `undefined`: not listening yet.
let recovering: boolean | undefined;
// The URL a navigation just committed (`swapRoute`; until the next frame): its page renders after the commit.
let rendering: string | undefined;
/**
 * A client navigation whose render or commit throws (an uncaught error after the history push: before the routes
 * region committed the URL, or inside its swap) loads the URL's document instead: URL and page never diverge. `location.replace`: the
 * history entry is already there. A failing document load does not re-enter: once per URL within 10 s (session storage).
 */
function recover(): void {
  const href = location.href,
    at = Date.now();
  if (recovering || (href !== rendering && (!current || href === committed))) return;
  try {
    // `<13-digit ms><href>` of the last recovery.
    const last = sessionStorage["rivet:recover"] as string | undefined;
    if (last?.slice(13) === href && at - +last.slice(0, 13) < 1e4) return;
    sessionStorage["rivet:recover"] = at + href;
  } catch {
    // No session storage: recover without the cross-document loop guard.
  }
  recovering = true;
  (_recover.defer ?? ((load) => load()))(() => location.replace(href));
}
/** @internal The navigation in flight (read by the transitions module when it installs). */
export const _current = (): NavigationInfo | null => current;
/** @internal Run the `onNavigate` callbacks' after-swap functions. */
export function _afterSwap(): void {
  const list = afters;
  afters = [];
  for (const fn of list) fn();
  committedSearch();
}
/** @internal Generated load: remember the loaded page module's `transition` export for the swap. */
export function _routeModule(module: unknown): void {
  if (current) current.route = (module as { transition?: unknown } | undefined)?.transition;
}
/** Navigation state accessor: idle unless `transitions` is on. Resumed regions reading it update in place. */
export function useNavigation(): () => NavigationState {
  return useContext(Navigation);
}
// Navigate and number the new history entry (merged into its state), so back/forward know their direction.
function go(router: Navigator, url: URL, replace: boolean): void {
  router.navigate!(url, { replace });
  if (!replace) index++;
  enter(index);
}

/** Delegated click handler: route same-origin links through the router (`modules`: only URLs a page route matches). */
export function interceptClick(event: MouseEvent, router: Navigator, modules?: ModuleTable): void {
  if (!router.navigate || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = routableAnchor(event, modules);
  if (!anchor) return;
  const url = new URL(anchor.href);
  // Same page, another fragment (or the same one again): no route work, scroll to the target.
  if (url.pathname === location.pathname && url.search === location.search && (url.hash || location.hash)) {
    // Another fragment (`#` included), no route navigation in flight: the browser's own fragment navigation (`hashchange`,
    // `:target`, its history entry); its popstate keys the entry (`notePopstate`). The shown entry's position is saved now.
    if (url.href.includes("#") && url.href !== location.href && !current && !anchor.hasAttribute("data-rivet-replace")) {
      leave(true, index);
      fragment = url.href;
      return;
    }
    event.preventDefault();
    if (url.href !== location.href) {
      if (!current) leave(true, index);
      go(router, url, anchor.hasAttribute("data-rivet-replace"));
    }
    // During a route navigation its commit scrolls to the fragment.
    if (!current) {
      committed = location.href;
      reveal(url);
    }
    return;
  }
  event.preventDefault();
  if (url.href === location.href) return;
  const replace = anchor.hasAttribute("data-rivet-replace");
  const nav: NavigationInfo = {
    from: new URL(location.href),
    to: url,
    type: replace ? "replace" : "push",
    trigger: "link",
    anchor,
    transition: anchor.getAttribute("data-transition"),
  };
  // Cancelable (unsaved-changes guards: `beforeLeave`, or the event): the page stays.
  if (_guard.cancelled?.(url) || !document.dispatchEvent(new CustomEvent("rivet:navigate", { cancelable: true, detail: nav }))) return;
  leave(true, index);
  traversal = false;
  started(nav);
  go(router, url, replace);
}
// The URL of a same-document fragment link the browser is navigating to (`interceptClick` let it through).
let fragment: string | undefined;
/** Back/forward: the next settled route restores its saved position. */
export function notePopstate(event?: PopStateEvent): void {
  if (event && popBlocked(event)) return;
  if (fragment !== undefined) {
    const href = fragment;
    fragment = undefined;
    // The fragment link's own entry (pushed by the browser, scrolled to its target): number it, focus the target.
    if (href === location.href) {
      enter(++index);
      committed = href;
      const target = fragmentTarget(new URL(href));
      if (target) focusOn(target);
      return;
    }
  }
  traversal = true;
  const i = entryIndex();
  const from = new URL(committed),
    to = new URL(location.href);
  const nav: NavigationInfo = {
    from,
    to,
    type: i < index ? "back" : "forward",
    trigger: "popstate",
    visual: !!(event as { hasUAVisualTransition?: boolean } | undefined)?.hasUAVisualTransition,
  };
  index = i;
  // A synchronous route may have committed already (the router's own listener ran first).
  if (to.href === committed) return;
  // The page still shows the entry being left: save its position, then key the new one.
  leave(false, i);
  enter(i);
  if (!current && to.pathname === from.pathname && to.search === from.search) {
    // Hash-only traversal: the route stays; restore the entry's position, else reveal its target.
    traversal = false;
    committed = to.href;
    if (!restoreScroll()) reveal(to);
    return;
  }
  started(nav);
}

/** Router `swap` of generated apps: the view transition when installed, then scroll and focus. */
export function swapRoute(apply: () => void, next: ParentNode): void {
  // A nested level's first commit, inside the outer level's render: part of that commit.
  if (_building()) return apply();
  const href = location.href;
  if (revalidating && href === committed) return revalidated(apply);
  let nav = current;
  current = null;
  if (!nav && href !== committed) {
    nav = { from: new URL(committed), to: new URL(href), type: "push", trigger: "api" };
    // Programmatic navigation: the old page is still shown; save its position, key the new entry.
    leave(false, index);
    enter((index = (history.state as { i?: number } | null)?.i ?? index + 1));
  }
  committed = href;
  // Until the next frame's first task (the routes region renders the new page after the swap, up to a frame later), an
  // uncaught error is this navigation's (`recover`).
  if (nav) ((rendering = href), requestAnimationFrame(() => setTimeout(() => rendering === href && (rendering = undefined))));
  if (nav && _transitions.swap) return _transitions.swap(apply, next, nav);
  apply();
  settle(new URL(href));
  _afterSwap();
}

/**
 * @internal live.ts: a search-only navigation of a live page committed in place (no route render): the
 * navigation in flight ends here, scroll and focus stay, `onNavigate` after-swap callbacks and waiters run.
 */
export function _inPlace(): void {
  const href = location.href;
  if (!current && href !== committed) {
    leave(false, index);
    enter((index = (history.state as { i?: number } | null)?.i ?? index + 1));
  }
  current = null;
  committed = href;
  traversal = false;
  keep = 0;
  _afterSwap();
}

/** `swapRoute` without the route announcer (generated apps of `rivetRouter({ announce: false })`). */
export function swapRouteQuiet(apply: () => void, next: ParentNode): void {
  quiet = true;
  swapRoute(apply, next);
}

/**
 * Router `hold` view of generated apps: on a resumed page's first client navigation the server
 * rendered route content stays visible (inert) until the new route commits, instead of a blank region.
 */
export function heldRoutes(level?: number): Node | null {
  if (typeof document === "undefined" || _building()) return null;
  // Nested levels: the Router region inside the persisted layout of the level above.
  const host = document.querySelector(level ? `[data-rivet-outlet="${level}"]` : "[data-rivet-routes]");
  const first = host?.firstChild,
    last = host?.lastChild;
  if (!first || !last || first === last || first.nodeType !== 8 || last.nodeType !== 8 || !/^r\d*\[$/.test((first as Comment).data)) return null;
  const held = document.createDocumentFragment();
  while (first.nextSibling !== last) held.append(first.nextSibling!);
  return held;
}

/** Warm a route's data on intent (pointer over / focus); `keep` as for `dataURL`. */
export function prefetchData(url: URL, source: DataSource = "server", keep?: string): void {
  if (source === "none") return;
  // A form submit may change what loaders return: warmed data from before it is stale.
  if (!watching) ((watching = true), addEventListener("submit", _clearPrefetch, true));
  const at = Date.now(),
    id = key(url);
  const existing = prefetched.get(id);
  if (existing && at - existing.at < PREFETCH_TTL && existing.keep === (keep ?? "")) return;
  // Expired entries go first; past the cap, the oldest.
  dropPrefetch(undefined, at);
  existing?.stop.abort();
  prefetched.delete(id);
  if (prefetched.size >= PREFETCH_MAX) {
    const [oldest, warm] = prefetched.entries().next().value!;
    prefetched.delete(oldest);
    warm.stop.abort();
  }
  const stop = new AbortController();
  const warm: Warm = {
    at,
    keep: keep ?? "",
    stop,
    response: fetch(dataURL(url, source, keep), { signal: stop.signal, headers: { accept: "application/json" }, credentials: "same-origin" }),
  };
  warm.response.catch(() => prefetched.get(id) === warm && prefetched.delete(id));
  prefetched.set(id, warm);
}

/**
 * Page routes in match order: `[pattern, page importer]`. Rows whose importer is `_endpoint` are
 * endpoints the server matches before a later dynamic page pattern that also fits them (generated).
 */
export type ModuleTable = readonly (readonly [string, () => unknown])[];
const matchers = new WeakMap<ModuleTable, (url: URL) => RouteMatch | null>();
/** @internal Generated `modules` row importer of an endpoint (its URLs load documents). */
export const _endpoint = (): void => {};
/** Import the page module of the route matching `url` (the import is shared with the render). */
export function loadModule(url: URL, modules: ModuleTable): Promise<unknown> | undefined {
  let match = matchers.get(modules);
  // Intent (every pointerover), the click and the navigation re-match the same path: remember the last answer.
  if (!match) matchers.set(modules, (match = _lastMatch(compileRoutes(modules.map(([path, load]) => ({ path, render: load }))))));
  const hit = match(url);
  return hit ? Promise.resolve(hit.route.render(undefined, hit)) : undefined;
}
/**
 * A page route of `modules` matches `url` (not an endpoint row). The first call builds the matcher
 * through `loadModule` (for a page URL that starts the import the click / intent starts next anyway).
 */
function isPage(url: URL, modules: ModuleTable): boolean {
  if (!matchers.has(modules)) loadModule(url, modules)?.catch(() => {});
  const hit = matchers.get(modules)!(url);
  return !!hit && hit.route.render !== _endpoint;
}
// Set by the first link check (apps without client routing carry none of it): data redirects to a
// URL no page route matches load the document.
let routable: ((url: URL) => boolean) | undefined;
/**
 * Page loader of generated apps: import the page module and ready its lazy component (browser
 * `lazyComponent(...).load`), so the route renders synchronously once loaded. Resolves the module.
 */
export function preloadPage(component: unknown, importer: () => Promise<unknown>): Promise<unknown> {
  // One load per page module (a failed one retries): the server renders this route on every request, and
  // a dynamic `import()` per call costs the module loader's resolve + job lookup each time.
  let loading = preloaded.get(importer);
  if (!loading) {
    const load = (component as { load?: () => Promise<unknown> }).load;
    const started = load ? Promise.all([importer(), load()]).then(([module]) => module) : importer();
    preloaded.set(importer, (loading = started));
    started.catch(() => preloaded.get(importer) === started && preloaded.delete(importer));
  }
  return loading;
}
const preloaded = new WeakMap<() => Promise<unknown>, Promise<unknown>>();
/** Load the page chunk of the route matching `url` on intent; false when no page route matches (nothing to prefetch). */
export function prefetchModule(url: URL, modules: ModuleTable): boolean {
  const loading = loadModule(url, modules);
  loading?.catch(() => {});
  return !!loading;
}

// A CSR app's first render is the page load, not a navigation: leave scroll and focus alone.
let initial: string | null = typeof location === "undefined" ? null : location.href;
let settles = 0;
/** After a client-rendered route settles: restore or reset scroll, honour #hash, move focus, announce. */
export function settle(url: URL): void {
  if (typeof document === "undefined") return;
  const first = initial;
  initial = null;
  if (first === url.href) return;
  const restore = traversal;
  traversal = false;
  const flags = keep;
  keep = 0;
  // Routes commit with their page chunk loaded: the heading is usually there already; nested lazy
  // components can still bring it a few frames later. Without one, wait while the document keeps
  // changing (a frame with no mutation settles), at most 30 frames.
  let frames = 0,
    changed = true,
    watch: MutationObserver | undefined;
  const id = ++settles;
  const run = () => {
    // A newer navigation settled meanwhile: it owns scroll and focus now.
    if (id !== settles) return void watch?.disconnect();
    const heading = document.querySelector<HTMLElement>("main h1, h1");
    if (!heading && !url.hash && changed && ++frames < 30) {
      if (!watch && typeof MutationObserver === "function")
        (watch = new MutationObserver(() => (changed = true))).observe(document.body, { childList: true, subtree: true });
      // No observer: frames only (the 30-frame bound).
      changed = !watch;
      return void requestAnimationFrame(run);
    }
    watch?.disconnect();
    const target = fragmentTarget(url);
    if (!(restore && restoreScroll()) && !(flags & KEEP_SCROLL)) {
      if (target) target.scrollIntoView();
      else scrollTo(0, 0);
    }
    if (!restore && !(flags & KEEP_FOCUS)) {
      const focus = target ?? heading ?? document.querySelector<HTMLElement>("main");
      if (focus) focusOn(focus);
    }
    if (!quiet) announce();
  };
  run();
}

/**
 * @internal Generated `App` of apps using `@rivetjs/forms` (codegen `forms`): every router handler (link click /
 * intent, popstate, `rivet:go`) first installs the router under `Symbol.for("rivet.router")` — `clear` (drop warmed
 * route data) and `go` (`navigate.ts` `_go`) — so forms reach it without importing this module (their chunks share
 * no router code with the App). The first install dispatches `rivet:router` on the document (forms waiting for the
 * router to boot). Assigned each call: a re-instantiated router module (dev HMR) replaces the old entry points.
 */
export function _brand(go: typeof _go): void {
  const key = Symbol.for("rivet.router"),
    first = !(globalThis as Record<symbol, unknown>)[key];
  (globalThis as Record<symbol, unknown>)[key] = { clear: _clearPrefetch, go };
  if (first) document.dispatchEvent(new Event("rivet:router"));
}

let watching = false;
/** Drop warmed route data (form submits and `invalidate()` do; call it after other mutations). */
export function _clearPrefetch(): void {
  dropPrefetch();
  // Layout data may be stale too: the next data request reloads every layout.
  _stale();
}

// `navigate()` / `invalidate()` (navigate.ts) served by the app router: the navigation in flight
// keeps scroll / focus (`keep`), invalidations re-render in place, `waiting` resolves on commit.
/** Navigation flag: keep the scroll position. */
export const KEEP_SCROLL = 1,
  /** Navigation flag: keep focus where it is. */
  KEEP_FOCUS = 2;
let keep = 0;
let revalidating = false;
let waiting: (() => void)[] = [];
function committedSearch(): void {
  _searchSync.shown = location.search;
  _searchSync.search?.();
  const list = waiting;
  waiting = [];
  for (const done of list) done();
}
// The page level reloads for the same URL (loaders the keep list leaves out rerun), re-rendering in place.
function rerun(router: Navigator, url: URL, done: () => void): void {
  _bump();
  revalidating = true;
  waiting.push(done);
  router.navigate!(url, { revalidate: true });
}
// `invalidate(key)` matching layout loaders only: one data request keeping every other loader (the
// page's too); the layouts that reran update in place, the page is not re-rendered.
async function refresh(router: Navigator, state: Layouts, table: LayoutTable, url: URL, plan: InvalidationPlan, done: () => void): Promise<void> {
  _invalidating(url, plan.drop);
  const keep = _keepIds(state, table, url);
  // A redirect or a navigation meanwhile commits another page: that commit resolves `done`.
  waiting.push(done);
  let result: RoutePayload;
  try {
    // Detached from any navigation (created here: a module-level controller would survive tree-shaking).
    const work: Work = { signal: new AbortController().signal, get: <T>() => null as T };
    result = await routeData(work, { url }, router, "server", keep ? keep + "," + KEEP_PAGE : KEEP_PAGE);
  } catch {
    // A failed loader: the page level reruns as well and renders the route's error view.
    waiting.splice(waiting.indexOf(done), 1);
    _invalidating(url, plan.drop);
    return rerun(router, url, done);
  }
  if (current || key(new URL(location.href)) !== key(url)) return;
  _refreshed(state, table, url, result);
  waiting.splice(waiting.indexOf(done), 1);
  done();
}
// Same page, fresh data: no transition, scroll or focus move; the focused control (by id) keeps focus.
function revalidated(apply: () => void): void {
  revalidating = false;
  const focused = document.activeElement?.id;
  apply();
  if (focused && document.activeElement?.id !== focused) document.getElementById(focused)?.focus({ preventScroll: true });
  committedSearch();
}

const armed = new WeakSet<object>();
/**
 * @internal Generated `App`: start its route effects (nested level sync, `<Link active>` re-marking) once per
 * router, from the first navigation entry point (link click, popstate, `rivet:go`) — not at load, so a resumed
 * page loads no router code before a navigation (Z1). Each runs as an effect owned by the caller's owner.
 */
export function _arm(router: object, ...effects: (() => void | (() => void))[]): void {
  if (armed.has(router)) return;
  armed.add(router);
  for (const fn of effects)
    effect(() => {
      const cleanup = fn();
      if (typeof cleanup === "function") onCleanup(cleanup);
    });
}

/**
 * @internal Generated `App`: serve queued `navigate()` / `invalidate()` requests (`rivet:go` event).
 * Server apps with layouts pass their layout state and table (`invalidate(key)` keeps loaders).
 */
export function _serve(router: Navigator, state?: Layouts, table?: LayoutTable): void {
  for (const request of _requests()) perform(router, request, state, table);
}
// `_serveLive` (live.ts) serves the requests it does not refresh in place through these.
export { perform as _perform, dropPrefetch as _dropPrefetch };
function perform(router: Navigator, request: NavigateRequest, state?: Layouts, table?: LayoutTable): void {
  const { url, done } = request;
  if (!router.navigate) return location.assign(url.href);
  const target = request.invalidate;
  if (typeof target === "function") {
    // `invalidate(key)`: warmed data may be stale (all of it is dropped); only matching loaders rerun.
    dropPrefetch();
    const plan = _plan(state, table, url, target);
    if (plan && !plan.any) return done();
    if (plan && !plan.page && state && table) return void refresh(router, state, table, url, plan, done);
    // Keys unknown: like `invalidate()`, every loader reruns.
    if (plan) _invalidating(url, plan.drop);
    else _stale();
    return rerun(router, url, done);
  }
  if (target) {
    _clearPrefetch();
    const fresh = target === true ? undefined : target;
    if (fresh?.data)
      seeded = { key: key(url), body: { data: [...fresh.data], ...(fresh.head ? { head: fresh.head } : {}), ...(fresh.deps ? { deps: fresh.deps } : {}) } };
    return rerun(router, url, done);
  }
  const replace = !!request.replace;
  const push = () => {
    router.navigate!(url, { replace });
    if (request.state) history.replaceState({ ...request.state }, "");
    if (!replace) index++;
    enter(index);
  };
  // Same page, another fragment: no route work (like a hash link).
  if (url.pathname === location.pathname && url.search === location.search && (url.hash || location.hash)) {
    if (url.href !== location.href) {
      if (!current) leave(true, index);
      push();
    }
    if (!current) {
      committed = location.href;
      if (request.scroll !== false) reveal(url);
    }
    return done();
  }
  if (url.href === location.href) {
    if (request.state) history.replaceState({ ...history.state, ...request.state }, "");
    return done();
  }
  const transition =
    request.transition === false ? "none" : typeof request.transition === "string" ? request.transition : (request.transition?.join(" ") ?? null);
  const nav: NavigationInfo = { from: new URL(location.href), to: url, type: replace ? "replace" : "push", trigger: "api", transition };
  // Same guards as a link click (`beforeLeave`, the cancelable event).
  if (_guard.cancelled?.(url) || !document.dispatchEvent(new CustomEvent("rivet:navigate", { cancelable: true, detail: nav }))) return done();
  leave(true, index);
  traversal = false;
  started(nav);
  keep = (request.scroll === false ? KEEP_SCROLL : 0) | (request.focus === false ? KEEP_FOCUS : 0);
  waiting.push(done);
  push();
}
