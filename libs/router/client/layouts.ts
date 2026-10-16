// Persistent layouts of generated apps. Every layout with a component stays mounted while client
// navigation stays below it: its props are App-level signals (`data`, `params`, `url`) that loads
// update in place, and each nesting level renders its own Router region that tracks one level key
// signal (the layout at that level, or the page at the deepest one). A level reloads only when its
// key changes; it fetches data for the whole chain, skipping layouts whose data the client keeps.
import { batch, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { compileRoutes, type RouteMatch } from "@rivetjs/runtime/router";
import type { LoaderDeps } from "../shared/data.ts";

/** Generated layout table (a module constant of `.rivet/app.tsx`). */
export interface LayoutTable {
  /** Layout ids: `/` + folder (`/`, `/shop`, `/u/[id]`). */
  readonly ids: readonly string[];
  /** Each layout's own params (from its folder), compared to decide whether its data is still valid. */
  readonly params: readonly (readonly string[])[];
  /** Bits per layout: 1 component (rendered, persisted), 2 server exports (a loader the client may keep). */
  readonly kind: readonly number[];
  /** The root layout rendered around the routes region (-1: none). */
  readonly root: number;
  /** Page routes: pattern and layout indices, outermost first (the route's `data` order). */
  readonly routes: readonly (readonly [pattern: string, layouts: readonly number[]])[];
}
/** One layout's props as signals (resume-serialized with the App). */
export interface LayoutSignals {
  readonly d: Signal<unknown>;
  readonly p: Signal<Readonly<Record<string, string>>>;
  readonly u: Signal<URL>;
}
/** Layout state of one App: level keys, per-layout signals, the URL (path + search) whose data the server sent (and its URL-bound layouts). */
export interface Layouts {
  readonly k: readonly Signal<string>[];
  /** Per layout (server-only ones hold 0, never read). */
  readonly l: readonly LayoutSignals[];
  readonly at: string;
  readonly x: readonly number[];
  /** The server render's `event.depends()` keys (route data order); absent when no loader called it. */
  readonly dk?: LoaderDeps;
}
interface Loaded {
  readonly data: readonly unknown[];
  readonly kept?: readonly number[];
  readonly byURL?: readonly number[];
  readonly failure?: unknown;
}
interface Navigator {
  location(): URL;
}

const browser = typeof document !== "undefined";
const never = <T>(): Promise<T> => new Promise<T>(() => {});
/**
 * @internal A matcher that remembers its last answer by path (intent prefetch and each navigation
 * re-match the same URL several times). Callers read `route` / `params` only: `url` is the first caller's.
 */
export function _lastMatch(match: (url: URL) => RouteMatch | null): (url: URL) => RouteMatch | null {
  let path: string | undefined,
    hit: RouteMatch | null = null;
  return (url) => (url.pathname === path ? hit : ((path = url.pathname), (hit = match(url))));
}
const matchers = new WeakMap<LayoutTable, (url: URL) => RouteMatch | null>();
function find(table: LayoutTable, url: URL): { layouts: readonly number[]; params: Readonly<Record<string, string>> } | null {
  let match = matchers.get(table);
  if (!match) matchers.set(table, (match = _lastMatch(compileRoutes(table.routes.map(([path, layouts]) => ({ path, render: () => layouts }))))));
  const hit = match(url);
  return hit ? { layouts: hit.route.render(undefined, hit) as readonly number[], params: hit.params } : null;
}
const own = (table: LayoutTable, i: number, params: Readonly<Record<string, string>>): string =>
  i + "\0" + table.params[i]!.map((name) => params[name] ?? "").join("\0");
const same = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};
/** Level keys of a URL: `L<index>` per persisted layout, then `P<path?query>` for the page level. */
function keysOf(table: LayoutTable, url: URL, hit = find(table, url)): string[] {
  const keys: string[] = [];
  if (hit) for (const i of hit.layouts) if (table.kind[i]! & 1 && i !== table.root) keys.push("L" + i);
  keys.push("P" + url.pathname + url.search);
  return keys;
}

/** @internal Generated `App`: layout signals (server data for the request's chain) and level keys. */
export function _layouts(
  server: { data: readonly unknown[]; url: URL; error?: unknown; byURL?: readonly number[]; deps?: LoaderDeps } | null,
  router: Navigator,
  table: LayoutTable,
  levels: number,
): Layouts {
  const url = server?.url ?? untrack(router.location);
  const hit = find(table, url);
  // Error renders: data of the outermost layouts that loaded (the unmatched URL's: the root layout's).
  const data = server ? server.data : null;
  // Server error renders show the failure at level 0 (no nested levels): any navigation reloads it.
  const keys = server?.error ? ["E"] : keysOf(table, url, hit);
  return {
    k: Array.from({ length: levels }, (_, k) => signal(keys[k] ?? "")),
    l: table.kind.map((kind, i) => {
      if (!(kind & 1)) return 0 as unknown as LayoutSignals;
      const at = hit ? hit.layouts.indexOf(i) : i === table.root ? 0 : -1;
      return {
        d: signal(at >= 0 ? data?.[at] : undefined),
        // The root layout stays outside the routes: no params, like before.
        p: signal(at >= 0 && i !== table.root ? hit!.params : {}),
        u: signal(url),
      };
    }),
    // Only a server render says which layouts read the URL; without it (dev mounts) nothing is kept at first.
    // Path + search (no origin: prerendered state carries no build-time origin).
    at: data && !server?.error && server?.byURL ? url.pathname + url.search : "",
    x: server?.byURL ?? [],
    // Only when a loader called `depends()`: other apps' resume state stays as it was.
    ...(server?.deps ? { dk: server.deps } : {}),
  };
}

// Browser state: layouts the shown chain has data for (`own` keys), staleness, level handoffs.
const committed = new WeakMap<Layouts, Set<string>>();
let stale = false;
let bump = false;
let revision = 0;
function shown(state: Layouts, table: LayoutTable): Set<string> {
  const known = committed.get(state);
  if (known) return known;
  // Resumed pages: the server's chain is fresh (its URL-bound layouts excepted).
  const set = new Set<string>();
  const hit = state.at ? find(table, new URL(state.at, location.href)) : null;
  hit?.layouts.forEach((i, at) => state.x.includes(at) || set.add(own(table, i, hit.params)));
  committed.set(state, set);
  return set;
}
/** @internal Data may have changed (form submit, `invalidate()`): the next data request reloads every layout. */
export function _stale(): void {
  stale = true;
}
/** @internal `invalidate()`: the page level reloads although its URL is unchanged. */
export function _bump(): void {
  bump = true;
}

/** @internal Data request: ids of the target's layouts whose data the shown chain still has (same own params). */
export function _keepIds(state: Layouts | undefined, table: LayoutTable | undefined, url: URL): string | undefined {
  if (!browser || !state || !table || stale) return undefined;
  const hit = find(table, url);
  if (!hit) return undefined;
  seed(state);
  const set = shown(state, table);
  // `invalidate(key)` of this URL: the layouts whose keys match rerun although the client has their data.
  const drop = forced && forced.at === pathOf(url) ? forced.drop : undefined;
  const ids = hit.layouts.filter((i) => table.kind[i]! & 2 && set.has(own(table, i, hit.params)) && !drop?.has(table.ids[i]!)).map((i) => table.ids[i]!);
  return ids.length ? ids.join(",") : undefined;
}

// `event.depends()` keys of the shown route data (route data order) for `invalidate(key)`; null: unknown.
let deps: { at: string; list: LoaderDeps } | null = null;
// `invalidate(key)` in flight: ids of the layouts it reruns (left out of the keep list for its URL).
let forced: { at: string; drop: ReadonlySet<string> } | null = null;
const pathOf = (url: URL): string => url.pathname + url.search;
// Resumed pages: the server render's keys (none recorded when no loader called `depends()`).
function seed(state: Layouts): void {
  if (!deps && state.at) deps = { at: state.at, list: state.dk ?? [] };
}
/** @internal Route data for `url` arrived (`kept`: indices the server skipped; their keys stay as recorded). */
export function _depsLoaded(url: URL, length: number, fresh: LoaderDeps | undefined, kept?: readonly number[]): void {
  if (!browser) return;
  const previous = deps?.list;
  // Kept loaders whose keys were never seen (no resume state): unknown, so `invalidate(key)` reruns everything.
  if (kept?.length && !previous) return void (deps = null);
  const skipped = new Set(kept);
  deps = { at: pathOf(url), list: Array.from({ length }, (_, i) => (skipped.has(i) ? previous![i] : fresh?.[i])) };
}
/** Which loaders of the shown page `invalidate(key)` reruns. */
export interface InvalidationPlan {
  /** Some loader matched (else nothing to do). */
  readonly any: boolean;
  /** The page's own loader matched. */
  readonly page: boolean;
  /** Ids of the layouts that matched. */
  readonly drop: ReadonlySet<string>;
}
/**
 * @internal `invalidate(key)`: the shown page's loaders whose keys pass `test`; undefined when the
 * keys are unknown or the data may be stale anyway (form submit, `invalidate()`): rerun everything.
 */
export function _plan(state: Layouts | undefined, table: LayoutTable | undefined, url: URL, test: (key: string) => boolean): InvalidationPlan | undefined {
  if (!browser || stale) return undefined;
  if (state) seed(state);
  if (!deps || deps.at !== pathOf(url)) return undefined;
  const list = deps.list;
  const matches = (at: number): boolean => !!list[at]?.some(test);
  const hit = table ? find(table, url) : null;
  // No layout table (apps without layouts, static and CSR apps): nothing can be kept, any match reruns all.
  if (!hit) {
    const any = list.some((_, at) => matches(at));
    return { any, page: any, drop: new Set() };
  }
  const drop = new Set(hit.layouts.flatMap((i, at) => (matches(at) ? [table!.ids[i]!] : [])));
  const mine = matches(hit.layouts.length);
  return { any: mine || drop.size > 0, page: mine, drop };
}
/** @internal `invalidate(key)` reruns `drop` (layout ids) for `url`: the next keep list leaves them out. */
export function _invalidating(url: URL, drop: ReadonlySet<string>): void {
  forced = { at: pathOf(url), drop };
}
/**
 * @internal `invalidate(key)` without the page loader, or a live page's in-place refresh: the layouts that
 * reran (not in `kept`) update in place; the page stays. URL-bound layouts that reran are not kept across URL changes afterwards.
 */
export function _refreshed(
  state: Layouts,
  table: LayoutTable,
  url: URL,
  result: { readonly data: readonly unknown[]; readonly kept?: readonly number[]; readonly byURL?: readonly number[] },
): void {
  forced = null;
  const hit = find(table, url);
  if (!hit) return;
  // The request named only data the client still had (`_keepIds` keeps nothing while stale): all fresh now.
  stale = false;
  const kept = new Set(result.kept),
    bound = new Set(result.byURL);
  const before = shown(state, table);
  batch(() =>
    hit.layouts.forEach((i, at) => {
      const layout = table.kind[i]! & 1 ? state.l[i] : undefined;
      if (!layout) return;
      if (!kept.has(at)) layout.d.set(result.data[at]);
      // A search-only navigation refreshed in place: the layouts' `url` follows it.
      if (untrack(layout.u).href !== url.href) layout.u.set(url);
    }),
  );
  committed.set(
    state,
    new Set(
      hit.layouts.flatMap((i, at) => {
        const id = own(table, i, hit.params);
        return (kept.has(at) ? before.has(id) : !bound.has(at)) ? [id] : [];
      }),
    ),
  );
}

// The document's URL when this module loaded (before any client navigation could run).
const loadedAt = browser ? location.href.split("#")[0] : "";
const synced = new WeakMap<Layouts, string>();
/**
 * @internal App `clientEffect`: derive the level keys from the location (a level reloads when its key changes).
 * `inPlace(from, url)` (live apps): true when the change from the shown URL `from` is refreshed in place (a
 * search-only navigation of the shown live page) — no level key moves.
 */
export function _sync(router: Navigator, state: Layouts, table: LayoutTable, inPlace?: (from: string, url: URL) => boolean): void {
  const url = router.location();
  // First run without a navigation yet: the page shows what the server rendered (even when it was
  // rendered for another URL, e.g. a prerendered page served under a path prefix).
  const from = synced.get(state);
  synced.set(state, url.href.split("#")[0]!);
  if (from === undefined && !bump && url.href.split("#")[0] === loadedAt) return;
  if (!bump && inPlace?.(from ?? loadedAt, url)) return;
  const keys = keysOf(table, url);
  if (bump) {
    bump = false;
    keys[keys.length - 1] += "~" + ++revision;
  }
  // Outer levels first: an outer level that re-renders disposes the inner ones before they run.
  batch(() => keys.forEach((key, k) => state.k[k]?.set(key)));
}

// A level that renders a layout hands its loaded result to the Router inside it, which takes it
// synchronously (one commit per navigation). Tokens tell the Router of the shown layout instance from
// orphans: a server-rendered inner region whose outer level the browser has re-rendered since.
let handoff: { k: number; href: string; result: unknown } | null = null;
let building = 0;
let token = 0;
let outermost = Infinity;
const current: number[] = [];
const ORPHAN = "#rivet:orphan";

/** @internal Swap and hold of nested Routers: their first commit lands inside the outer level's render. */
export const _building = (): boolean => building > 0;

/** @internal Level `k` renders a layout: `fn(token)` builds it with the Router of level `k + 1` inside. */
export function _enter<V>(k: number, result: unknown, url: URL, fn: (token: number) => V): V {
  if (!browser) return fn(0);
  const mine = (current[k + 1] = ++token),
    mark = { k: k + 1, href: url.href, result };
  const run = <R>(build: () => R): R => {
    const previous = handoff;
    handoff = mark;
    building++;
    try {
      return build();
    } finally {
      building--;
      handoff = previous;
    }
  };
  const value = run(() => fn(mine));
  // A layout that returns an accessor (the dev HMR wrapper, e.g.) is built when its insertion reads it: that
  // read is part of this render too, so the inner Router still takes the handoff and holds no server outlet.
  return typeof value === "function" ? ((() => run(value as () => unknown)) as V) : value;
}

/** @internal The navigator of level `k`'s Router: tracks the level key only; orphans never load. */
export function _level(router: Navigator, state: Layouts, k: number, t: number): Navigator {
  // Token 0: created by the App or re-created from server HTML (resume): inner server regions are orphans now.
  if (browser && t === 0) outermost = Math.min(outermost, k);
  return {
    location() {
      state.k[k]!();
      const url = untrack(router.location);
      if (browser && !(t === 0 ? k <= outermost : current[k] === t)) url.hash = ORPHAN;
      return url;
    },
  };
}

/** @internal Level route load: the outer level's handoff (synchronous), never for orphans, else undefined. */
export function _take<T>(k: number, url: URL): T | Promise<T> | undefined {
  if (!browser) return undefined;
  if (url.hash === ORPHAN) return never<T>();
  if (handoff && handoff.k === k && handoff.href === url.href) {
    const { result } = handoff;
    handoff = null;
    return result as T;
  }
  return undefined;
}

/**
 * @internal Level route load settled: update the chain's layout signals (kept layouts keep theirs).
 * A failure below a layout whose data was reloaded re-renders from the outermost level instead.
 */
export function _landed<T extends Loaded>(
  state: Layouts,
  table: LayoutTable,
  k: number,
  r: number,
  result: T,
  match: { params: Readonly<Record<string, string>>; url: URL },
): T | Promise<T> {
  const layouts = table.routes[r]![1];
  forced = null;
  if (result.failure !== undefined) {
    if (!browser || k === 0) return result;
    // Shown in place when every layout around this level kept its data, else from level 0.
    const set = stale ? new Set<string>() : shown(state, table);
    const outer = layouts.filter((i) => table.kind[i]! & 1 && i !== table.root).slice(0, k);
    if (outer.every((i) => !(table.kind[i]! & 2) || set.has(own(table, i, match.params)))) return result;
    handoff = { k: 0, href: match.url.href, result };
    state.k[0]!.set("E" + ++revision);
    return never<T>();
  }
  const kept = new Set(result.kept);
  batch(() =>
    layouts.forEach((i, at) => {
      const layout = state.l[i];
      if (!(table.kind[i]! & 1) || !layout) return;
      if (!kept.has(at)) layout.d.set(result.data[at]);
      if (i !== table.root && !same(untrack(layout.p), match.params)) layout.p.set(match.params);
      // Same URL (a dev mount's first load): keep the value, so URL effects do not rerun.
      if (untrack(layout.u).href !== match.url.href) layout.u.set(match.url);
    }),
  );
  if (browser) {
    stale = false;
    // URL-bound loaders (they read `url` / `request`) reload on the next URL change.
    const bound = new Set(result.byURL);
    committed.set(state, new Set(layouts.flatMap((i, at) => (bound.has(at) ? [] : [own(table, i, match.params)]))));
  }
  return result;
}
