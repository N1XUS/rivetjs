// `resource()`: async data as a signal (lane RESOURCE, spec docs/design/specs/2026-10-20-resource-design.md). Pay-per-use:
// exported from `dom.ts` (its server twin is `server-resource.ts`), nothing runs at import, so an app
// that never calls it ships none of it (`sideEffects: false`). Suspense / transitions go through the `Async` coordinator
// (`async-coordinator.ts`, installed by dom-suspense.ts only when imported): one fetch = one coordinated generation.
import { createRoot, effect, getOwner, onCleanup, runWithOwner, signal, untrack, useContext } from "@rivetjs/reactivity";
import type { Context, Disposer, Signal } from "@rivetjs/reactivity";
import { coordinator } from "./async-coordinator.ts";
import type { Coordinator } from "./async-coordinator.ts";
import type { AsyncProps, Output } from "./dom.ts";
import { _OPS, _PROTO, _STATES, _sameKey } from "./resource.ts";
import type { Resource, ResourceFetcher, ResourceInfo, ResourceOptions, ResourceSeed, ResourceSource, ResourceState } from "./resource.ts";
export type { Resource, ResourceFetcher, ResourceInfo, ResourceOptions, ResourceSeed, ResourceSource, ResourceState } from "./resource.ts";

const { LOADING, ERROR, LATEST, REFETCH, MUTATE } = _OPS;

// The coordinator only disposes an output it is handed back on failure; a resource has none.
const HELD = { dispose() {} } as unknown as Output;
const none = (): null => null;

/** Fetcher-only form: the fetcher gets `true` as its source value. */
export function resource<T>(fetcher: ResourceFetcher<true, T>, options?: ResourceOptions<T>): Resource<T>;
/** Source form: the fetcher runs for each source value (tracked) that is not `false` / `null` / `undefined`. */
export function resource<T, S>(source: ResourceSource<S>, fetcher: ResourceFetcher<S, T>, options?: ResourceOptions<T>): Resource<T>;
/**
 * Async data as a signal: loads with `fetcher(source, info)`, again whenever the source changes (the previous load is
 * aborted, a stale response dropped), and is disposed with its owner. Lazy: the first load starts at the first use
 * (a read, `refetch`, or a method). Inside `Suspense` a load shows the fallback like an `Async` created where the
 * resource is (except while it keeps a value during a transition: `startTransition` keeps the shown value until the
 * new one commits).
 */
export function resource<T, S>(a: unknown, b?: unknown, c?: unknown): Resource<T> {
  const sourced = typeof b === "function",
    source = (sourced ? a : true) as ResourceSource<S>,
    fetcher = (sourced ? b : a) as ResourceFetcher<S, T>,
    options = (sourced ? c : b) as ResourceOptions<T> | undefined,
    owner = getOwner();
  let value = options?.initialValue,
    error: unknown,
    status = value === undefined ? 0 : 2,
    version = signal(0),
    started = false,
    adopted = false,
    disposed = false,
    gen = 0,
    current: Disposer | null = null,
    // Resumed with the server's value: the first source value equal to `skip[0]` (any, when empty) loads nothing.
    skip: unknown[] | null = null;
  const bump = (): void => void version.update((n) => n + 1);
  const read = (() => (typeof source === "function" ? (source as () => S)() : source)) as () => S | false | null | undefined;
  const settle = (g: number, p: AsyncProps<T> | null, apply: () => void): void => {
    if (g !== gen || disposed) return;
    const commit = (): void => {
      if (g !== gen || disposed) return;
      apply();
      bump();
    };
    if (p) p.swap!(commit, null as never);
    else commit();
  };
  // One load (a generation): supersedes the previous one. `quiet`: started by the first use, inside a read that tracks
  // the change counter right after, so no write is needed.
  const load = (key: S | false | null | undefined, refetching: unknown, quiet: boolean): void => {
    if (current) current();
    current = null;
    const g = ++gen;
    if (skip) {
      const kept = skip;
      skip = null;
      if (kept.length === 0 || _sameKey(kept[0], key)) return;
    }
    if (key === false || key == null) {
      const next = value === undefined ? 0 : 2;
      if (status !== next) ((status = next), quiet || bump());
      return;
    }
    createRoot((dispose) => {
      const scope = getOwner(),
        controller = new AbortController();
      current = () => {
        controller.abort();
        dispose();
      };
      const run = <R>(fn: () => R): R => {
        if (g !== gen || disposed) throw new Error("Resource load is superseded");
        return runWithOwner(scope, fn);
      };
      const info: ResourceInfo<T> = Object.freeze({
        signal: controller.signal,
        value,
        refetching,
        run,
        get: <V>(token: Context<V>): V => run(() => useContext(token)),
      });
      let result: T | PromiseLike<T>;
      try {
        result = fetcher(key as S, info);
      } catch (failure) {
        error = failure;
        status = 4;
        if (!quiet) bump();
        return;
      }
      const then = result == null ? undefined : (result as PromiseLike<T>).then;
      if (typeof then !== "function") {
        value = result as T;
        error = undefined;
        status = 2;
        if (!quiet) bump();
        return;
      }
      status = value === undefined ? 1 : 3;
      if (!quiet) bump();
      // Suspense / transitions: this load is an Async generation that has shown output while the resource has a value.
      const coordinate = coordinator;
      const p = coordinate
        ? (coordinate as Coordinator<T>)({ load: () => result, children: none, error: none }, () => (value === undefined ? undefined : HELD))
        : null;
      const pending = (p ? p.load(info) : result) as PromiseLike<T>;
      pending.then(
        (next) =>
          settle(g, p, () => {
            value = next;
            error = undefined;
            status = 2;
          }),
        (failure) =>
          settle(g, p, () => {
            error = failure;
            status = 4;
          }),
      );
    });
  };
  // `refetch`: the first use is `refetch(info)` — a refetch load (no read follows: it writes the counter), never skipped
  // for a resumed value (RESOURCE-COMPILER: a resumed resource's first use may be a handler's refetch).
  const start = (refetch?: unknown): void => {
    if (started || disposed) return;
    started = true;
    if (refetch !== undefined) skip = null;
    let quiet = refetch === undefined;
    runWithOwner(owner, () => {
      if (typeof source !== "function") return untrack(() => load(source, refetch ?? false, quiet));
      effect(() => {
        const key = read();
        const first = quiet,
          again = refetch;
        quiet = false;
        refetch = undefined;
        untrack(() => load(key, again ?? false, first));
      });
    });
  };
  const adopt = (seed: ResourceSeed): void => {
    if (adopted || started) return;
    adopted = true;
    version = seed.n;
    status = seed.s;
    if ("v" in seed) value = seed.v as T;
    if ("e" in seed) error = seed.e;
    if (seed.x === 1 || status === 1 || status === 3) status = value === undefined ? 0 : 2;
    else skip = "k" in seed ? [seed.k] : [];
  };
  if (owner)
    onCleanup(() => {
      disposed = true;
      gen++;
      if (current) current();
      current = null;
    });
  const resourceFn = function (op?: unknown, arg?: unknown, extra?: unknown): unknown {
    if (typeof op === "object" && op !== null) {
      adopt(op as ResourceSeed);
      op = arg;
      arg = extra;
    }
    if (op === REFETCH) {
      if (!started) return start(arg === undefined ? true : arg);
      if (!disposed) runWithOwner(owner, () => untrack(() => load(read(), arg === undefined ? true : arg, false)));
      return;
    }
    if (op === MUTATE) {
      value = typeof arg === "function" ? (arg as (previous: T | undefined) => T)(value) : (arg as T);
      error = undefined;
      status = status === 1 || status === 3 ? 3 : 2;
      bump();
      return value;
    }
    start();
    version();
    if (op === undefined) {
      if (status === 4) throw error;
      return value;
    }
    return op === LOADING ? status === 1 || status === 3 : op === ERROR ? (status === 4 ? error : undefined) : op === LATEST ? value : _STATES[status];
  };
  return Object.setPrototypeOf(resourceFn, _PROTO) as Resource<T>;
}
