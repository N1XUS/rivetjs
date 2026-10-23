// Development façade of `@rivetjs/reactivity/store` (`development` export condition). Same exports as
// store.ts; with a devtools hook installed, `createStore` reports `store.create` (level 1) with a lazy
// tree view (`_debugStore`). Production resolution never reaches this file.
import * as base from "./store.ts";
import { getOwner } from "./index.ts";
import { _debugStore, devtoolsHook } from "./debug.ts";
import type { Store } from "./store.ts";
export * from "./store.ts";

/** `createStore`, reported to the devtools hook as `store.create { store, owner, tree }`. */
export function createStore<T extends object>(initial: T): Store<T> {
  const store = base.createStore(initial);
  const hook = devtoolsHook();
  if (hook !== undefined && hook.level >= 1) hook.emit("store.create", { store, owner: getOwner(), tree: () => _debugStore(store) });
  return store;
}
