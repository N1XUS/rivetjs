// Live pages (`export const live = true` in a page module): the page's `data` prop is an accessor
// backed by a signal, and same-URL revalidation (an enhanced form submit, `invalidate()`, an
// `invalidate(key)` that reruns the page loader) updates it — and the layouts that reran — in place.
// The page is not re-rendered: page-local state (an open drawer, typed input, focus, scroll) survives.
// Search-only navigations of the shown live page (`?new` with JS, `setSearchParams`, back / forward between
// them) refresh it in place too (single-level apps: the top Router keys on the slot's `k`, not the URL; nested
// layout levels: `_sync` leaves every level key as it is, `_liveLevels`).
// Used by the generated `App` only when some page is live (pay-per-use: apps without one never import it).
import { batch, effect, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { _clearPrefetch, _current, _dropPrefetch, _inPlace, _perform, routeData, type DataSource, type Navigator } from "./index.ts";
import { _bump, _depsLoaded, _invalidating, _keepIds, _plan, _refreshed, _stale, _sync, type LayoutTable, type Layouts } from "./layouts.ts";
import { _take, type FreshData, type NavigateRequest } from "./navigate.ts";

/** @internal The App's live-page slot (resume state carries it): the shown live page's data signal and URL. */
export interface LivePage {
  /** Data source of the app (`server` / `static`). */
  readonly m: DataSource;
  /** The shown live page's data signal (unset: no live page rendered yet). */
  s?: Signal<unknown>;
  /** Its URL (`pathname + search`). */
  u?: string;
  /** Its index in the route data (= its layout count). */
  d?: number;
  /** Refresh generation: only the newest in-place refresh applies. */
  n?: number;
  /** Single-level apps: the top Router's key, set (`equals: false`: a same-URL revalidation re-runs the Router)
   * on every location change except a fragment-only one or a search-only one of the shown live page. */
  k?: Signal<string>;
  /** The shown URL without its fragment (what `k` was last set for, or the search-only URL refreshed in place). */
  h?: string;
  /** `k` follows the location (effect started by the first navigation entry point). */
  a?: true;
}

type Located = { location(): URL };
const pageOf = (url: URL): string => url.href.split("#")[0]!;

/** @internal Generated `App`: the live-page slot (`router`: single-level apps, whose top Router keys on `k`). */
export function _live(m: DataSource, router?: Located): LivePage {
  if (!router) return { m };
  const h = pageOf(untrack(router.location));
  return { m, k: signal(h, { equals: false }), h };
}

/** @internal Generated `App`: the top Router's navigator — route work keyed on the slot's `k`. */
export const _liveRouter = (router: Located, live: LivePage): Located => ({
  location() {
    live.k!();
    return untrack(router.location);
  },
});

/**
 * @internal Generated `App` navigation entry points (link click, popstate, `rivet:go`): once, start the effect
 * that moves `k` with the location — except for a search-only change of the shown live page, refreshed in place.
 */
export function _armLive(router: Located & Navigator, live: LivePage, state?: Layouts, table?: LayoutTable): void {
  if (live.a || !live.k) return;
  live.a = true;
  let seen: string | undefined;
  effect(() => {
    const url = router.location();
    untrack(() => {
      const shown = live.h!,
        page = pageOf(url),
        // The same full URL again: a revalidation (the runtime router re-set it); else a fragment-only change.
        again = url.href === seen;
      seen = url.href;
      if (page === shown) return void (again && live.k!.set(page));
      const from = new URL(shown);
      live.h = page;
      if (live.s && live.u === from.pathname + from.search && url.pathname === from.pathname) {
        // The shown live page, another search (same route and params): the Router keeps it, its data refreshes in place.
        live.u = url.pathname + url.search;
        void refresh(router, live, url, undefined, state && table ? _keepIds(state, table, url) : undefined, _inPlace, state, table, () =>
          live.k!.set(live.h!),
        );
      } else live.k!.set(page);
    });
  });
}

/**
 * @internal Generated `App` of a nested-layout app (`_sync`'s `inPlace`): a search-only change of the shown live
 * page (`from`: the URL `_sync` saw last) refreshes it in place — no level key moves, the layouts keep their data
 * unless their loaders read the URL. A failed loader re-renders the page level (`_bump` + `_sync`).
 */
export function _liveLevels(router: Located & Navigator, live: LivePage, state: Layouts, table: LayoutTable, from: string, url: URL): boolean {
  const shown = new URL(from);
  if (!live.s || live.u !== shown.pathname + shown.search || url.pathname !== shown.pathname || url.search === shown.search) return false;
  live.u = url.pathname + url.search;
  void refresh(router, live, url, undefined, _keepIds(state, table, url), _inPlace, state, table, () => {
    _bump();
    _sync(router, state, table);
  });
  return true;
}

/** @internal Generated route render of a live page: its `data` accessor (a new signal per render). */
export function _livePage(slot: LivePage, value: unknown, url: URL, depth: number): () => unknown {
  const data = signal(value);
  slot.s = data;
  slot.u = url.pathname + url.search;
  slot.d = depth;
  return data;
}

/**
 * @internal Generated `App` (`rivet:go`) when some page is live: same-URL revalidations of the shown
 * live page refresh in place; everything else is served like `_serve`.
 */
export function _serveLive(router: Navigator, live: LivePage, state?: Layouts, table?: LayoutTable): void {
  for (const request of _take()) if (!inPlace(router, live, request, state, table)) _perform(router, request, state, table);
}

function inPlace(router: Navigator, live: LivePage, request: NavigateRequest, state?: Layouts, table?: LayoutTable): boolean {
  const { url, done } = request;
  const target = request.invalidate;
  // Not a revalidation, no client router, another page shown, or a navigation in flight: the regular path.
  if (!target || !router.navigate || !live.s || live.u !== url.pathname + url.search || _current()) return false;
  let keep: string | undefined;
  if (typeof target === "function") {
    _dropPrefetch();
    const plan = _plan(state, table, url, target);
    // Nothing matched, or layouts only (they refresh in place already): the regular path.
    if (plan && !plan.page) return false;
    // The page's loader reruns; layouts whose keys did not match stay kept.
    if (plan) {
      _invalidating(url, plan.drop);
      keep = _keepIds(state, table, url);
    } else _stale();
  } else _clearPrefetch();
  void refresh(router, live, url, typeof target === "object" ? target : undefined, keep, done, state, table);
  return true;
}

async function refresh(
  router: Navigator,
  live: LivePage,
  url: URL,
  fresh: FreshData | undefined,
  keep: string | undefined,
  done: () => void,
  state?: Layouts,
  table?: LayoutTable,
  // A search navigation: its Router commit on a failed loader (else none: the regular rerun).
  search?: () => void,
): Promise<void> {
  const n = (live.n = (live.n ?? 0) + 1);
  let result: { readonly data: readonly unknown[]; readonly kept?: readonly number[]; readonly byURL?: readonly number[] };
  if (fresh?.data) {
    // An enhanced action's single-flight answer: no request.
    result = { data: fresh.data };
    _depsLoaded(url, fresh.data.length, fresh.deps);
    if (fresh.head?.title !== undefined) document.title = fresh.head.title;
  } else
    try {
      // Detached from any navigation (a redirect answer navigates and never settles).
      result = await routeData({ signal: new AbortController().signal, get: <T>() => null as T }, { url }, router, live.m, keep);
    } catch {
      // A failed loader: the page re-renders with the route's error view (a search navigation: its Router commit).
      if (!search) return _perform(router, { url, invalidate: true, done }, state, table);
      if (n === live.n) search();
      return;
    }
  // A newer refresh, or a navigation that started meanwhile, wins (a search navigation: the one in flight is its own).
  const nav = _current();
  if (n === live.n && (!nav || (search && nav.to.pathname + nav.to.search === live.u)) && live.u === location.pathname + location.search) {
    batch(() => {
      if (state && table) _refreshed(state, table, url, result);
      live.s!.set(result.data[live.d!]);
    });
    done();
  } else if (!search) done();
}
