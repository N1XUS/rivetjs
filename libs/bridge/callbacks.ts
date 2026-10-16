// Callbacks out (spec §3.7): every function prop reaches the framework as one stable wrapper per island and key that
// calls the current function inside a reactivity `batch` (Rivet DOM updates flush synchronously when the call returns),
// with a throw routed to the island owner's error handlers (`catchError` / `ErrorBoundary`), rethrown to the framework
// when none handles it. After the island unmounts (`kill`) every wrapper is a no-op (dev: one warning): a framework
// timer / promise calling a stale prop never reaches a disposed Rivet owner. Not `_dispatch`: no first-click deferral (the framework has already painted its own update).
import { _handleError, batch, type Owner } from "@rivetjs/reactivity";
import { DEV } from "#dev";

/** @internal Framework props of one island: plain values, function props as stable batched wrappers. */
export interface Callbacks {
  /** Read every prop key (tracking when called inside an effect) into a fresh plain object. */
  snapshot(props: Record<string, unknown>): Record<string, unknown>;
  /** The island unmounted: every wrapper ignores later calls. */
  kill(): void;
}

/** @internal One island's callback table, bound to its owner. */
export function callbacks(owner: Owner | null): Callbacks {
  const current: Record<string, (...args: unknown[]) => unknown> = {};
  const wrappers: Record<string, (...args: unknown[]) => unknown> = {};
  let dead = false,
    warned = false;
  const wrap = (key: string) =>
    (wrappers[key] = function (this: unknown, ...args: unknown[]) {
      if (dead) {
        if (DEV && !warned) {
          warned = true;
          console.warn("[rivet:bridge] callback " + key + " called after its island unmounted: ignored");
        }
        return;
      }
      try {
        return batch(() => current[key]!.apply(this, args));
      } catch (error) {
        _handleError(error, owner);
      }
    });
  return {
    snapshot(props) {
      const out: Record<string, unknown> = {};
      for (const key in props) {
        const value = props[key];
        if (typeof value === "function") {
          current[key] = value as (...args: unknown[]) => unknown;
          out[key] = wrappers[key] ?? wrap(key);
        } else out[key] = value;
      }
      return out;
    },
    kill() {
      dead = true;
    },
  };
}
