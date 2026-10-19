// SSR-stable unique ids (`@rivetjs/runtime/id`) for ARIA relations (`for`, `aria-labelledby`,
// `aria-controls`, …). Resumed pages never hydrate, so ids only need to be unique in the document.
//
// Namespaces (decimal counters, so no namespace is an alphanumeric extension of another — a base-36
// server counter reached `rvc0`, the first browser id, at its 433rd id):
// - `rv` + n: one render (`withIdScope("rv", …)` — the router opens it per request: same page, same ids);
// - `rvs` + n: server ids outside any scope (module level, after an `await`): process-wide, never reset
//   by a request, so they cannot collide with a request's `rv` ids;
// - `rvc` + n: created in the browser (`id-dom.ts`, `browser` export condition), so a region re-created
//   after resume never collides with server markup;
// - `rv-<hash>-` + n: fragments of `@rivetjs/runtime/server-cache` (rendered once, replayed into many pages);
// - `rvr<for>_<index>_` + n: one row of a lazy `For` (LAZY-ROWS, `_rowIdPrefix`): seeded from the For's id and the
//   row's index, so the server render and a later browser materialisation of that row create the same ids.
import { createContext, provide, useContext } from "@rivetjs/reactivity";

/** @internal One id counter: `prefix` + decimal `n`. */
export interface IdScope {
  readonly prefix: string;
  n: number;
}
const SCOPE = createContext<IdScope | null>(null);
const server: IdScope = { prefix: "rvs", n: 0 };

/** @internal Next id of the nearest `withIdScope`, else of `fallback`. */
export function _nextId(fallback: IdScope): string {
  const scope = useContext(SCOPE) ?? fallback;
  return scope.prefix + scope.n++;
}

/**
 * A document-unique id. Inside `withIdScope` (router: every page render): `prefix` + 0, 1, … per scope
 * (deterministic HTML). Server outside any scope: `rvs0`, `rvs1`, … from a process-wide counter.
 */
export function createId(): string {
  return _nextId(server);
}

/** @internal Restart the process-wide counter (`@rivetjs/runtime/testing` `cleanup()`: test-order independent ids). */
export function _resetIds(): void {
  server.n = 0;
}

/** Run `fn` with its own id counter: ids are `prefix` + n, from 0 (one render root, tests, multi-root pages). */
export function withIdScope<T>(prefix: string, fn: () => T): T {
  return provide(SCOPE, { prefix, n: 0 }, fn);
}

/** @internal The nearest `withIdScope` counter (null outside any): identifies the render ids are unique within. */
export function _idScope(): IdScope | null {
  return useContext(SCOPE);
}

/**
 * @internal Id prefix of row `index` of the lazy `For` with resume id `forId` (spec 2026-10-19 lazy collection rows §3.1 /
 * §3.2): the server renders each lazy row under `{ prefix: _rowIdPrefix(forId, index), n: 0 }` (`_inIdScope`), and the
 * browser materialises it under the same seed, so ids inside the row (`createId`, cdk `useId`) are byte-equal.
 */
export const _rowIdPrefix = (forId: number, index: number): string => "rvr" + forId + "_" + index + "_";

/** @internal Run `fn` with `scope` as its id counter (render cache probes: the caller reads `scope.n` afterwards). */
export function _inIdScope<T>(scope: IdScope, fn: () => T): T {
  return provide(SCOPE, scope, fn);
}
