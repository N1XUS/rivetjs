// `resource()` shared by dom-resource.ts and server-resource.ts (lane RESOURCE): public types, the method prototype,
// state codes and source-key comparison. No DOM or server code, so neither target bundles the other.
import type { Signal } from "@rivetjs/reactivity";
import type { AsyncWork } from "./async.ts";

/** Lifecycle of a resource (Solid names): never fetched, first load, has a value, reloading with a value, failed. */
export type ResourceState = "unresolved" | "pending" | "ready" | "refreshing" | "errored";
/** What a fetcher gets besides the source value: `Async`'s work handle plus the previous value and the refetch info. */
export interface ResourceInfo<T> extends AsyncWork {
  /** The value before this fetch (`undefined` before the first one resolved). */
  readonly value: T | undefined;
  /** `false` for loads the source started; the `refetch(info)` argument (`true` without one) for refetches. */
  readonly refetching: unknown;
}
/** Loads the value for a source value. Its synchronous reads are not tracked; `info.signal` aborts when the load is superseded or its owner is disposed. */
export type ResourceFetcher<S, T> = (source: S, info: ResourceInfo<T>) => T | PromiseLike<T>;
/** A source: a value or an accessor; `false`, `null` and `undefined` mean "do not fetch". */
export type ResourceSource<S> = S | false | null | undefined | (() => S | false | null | undefined);
export interface ResourceOptions<T> {
  /** The value until the first load resolves (the resource starts `ready`). */
  initialValue?: T;
  /** `false`: never fetch during server rendering; the server renders the loading state and the browser loads after resume. */
  ssr?: boolean;
}
/**
 * A signal-shaped async value. Call it for the value (tracked; `undefined` until the first load resolves; throws the
 * failure while `errored`). The accessors are methods, so compiled bindings track them: `user.loading()`.
 * Keep the resource in one `const` and call its methods on it (`user.refetch()`): destructured methods lose it.
 */
export interface Resource<T> {
  (): T | undefined;
  /** `true` while a load is in flight (`pending` / `refreshing`). Tracked. */
  loading(): boolean;
  /** The failure of the last load while `errored`, else `undefined`. Tracked; never throws. */
  error(): unknown;
  /** The last resolved value, also while reloading or failed. Tracked; never throws. */
  latest(): T | undefined;
  /** The lifecycle state. Tracked. */
  state(): ResourceState;
  /** Load again with the current source value; `info` reaches the fetcher as `info.refetching` (default `true`). */
  refetch(info?: unknown): void;
  /** Set the value locally (optimistic UI); a load in flight still lands when it resolves. Returns the new value. */
  mutate(value: T | ((previous: T | undefined) => T)): T;
}

// Accessor ops: the resource function is `(op?, arg?)` (a resumed one `(seed, op?, arg?)`: dom-resume binds the server
// seed as its first argument). Methods live on a shared prototype so a bound copy (`Function.prototype.bind` keeps the
// target's prototype) still has them; each calls its receiver with the op.
const LOADING = 1,
  ERROR = 2,
  LATEST = 3,
  STATE = 4,
  REFETCH = 5,
  MUTATE = 6;
/** @internal State names by code (0 unresolved … 4 errored). */
export const _STATES: readonly ResourceState[] = ["unresolved", "pending", "ready", "refreshing", "errored"];
type Call = (op?: number, arg?: unknown) => unknown;
const method = (op: number) => ({
  value(this: Call, arg?: unknown) {
    return this(op, arg);
  },
});
/** @internal The prototype of resource functions (DOM and server). */
export const _PROTO: object = Object.create(Function.prototype, {
  loading: method(LOADING),
  error: method(ERROR),
  latest: method(LATEST),
  state: method(STATE),
  refetch: method(REFETCH),
  mutate: method(MUTATE),
});
/** @internal Op codes shared with server-resource.ts. */
export const _OPS = { LOADING, ERROR, LATEST, STATE, REFETCH, MUTATE } as const;

/** @internal A server resource's state as the browser receives it (server-resource.ts encodes it; dom-resume binds it). */
export interface ResourceSeed {
  /** The server's change counter: what the server bindings read, so writing it here re-runs them. */
  n: Signal<number>;
  /** State code (`_STATES`). */
  s: number;
  v?: unknown;
  e?: unknown;
  /** The source value the server loaded for (absent: not data, or a constant source). */
  k?: unknown;
  /** The server did not ship a usable value: load on first use. */
  x?: 1;
}
/** @internal Whether two source values name the same load (data compared by JSON, as the server shipped it). */
export function _sameKey(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
