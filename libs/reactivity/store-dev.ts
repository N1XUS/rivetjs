// Development façade of `@rivetjs/reactivity/store` (`development` export condition). Same exports as
// store.ts; with a devtools hook installed, `createStore` reports `store.create` (level 1) with a lazy
// tree view (`_debugStore`); `read` / `write` call a resumed narrowed store's shipped-path check (runtime dev
// `resumeStore`, Function Bridge T12). Production resolution never reaches this file.
import * as base from "./store.ts";
import { getOwner } from "./index.ts";
import { _debugStore, devtoolsHook } from "./debug.ts";
import type { Store, StoreLike } from "./store.ts";
export * from "./store.ts";

/** `createStore`, reported to the devtools hook as `store.create { store, owner, tree }`. */
export function createStore<T extends object>(initial: T): Store<T> {
  const store = base.createStore(initial);
  const hook = devtoolsHook();
  if (hook !== undefined && hook.level >= 1) hook.emit("store.create", { store, owner: getOwner(), tree: () => _debugStore(store) });
  return store;
}

// Installed on a resumed narrowed store's root by the runtime's dev decoder (`DEV.resumeStore`): warns on a read of a
// path the page did not ship; a write marks its path as present.
const SHIPPED = Symbol.for("rivet.store.shipped");
type Shipped = (path: string, write?: true) => void;
function shipped(store: StoreLike<any>, path: unknown, write?: true): void {
  const view = "s" in store,
    check = ((view ? store.s : store) as { [SHIPPED]?: Shipped })[SHIPPED];
  if (check === undefined) return;
  const prefix = view ? store.p : "";
  check(typeof path === "string" && path !== "" ? prefix + path : prefix.slice(0, -1), write);
}
/** `read`, checking a resumed narrowed store's shipped paths. */
export const read: typeof base.read = ((store: StoreLike<any>, ...path: [string?]) => {
  shipped(store, path[0]);
  return (base.read as (store: StoreLike<any>, ...path: [string?]) => unknown)(store, ...path);
}) as typeof base.read;
/** `write`, marking the written path of a resumed narrowed store as present (an updater reads it first). */
export const write: typeof base.write = ((store: StoreLike<any>, ...args: [unknown] | [string, unknown]) => {
  const path = args.length === 2 ? args[0] : undefined;
  if (typeof args[args.length - 1] === "function") shipped(store, path);
  shipped(store, path, true);
  return (base.write as (store: StoreLike<any>, ...args: [unknown] | [string, unknown]) => void)(store, ...args);
}) as typeof base.write;
