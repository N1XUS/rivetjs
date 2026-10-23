// Server twin of `resource()` (dom-resource.ts; spec docs/design/specs/2026-10-20-resource-design.md). The fetcher runs
// once, at creation. A read while it loads inside a `Suspense` makes that Suspense wait: it drops what its content
// recorded, awaits the loads its content read (through an `Async`, so ordered and streamed renders treat it like a
// pending Async below that Suspense) and builds the content again; resources created during a discarded build are reused
// by creation order. A read while loading outside any Suspense renders the loading state (the browser loads it).
// The state ships as the making boundary's keyed value `$r` (`seedOf`, `server-derived.ts`); the browser's adopt run
// hands it to `resource()` (dom-resource.ts `adopt`), so the browser does not load the value again.
import { createRoot, getOwner, onCleanup, provide, runWithOwner, signal, untrack, useContext } from "@rivetjs/reactivity";
import type { Context, Owner, Signal } from "@rivetjs/reactivity";
import { DEV } from "#dev";
import { captureAsyncContext } from "./async.ts";
import { Async, clientOnly } from "./server-async.ts";
import { _onBuild } from "./server-suspense.ts";
import { _derivedResource } from "./server-resource-slot.ts";
import { _OPS, _PROTO, _STATES, _sameKey } from "./resource.ts";
import type { Resource, ResourceFetcher, ResourceInfo, ResourceOptions, ResourceSource } from "./resource.ts";
import type { AsyncContext } from "./async.ts";
import type { ServerValue } from "./server.ts";
export type { Resource, ResourceFetcher, ResourceInfo, ResourceOptions, ResourceSource, ResourceState } from "./resource.ts";

const { LOADING, ERROR, LATEST, REFETCH, MUTATE } = _OPS;
/** One server resource (`k: 1`) or one Suspense's builds (`k: 0`), in the creation order of a Suspense build. */
interface State {
  k: 1;
  /** The source of the latest build's `resource()` call (a rebuilt content's closures read its own signals). */
  source: unknown;
  /** `{ ssr: false }`: a pending read is not waited for. */
  later: boolean;
  key: unknown;
  value: unknown;
  error: unknown;
  status: number;
  /** Change counter: what reads track (resumed bindings re-run when the browser writes it). */
  n: Signal<number>;
  /** Settles (never rejects) when the load does; null: not loading on the server. */
  wait: Promise<void> | null;
  noted?: boolean;
}
interface Builds {
  k: 0;
  /** Resources and nested Suspense builds created by this Suspense's content, in creation order. */
  list: (State | Builds)[];
  i: number;
  /** Loads the current build read while they were pending. */
  wait: Promise<void>[];
  /** Where resources created in a build register their abort: outlives the discarded builds. */
  owner: Owner | null;
}
const states = new WeakMap<object, State>();

// Suspense content builds (installed with the context token they provide: kept exactly when `resource` is used).
const BUILDS = _onBuild(suspend, { defaultValue: null } as Context<Builds | null>);
function suspend(content: () => unknown): unknown {
  const outer = useContext(BUILDS);
  let builds: Builds;
  if (outer) {
    // A Suspense inside a build: its builds (and their resources) survive the outer one being built again.
    const at = outer.i++,
      hit = outer.list[at];
    builds = hit?.k === 0 ? hit : (outer.list[at] = { k: 0, list: [], i: 0, wait: [], owner: outer.owner });
  } else builds = { k: 0, list: [], i: 0, wait: [], owner: getOwner() };
  return build(content, builds);
}
function build(content: () => unknown, builds: Builds): unknown {
  builds.i = 0;
  builds.wait = [];
  const dh = _derivedResource(),
    dmark = dh && dh.mark();
  let root: { value: unknown; dispose: () => void } | undefined, failure: [unknown] | undefined;
  try {
    root = createRoot(() => provide(BUILDS, builds, content));
  } catch (error) {
    // A failure while a read was pending (`user()!.name`) is a consequence of the missing value: built again below.
    failure = [error];
  }
  if (builds.wait.length === 0) {
    if (failure) throw failure[0];
    return root!.value;
  }
  if (root) root.dispose();
  if (dmark != null) dh!.cut(dmark);
  const wait = Promise.all(builds.wait);
  return Async({ load: () => wait, children: () => build(content, builds) as ServerValue, $i: 1 } as never);
}

// Marks the reading region for re-creation once the page resumed (`clientOnly`'s hook; nothing outside resumable renders).
const browserLoads = clientOnly(null as never, undefined, { when: "load" }) as (props: object) => unknown;

// The derived model's seed (`dom-resource.ts` `adopt`, without the change counter: the browser makes its own): what the
// server settled; pending → `x` (the browser loads on first use). The recorder ships it when it is JSON data, else `x`.
function seedOf(st: State): unknown {
  const seed: Record<string, unknown> = { s: st.status };
  if (st.status === 1 || st.status === 3) seed.x = 1;
  else if (st.status === 4) seed.e = st.error;
  else if (st.value !== undefined) seed.v = st.value;
  if (st.key !== undefined && st.key !== true) seed.k = st.key;
  return seed;
}
// A resource function over `st` (server reads: the value, tracked through the change counter and the source).
function make<T>(st: State): Resource<T> {
  const fn = function (op?: unknown, arg?: unknown): unknown {
    const source = st.source;
    if (op === REFETCH) return;
    if (op === MUTATE) {
      st.value = typeof arg === "function" ? (arg as (previous: unknown) => unknown)(st.value) : arg;
      st.error = undefined;
      st.status = 2;
      st.n.update((n) => n + 1);
      return st.value;
    }
    st.n();
    // Reads of the source count for the reading binding: on a resumed page it re-runs (and the resource loads) when they change.
    if (typeof source === "function") (source as () => unknown)();
    if (st.status === 1) {
      const into = useContext(BUILDS);
      if (into && st.wait) {
        if (!into.wait.includes(st.wait)) into.wait.push(st.wait);
      } else {
        browserLoads({});
        if (DEV && !st.noted && !st.later) {
          st.noted = true;
          console.warn(
            "Rivet: a resource was read while loading outside <Suspense> during server rendering: the page shows its loading state and the browser loads it after resume. Wrap the part that reads it in <Suspense> to render the data on the server.",
          );
        }
      }
    }
    if (op === undefined) {
      if (st.status === 4) throw st.error;
      return st.value;
    }
    const s = st.status;
    return op === LOADING ? s === 1 || s === 3 : op === ERROR ? (s === 4 ? st.error : undefined) : op === LATEST ? st.value : _STATES[s];
  };
  states.set(fn, st);
  return Object.setPrototypeOf(fn, _PROTO) as Resource<T>;
}

/** Server twin of the DOM `resource` (fetcher-only form). */
export function resource<T>(fetcher: ResourceFetcher<true, T>, options?: ResourceOptions<T>): Resource<T>;
/** Server twin of the DOM `resource` (source form). */
export function resource<T, S>(source: ResourceSource<S>, fetcher: ResourceFetcher<S, T>, options?: ResourceOptions<T>): Resource<T>;
/** Server twin: loads once at creation (not with `{ ssr: false }`); see the DOM `resource`. */
export function resource<T, S>(a: unknown, b?: unknown, c?: unknown): Resource<T> {
  const sourced = typeof b === "function",
    source = (sourced ? a : true) as ResourceSource<S>,
    fetcher = (sourced ? b : a) as ResourceFetcher<S, T>,
    options = (sourced ? c : b) as ResourceOptions<T> | undefined,
    builds = useContext(BUILDS),
    key = typeof source === "function" ? untrack(source as () => unknown) : source;
  let at = -1;
  if (builds) {
    at = builds.i++;
    const hit = builds.list[at];
    // A rebuilt content's call: the same state, a new function (its own recipe, with this build's captures).
    if (hit?.k === 1 && _sameKey(hit.key, key)) return ((hit.source = source), make<T>(hit));
  }
  const initial = options?.initialValue;
  const st: State = {
    k: 1,
    source,
    later: options?.ssr === false,
    key,
    value: initial,
    error: undefined,
    status: initial === undefined ? 0 : 2,
    n: signal(0),
    wait: null,
  };
  const fn = make<T>(st);
  if (builds) builds.list[at] = st;
  // The state ships on the boundary whose body made it (read at the flush: settled by then when awaited).
  _derivedResource()?.seed(() => seedOf(st));
  if (key === false || key == null) return fn;
  if (options?.ssr === false) {
    st.status = 1;
    return fn;
  }
  const owner = getOwner(),
    keep = builds ? builds.owner : owner,
    controller = new AbortController();
  if (keep) runWithOwner(keep, () => onCleanup(() => controller.abort()));
  const context: AsyncContext | null = owner ? captureAsyncContext() : null;
  const info: ResourceInfo<T> = Object.freeze({
    signal: controller.signal,
    value: initial,
    refetching: false,
    get: <V>(token: Context<V>): V => (context ? context.get(token) : token.defaultValue),
    run: <R>(work: () => R): R => (context ? context.run(work) : work()),
  });
  let result: T | PromiseLike<T>;
  try {
    result = untrack(() => fetcher(key as S, info));
  } catch (failure) {
    st.error = failure;
    st.status = 4;
    return fn;
  }
  const then = result == null ? undefined : (result as PromiseLike<T>).then;
  if (typeof then !== "function") {
    st.value = result;
    st.status = 2;
    return fn;
  }
  st.status = 1;
  st.wait = new Promise<void>((resolve) => {
    const settle = (status: number, outcome: unknown): void => {
      if (status === 2) st.value = outcome;
      else st.error = outcome;
      st.status = status;
      st.wait = null;
      st.n.update((n) => n + 1);
      resolve();
    };
    Reflect.apply(then, result, [(next: unknown) => settle(2, next), (failure: unknown) => settle(4, failure)]);
  });
  return fn;
}
