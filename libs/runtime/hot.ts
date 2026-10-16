// Development-only component hot replacement that keeps state. The Vite plugin (dev server, client
// environment) wraps each exported component of a module in `hot(impl, id)` and points app imports of
// `@rivetjs/reactivity` at `./hot-reactivity.ts`, whose `signal` is the one below. Never in builds.
//
// A wrapper renders its current implementation in a reactive region. When a module update registers
// a new implementation under the same id, every instance re-renders in place; signals created while an
// instance renders (its own and those of unwrapped components it renders) take the previous render's
// values by creation order, and wrapped children it renders adopt their old instances' state by
// position. Wrapped instances torn down by an update and created again later, outside that render
// (a lazy page inside a route that loads again), adopt the old state by id, oldest first.
// A render that creates a different number of signals re-renders once more from scratch.
//
// The first render runs when the wrapper is called (as an unwrapped component would), in a scope of its
// own that the first update disposes: a resumed page re-creating a region gets the server's
// `_regionState` values and keyed rows for the components it renders (dom-adopt reads them during the
// region read only); later renders run in the returned accessor's insertion.
import { createRoot, getOwner, onCleanup, signal as plainSignal, untrack, type Disposer, type EqualsOptions, type Signal } from "@rivetjs/reactivity";
import { _adoption } from "./dom-v2.ts";
// Devtools events (`DEV.emit`): `false` in production, so every `if (DEV)` below folds away.
import { DEV } from "#dev";

interface Instance {
  readonly id: string;
  signals: Signal<unknown>[];
  children: Instance[];
}
interface Prior {
  readonly values: readonly unknown[];
  readonly children: readonly Instance[];
}
interface Record {
  readonly impl: Signal<(props: unknown) => unknown>;
  readonly wrapper: (props: unknown) => unknown;
  /** Mounted instances. */
  readonly live: Set<Instance>;
  /** The module asks for fresh state on every update (`@refresh reset`). */
  reset: boolean;
}

let current: { instance: Instance; prior: Prior | null } | null = null;
const registry = new Map<string, Record>();
// Instances an update disposed, by id, until the next update (or a few seconds pass): replacements
// created asynchronously (no re-rendering parent to adopt them by position) take their state.
let updating = false;
const orphans = new Map<string, Instance[]>();
let expiry: ReturnType<typeof setTimeout> | undefined;
const unorphan = (instance: Instance): void => {
  const list = orphans.get(instance.id);
  const at = list ? list.indexOf(instance) : -1;
  if (at >= 0) list!.splice(at, 1);
};
// First-render scopes: transparent to the resume adoption (`dom-adopt.ts` `direct`), like the dev runtime's
// component owners — Show / For / `_regionState` under a hot component still count as the region read's own.
const scopes = new WeakSet<object>();
type Owners = { has(owner: object): boolean };
let inner: Owners | null = null;
const transparent: Owners = { has: (owner) => scopes.has(owner) || (inner !== null && inner.has(owner)) };
const see = (): void => {
  if (_adoption.dev !== transparent) {
    inner = _adoption.dev;
    _adoption.dev = transparent;
  }
};
const kind = (value: unknown): string => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value);
const snapshot = (instance: Instance): Prior => ({ values: instance.signals.map((s) => untrack(s)), children: instance.children });

/** `signal` for app code in development: inside a hot render, restores the previous value of its slot. */
export function signal<T>(initial: T, options?: EqualsOptions<T>): Signal<T> {
  const frame = current;
  if (!frame) return plainSignal(initial, options);
  const index = frame.instance.signals.length;
  const prior = frame.prior;
  // Same slot, same kind of value: keep it (a changed initial value does not reset state).
  const restore = prior !== null && index < prior.values.length && kind(prior.values[index]) === kind(initial);
  if (DEV && prior !== null && index < prior.values.length && !restore) DEV.emit("hot.reset", { id: frame.instance.id, reason: "kind", index });
  const created = plainSignal(restore ? (prior.values[index] as T) : initial, options);
  frame.instance.signals.push(created as Signal<unknown>);
  return created;
}

/** Register a component implementation; returns the stable wrapper for `id` (`file#export`). */
export function hot<P>(impl: (props: P) => unknown, id: string, reset = false): (props: P) => unknown {
  const known = registry.get(id);
  if (known) {
    known.reset = reset;
    if (DEV) DEV.emit("hot.update", { id, instances: known.live.size, reset: reset ? "refresh-reset" : null });
    orphans.clear();
    clearTimeout(expiry);
    updating = true;
    try {
      known.impl.set(impl as (props: unknown) => unknown);
    } finally {
      updating = false;
    }
    if (orphans.size) expiry = setTimeout(() => orphans.clear(), 5000);
    return known.wrapper;
  }
  const record: Record = {
    reset,
    live: new Set(),
    impl: plainSignal(impl as (props: unknown) => unknown),
    wrapper: (props) => {
      const parent = current;
      const instance: Instance = { id, signals: [], children: [] };
      // Re-created by a re-rendering parent: adopt the old instance at the same position.
      let prior: Prior | null = null;
      if (parent) {
        parent.instance.children.push(instance);
        const index = parent.prior?.children.findIndex((child) => child.id === id) ?? -1;
        if (index >= 0) {
          const old = parent.prior!.children[index]!;
          (parent.prior!.children as Instance[]).splice(index, 1);
          unorphan(old);
          prior = snapshot(old);
        }
      }
      if (!prior) {
        const old = orphans.get(id)?.shift();
        if (old) prior = snapshot(old);
      }
      const fresh = plainSignal(0);
      if (DEV) DEV.emit("sig.internal", { sig: fresh });
      let first = true;
      let clean = false;
      let mounted = true;
      record.live.add(instance);
      if (getOwner())
        onCleanup(() => {
          mounted = false;
          record.live.delete(instance);
          if (updating) (orphans.get(id) ?? orphans.set(id, []).get(id)!).push(instance);
        });
      const run = (render: (props: unknown) => unknown): unknown =>
        untrack(() => {
          if (!first) prior = clean ? null : snapshot(instance);
          if (record.reset) prior = null;
          first = false;
          clean = false;
          instance.signals = [];
          instance.children = [];
          const outer = current;
          current = { instance, prior: prior ? { values: prior.values, children: [...prior.children] } : null };
          try {
            return render(props);
          } finally {
            current = outer;
            if (prior && instance.signals.length !== prior.values.length) {
              if (DEV) DEV.emit("hot.reset", { id, reason: "shape" });
              // The state shape changed: render again without restoring anything.
              queueMicrotask(() => {
                clean = true;
                if (!mounted) return;
                fresh.update((n) => n + 1);
              });
            }
          }
        });
      see();
      let eager: { value: unknown; dispose: Disposer } | null = createRoot(() => {
        scopes.add(getOwner()!);
        return run(untrack(record.impl));
      });
      let waiting = true;
      return () => {
        const render = record.impl();
        fresh();
        // The accessor's first read returns the render made at the call.
        if (waiting) {
          waiting = false;
          return eager!.value;
        }
        if (eager !== null) {
          eager.dispose();
          eager = null;
        }
        return run(render);
      };
    },
  };
  registry.set(id, record);
  if (DEV) {
    DEV.emit("sig.internal", { sig: record.impl });
    DEV.emit("hot.register", { id, wrapper: record.wrapper, impl });
  }
  return record.wrapper;
}

/**
 * For a module's update callback: whether its non-component exports changed (functions compared by
 * source, other values by identity) or its export names did, so importers must update instead.
 */
export function changed(previous: { readonly [name: string]: unknown }, next: { readonly [name: string]: unknown }, names: readonly string[]): boolean {
  if (Object.keys(next).sort().join() !== [...names].sort().join()) return true;
  for (const name of Object.keys(previous)) {
    const a = previous[name],
      b = next[name];
    if (typeof a === "function" && typeof b === "function" ? String(a) !== String(b) : !Object.is(a, b)) return true;
  }
  return false;
}
