// Nested reactive state without proxies (`@rivetjs/reactivity/store`). A store is a plain node tree:
// each node holds one signal with the value at its path, and child nodes exist only for paths that
// were read. Data is immutable and structurally shared, so writes copy the containers along the path
// and notify exactly the nodes whose value changed. Plain objects of signals: resume-serializable
// through the ordinary table, with one entry per read path.
import { batch, signal, untrack, type Signal } from "./index.ts";

declare const phantom: unique symbol;
/** A store node: `v` holds the value at this path, `c` the child nodes created by reads. */
export interface Store<T = unknown> {
  readonly v: Signal<T>;
  c?: Record<string, Store<unknown>>;
  readonly [phantom]?: (value: T) => T;
}
/** A typed cursor into a store (`at(store, "todos.0")`): reads and writes are relative to `p`. */
export interface StoreView<T = unknown> {
  readonly s: Store<any>;
  /** Path prefix with trailing dot (`"todos.0."`). */
  readonly p: string;
  readonly [phantom]?: (value: T) => T;
}
/** A store or a view of one. */
export type StoreLike<T = unknown> = Store<T> | StoreView<T>;

type Leaf =
  string | number | boolean | bigint | symbol | null | undefined | Date | RegExp | Map<unknown, unknown> | Set<unknown> | ((...args: never[]) => unknown);
type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7];
/** Every dotted path of `T` (arrays as `${number}`, depth capped at 8), like forms' `FieldPath`. */
export type StorePath<T, D extends number = 8> = [D] extends [never]
  ? never
  : T extends Leaf
    ? never
    : T extends readonly (infer U)[]
      ? `${number}` | `${number}.${StorePath<NonNullable<U>, Depth[D]>}`
      : { [K in keyof T & string]: K | `${K}.${StorePath<NonNullable<T[K]>, Depth[D]>}` }[keyof T & string];
type Step<T, K extends string> = T extends readonly (infer U)[] ? (K extends `${number}` ? U : undefined) : K extends keyof T ? T[K] : undefined;
/** The value type at path `P` of `T`. */
export type StoreValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? StoreValue<NonNullable<Step<NonNullable<T>, Head>>, Rest>
  : Step<NonNullable<T>, P>;
/** A new value, or an updater of the previous one. A function is always an updater: store a function
 * value through one (`write(st, "onSave", () => handler)`); raw function values do not typecheck. */
export type StoreUpdate<V> = Exclude<V, Function> | ((previous: V) => V);

type Node = Store<unknown>;
type Container = Record<string, unknown> | unknown[];
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
// Node lookup per root and absolute path (never serialized; rebuilt lazily after resume).
const caches = new WeakMap<Node, Map<string, Node>>();
const isIndex = (segment: string): boolean => /^(0|[1-9]\d*)$/.test(segment);
const container = (value: unknown): value is Container => value !== null && typeof value === "object";
const childOf = (value: unknown, segment: string): unknown =>
  container(value) && !FORBIDDEN.has(segment) && Object.hasOwn(value, segment) ? (value as Record<string, unknown>)[segment] : undefined;

function segments(path: string): string[] {
  const parts = path.split(".");
  for (const part of parts) if (!part || FORBIDDEN.has(part)) throw new TypeError("Invalid store path " + JSON.stringify(path));
  return parts;
}
const split = (store: StoreLike<any>): [Node, string] => ("s" in store ? [store.s, store.p] : [store as Node, ""]);
const absolute = (prefix: string, path: string | undefined): string => (path === undefined || path === "" ? prefix.slice(0, -1) : prefix + path);

/** The node at an absolute path, created (with its ancestors) from the current data on first use. */
function node(root: Node, path: string): Node {
  if (path === "") return root;
  let cache = caches.get(root);
  if (!cache) caches.set(root, (cache = new Map()));
  const cached = cache.get(path);
  if (cached) return cached;
  let found: Node = root;
  for (const segment of segments(path)) {
    const parent: Node = found,
      children: Record<string, Node> = (parent.c ??= {});
    found = Object.hasOwn(children, segment) ? children[segment]! : (children[segment] = { v: signal(childOf(untrack(parent.v), segment)) });
  }
  cache.set(path, found);
  return found;
}

/** Create a store holding `initial` (treated as immutable: writes copy, never mutate). */
export function createStore<T extends object>(initial: T): Store<T> {
  return { v: signal(initial) } as Store<T>;
}

/** Tracked read of the whole store (or view). */
export function read<T>(store: StoreLike<T>): T;
/** Tracked read of one path: the caller re-runs only when the value at that path changes. */
export function read<T, P extends StorePath<T>>(store: StoreLike<T>, path: P): StoreValue<T, P>;
export function read(store: StoreLike<any>, path?: string): unknown {
  const [root, prefix] = split(store);
  return node(root, absolute(prefix, path)).v();
}

/** A typed cursor at `path`: reads and writes through it are relative. Serializable (plain object). */
export function at<T, P extends StorePath<T>>(store: StoreLike<T>, path: P): StoreView<StoreValue<T, P>> {
  const [root, prefix] = split(store);
  const full = prefix + path;
  segments(full);
  return { s: root, p: full + "." } as StoreView<StoreValue<T, P>>;
}

/** Replace the whole store (or view) value: a value, or an updater of the previous one. */
export function write<T>(store: StoreLike<T>, next: StoreUpdate<T>): void;
/** Write one path: containers along it are copied (created when missing), then exactly the read paths whose value changed are notified, in one batch. */
export function write<T, P extends StorePath<T>>(store: StoreLike<T>, path: P, next: StoreUpdate<StoreValue<T, P>>): void;
export function write(store: StoreLike<any>, ...args: [unknown] | [string, unknown]): void {
  const [root, prefix] = split(store);
  const path = absolute(prefix, args.length === 2 ? (args[0] as string) : undefined);
  const next = args[args.length - 1];
  const keys = path === "" ? [] : segments(path);
  // Current values along the path (index 0: the root value).
  const values: unknown[] = [untrack(root.v)];
  for (let i = 0; i < keys.length; i++) values.push(childOf(values[i], keys[i]!));
  const previous = values[keys.length];
  const value = typeof next === "function" ? untrack(() => (next as (previous: unknown) => unknown)(previous)) : next;
  if (Object.is(previous, value)) return;
  // Copy the containers along the path, innermost first.
  const updated: unknown[] = new Array(keys.length + 1);
  updated[keys.length] = value;
  for (let i = keys.length - 1; i >= 0; i--) {
    const key = keys[i]!,
      parent = values[i];
    // Missing containers are created; a primitive on the path is not silently replaced by one.
    if (parent != null && !container(parent))
      throw new TypeError(`Store write "${path}": "${keys.slice(0, i).join(".") || "(root)"}" holds a ${typeof parent}, not an object or array`);
    const copy: Container = Array.isArray(parent) ? parent.slice() : container(parent) ? { ...parent } : isIndex(key) ? [] : {};
    (copy as Record<string, unknown>)[key] = updated[i + 1];
    updated[i] = copy;
  }
  batch(() => {
    let at: Node | undefined = root;
    root.v.set(updated[0]);
    for (let i = 0; i < keys.length; i++) {
      at = at.c !== undefined && Object.hasOwn(at.c, keys[i]!) ? at.c[keys[i]!] : undefined;
      // Deeper nodes exist only below existing ones.
      if (at === undefined) return;
      at.v.set(updated[i + 1]);
    }
    refresh(root, at, value, path);
  });
}
// Bring the read paths under a changed node up to date; equal values end the descent (shared data).
// A node whose key is gone and that nothing observes (itself or below) is dropped with its cache
// entries: a later read re-creates it from the data. Observed ones stay (their readers see the key return).
function refresh(root: Node, at: Node, value: unknown, path: string): void {
  const children = at.c;
  if (children === undefined) return;
  for (const key in children) {
    const child = children[key]!,
      next = childOf(value, key);
    if (next === undefined && !(container(value) && Object.hasOwn(value, key)) && !observed(child)) {
      delete children[key];
      forget(caches.get(root), path === "" ? key : path + "." + key, child);
      continue;
    }
    if (Object.is(untrack(child.v), next)) continue;
    child.v.set(next);
    refresh(root, child, next, path === "" ? key : path + "." + key);
  }
}
// Whether any reader observes the node or a node below it (the signal's internal source links, as
// debug.ts reads them: `observers` is null until something subscribes).
let SIGNAL: symbol | undefined;
function observed(at: Node): boolean {
  SIGNAL ??= Object.getOwnPropertySymbols(at.v).find((key) => key.description === "rivet.signal")!;
  if ((at.v as unknown as Record<symbol, { observers: unknown }>)[SIGNAL]!.observers !== null) return true;
  for (const key in at.c) if (observed(at.c[key]!)) return true;
  return false;
}
function forget(cache: Map<string, Node> | undefined, path: string, at: Node): void {
  if (cache === undefined) return;
  cache.delete(path);
  for (const key in at.c) forget(cache, path + "." + key, at.c[key]!);
}

// Structural merge: `next` with every subtree equal to `previous`'s replaced by the previous one
// (identity kept, so readers of unchanged paths are not notified).
function merge(previous: unknown, next: unknown): unknown {
  if (Object.is(previous, next) || !container(previous) || !container(next)) return next;
  const array = Array.isArray(next);
  if (array !== Array.isArray(previous) || Object.getPrototypeOf(previous) !== Object.getPrototypeOf(next)) return next;
  const prototype = Object.getPrototypeOf(next);
  if (!array && prototype !== Object.prototype && prototype !== null) return next;
  const keys = Object.keys(next);
  let result = next;
  let same = keys.length === Object.keys(previous).length && (!array || (next as unknown[]).length === (previous as unknown[]).length);
  for (const key of keys) {
    const merged = merge(childOf(previous, key), (next as Record<string, unknown>)[key]);
    if (!Object.is(merged, childOf(previous, key)) || !Object.hasOwn(previous, key)) same = false;
    // A finalized draft can be an existing snapshot subtree. Never merge into it in place.
    if (!Object.is(merged, (next as Record<string, unknown>)[key])) {
      if (result === next) result = shallow(next);
      (result as Record<string, unknown>)[key] = merged;
    }
  }
  return same ? previous : result;
}

// `produce` drafts: copy-on-write proxies over plain objects and arrays. A draft copies its container
// (shallowly) on its first write and marks its ancestors written; reads of untouched paths never copy.
// Map / Set / Date reached through a draft are copied on access (mutate them freely); other class
// instances and functions are values kept by identity (replace them; in-place mutation is not seen).
interface Draft {
  base: Container;
  copy: Container | null;
  parent: Draft | null;
  // Child drafts (and copied Map / Set / Date) by key, while the key still holds them.
  children: Map<PropertyKey, unknown> | null;
  // Keys written or deleted through this draft.
  written: Set<PropertyKey> | null;
  result: unknown;
  done: boolean;
}
const drafts = new WeakMap<object, Draft>();
const plain = (value: unknown): value is Container => {
  if (!container(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return Array.isArray(value) || prototype === Object.prototype || prototype === null;
};
const shallow = (value: Container): Container =>
  Array.isArray(value) ? value.slice() : Object.getPrototypeOf(value) === null ? Object.assign(Object.create(null), value) : { ...value };
const copied = (value: unknown): unknown =>
  value instanceof Map ? new Map(value) : value instanceof Set ? new Set(value) : value instanceof Date ? new Date(value.getTime()) : undefined;

function written(draft: Draft): Container {
  for (let at: Draft | null = draft; at !== null && at.copy === null; at = at.parent) at.copy = shallow(at.base);
  return draft.copy!;
}
function touch(draft: Draft, key: PropertyKey): Container {
  const copy = written(draft);
  draft.children?.delete(key);
  (draft.written ??= new Set()).add(key);
  return copy;
}
function draftOf(base: Container, parent: Draft | null, revokes: (() => void)[]): object {
  const draft: Draft = { base, copy: null, parent, children: null, written: null, result: undefined, done: false };
  // The target only carries the array-ness (`Array.isArray(draft)`); every trap reads the draft state.
  const { proxy, revoke } = Proxy.revocable(Array.isArray(base) ? [] : {}, {
    get(_, key) {
      const source = draft.copy ?? draft.base;
      if (!Object.hasOwn(source, key)) return Reflect.get(source, key, proxy);
      const own = draft.children?.get(key);
      if (own !== undefined) return own;
      const value = (source as Record<PropertyKey, unknown>)[key];
      let child: unknown;
      if (plain(value) && !drafts.has(value)) child = draftOf(value, draft, revokes);
      else if ((child = copied(value)) !== undefined) (touch(draft, key) as Record<PropertyKey, unknown>)[key] = child;
      else return value;
      (draft.children ??= new Map()).set(key, child);
      return child;
    },
    set(_, key, value) {
      const source = draft.copy ?? draft.base;
      if (
        Object.hasOwn(source, key) &&
        (draft.children?.get(key) === value || (Object.is((source as Record<PropertyKey, unknown>)[key], value) && !draft.children?.has(key)))
      )
        return true;
      (touch(draft, key) as Record<PropertyKey, unknown>)[key] = value;
      return true;
    },
    deleteProperty(_, key) {
      if (Object.hasOwn(draft.copy ?? draft.base, key)) delete (touch(draft, key) as Record<PropertyKey, unknown>)[key];
      return true;
    },
    defineProperty(_, key, descriptor) {
      return Reflect.defineProperty(touch(draft, key), key, descriptor);
    },
    has: (_, key) => key in (draft.copy ?? draft.base),
    ownKeys: () => Reflect.ownKeys(draft.copy ?? draft.base),
    getOwnPropertyDescriptor(_, key) {
      const source = draft.copy ?? draft.base,
        descriptor = Reflect.getOwnPropertyDescriptor(source, key);
      // Array `length` stays non-configurable, like the (array) target's.
      return (
        descriptor && { value: descriptor.value, writable: true, enumerable: descriptor.enumerable, configurable: !(Array.isArray(source) && key === "length") }
      );
    },
    getPrototypeOf: () => Object.getPrototypeOf(draft.base),
    setPrototypeOf: () => false,
  });
  drafts.set(proxy, draft);
  revokes.push(revoke);
  return proxy;
}
// The value a draft (or a new value that may hold drafts) stands for once `mutate` returned.
function finalize(value: unknown): unknown {
  const draft = container(value) ? drafts.get(value) : undefined;
  if (draft === undefined) {
    // A new container written into the draft: replace drafts inside it (in place: it is new data).
    if (plain(value))
      for (const key of Object.keys(value)) {
        const item = (value as Record<string, unknown>)[key],
          next = finalize(item);
        if (next !== item) (value as Record<string, unknown>)[key] = next;
      }
    return value;
  }
  if (draft.done) return draft.result;
  draft.done = true;
  const { base, copy } = draft;
  if (copy === null) return (draft.result = base);
  const into = copy as Record<PropertyKey, unknown>,
    from = base as Record<PropertyKey, unknown>;
  // Assigning array length removes keys without invoking this proxy's delete trap. A later regrowth must keep those
  // holes even when the final length equals the base's, and cached drafts of the removed elements must stay detached.
  let changed = Array.isArray(copy) && Object.keys(copy).length !== Object.keys(base).length;
  if (draft.children !== null)
    for (const [key, child] of draft.children) {
      if (!Object.hasOwn(copy, key)) continue;
      const next = finalize(child);
      into[key] = next;
      if (!Object.is(next, from[key])) changed = true;
    }
  if (draft.written !== null)
    for (const key of draft.written) {
      const had = Object.hasOwn(base, key);
      if (!Object.hasOwn(copy, key)) {
        if (had) changed = true;
        continue;
      }
      // Written values merge with the previous value: equal subtrees keep its identity.
      const next = draft.children?.has(key) ? into[key] : finalize(into[key]);
      const merged = had ? merge(from[key], next) : next;
      into[key] = merged;
      if (!had || !Object.is(merged, from[key])) changed = true;
    }
  return (draft.result = changed ? copy : base);
}

/** Updater: mutate a copy-on-write draft of the previous value. Only written paths are copied; every
 * other subtree (and every written subtree equal to the previous one) keeps its identity. */
export function produce<V>(mutate: (draft: V) => void): (previous: V) => V {
  return (previous) => {
    if (!plain(previous)) {
      // A Map / Set / Date root is mutated as a copy; other values as they are.
      const copy = copied(previous);
      mutate((copy ?? previous) as V);
      return (copy ?? previous) as V;
    }
    const revokes: (() => void)[] = [];
    try {
      const draft = draftOf(previous, null, revokes);
      mutate(draft as V);
      return finalize(draft) as V;
    } finally {
      for (const revoke of revokes) revoke();
    }
  };
}

/** Updater: replace with `next`, keeping the identity of every subtree equal to the previous one. */
export function reconcile<V>(next: NoInfer<V>): (previous: V) => V {
  return (previous) => merge(previous, structuredClone(next)) as V;
}
