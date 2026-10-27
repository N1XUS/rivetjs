// Derived model, browser side: the component ABI (ZERO ABI-SPLIT 2026-10-27). `@rivetjs/runtime/dom-derived` — what
// compiled derived DOM modules import (`_b` / `_sig` / `_sigStore`) and the derived alias of `signal` (`_dsignal`,
// `derived-reactivity.ts`) — is this module only: a chunk that renders components (a client-rendered mount, a lite
// page's chunk) no longer pulls the adopt runtime (`dom-derived.ts`, `@rivetjs/runtime/dom-derived-runtime`). Until the
// runtime module is evaluated (the page's `data-rt` URL, imported by the inline loader before `start`) the ABI is the
// client render's: `_b(name, body)` = `body()`, `_sig` / `_sigStore` = `signal` / `createStore`; evaluating the runtime
// installs its implementations (`_abi`), which are the same outside an adopt run.
import { signal } from "@rivetjs/reactivity";
import type { EqualsOptions, Signal } from "@rivetjs/reactivity";
import { createStore } from "@rivetjs/reactivity/store";
import type { Store } from "@rivetjs/reactivity/store";
import { _adoption } from "./dom-v2.ts";
import { DEV } from "#dev";

/** The adopt runtime's ABI implementations (`dom-derived.ts`), plus its loose-signal wake (`l`). */
export interface DerivedAbi {
  b<T>(name: string, body: () => T): T;
  s<T>(key: string, init?: T, options?: EqualsOptions<T>): Signal<T>;
  st<T extends object>(key: string, init: T): Store<T>;
  d<T>(init?: T, options?: EqualsOptions<T>): Signal<T>;
  l(): void;
}
let H: DerivedAbi | null = null;
/** @internal The adopt runtime installs itself (`dom-derived.ts`, at evaluation). */
export const _abi = (impl: DerivedAbi): void => void (H = impl);

/**
 * Compiler ABI (derived DOM target): an interactive component's body. Client render: `body()`. Adopt run: a hole the
 * unit's alignment pairs with the server range of this boundary (adopted next as a unit of its own, or deferred).
 */
export function _b<T>(name: string, body: () => T): T {
  return H ? H.b(name, body) : body();
}

/** Compiler ABI (derived DOM target): keyed `signal(init)`; in an adopt run, the record's value. */
export function _sig<T>(key: string, init?: T, options?: EqualsOptions<T>): Signal<T> {
  return H ? H.s(key, init, options) : ((DEV && _adoption.signal) || signal)(init as T, options);
}

/** Compiler ABI (derived DOM target): keyed `createStore(init)`; in an adopt run, created from the record's value. */
export function _sigStore<T extends object>(key: string, init: T): Store<T> {
  return H ? H.st(key, init) : createStore(init);
}

/** The derived alias of `signal` (`@rivetjs/runtime/derived-reactivity`): see `dom-derived.ts` "Dependency facts". */
export function _dsignal<T>(init?: T, options?: EqualsOptions<T>): Signal<T> {
  // Outside an adopt run (and before the runtime runs) a write first wakes the deferred `MOD` records.
  return H ? H.d(init, options) : _guard(signal(init as T, options), wakeLoose);
}
const wakeLoose = (): void => H?.l();

/**
 * @internal `s.set` runs `fn` first. When `fn` wrapped `s.set` again (a woken record's lazy list waiting for this signal's
 * first write, `dom-derived.ts` `wakeOnWrite`), the write goes through that wrapper — it lands back here, then on the
 * setter (TOGGLE-TABS-COLD: the first cold selection of an uncontrolled Tabs skipped the panels' list).
 */
export function _guard<T>(s: Signal<T>, fn: () => void): Signal<T> {
  const set = s.set;
  const guarded = (s.set = function (this: unknown, value: T) {
    fn();
    return (s.set === guarded ? set : s.set).call(this, value);
  } as Signal<T>["set"]);
  return s;
}
