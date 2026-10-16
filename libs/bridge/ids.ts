// Per-request island ids (`i0`, `i1`, …), shared with the framework id prefix (React `identifierPrefix`), so `useId`
// never collides across islands. One counter per Rivet id scope (`withIdScope`: the router opens one per request, so
// ids restart with each page and segments of the same render continue the count); outside any scope a process-wide
// counter keeps ids document-unique.
import { _idScope, type IdScope } from "@rivetjs/runtime/id";

/** @internal Island state of one render. */
export interface RenderIslands {
  n: number;
  /** Adapters whose page-level `head()` this render already wrote (null outside an id scope: written per island). */
  heads: Set<string> | null;
}
const byScope = new WeakMap<IdScope, RenderIslands>();
const outside: RenderIslands = { n: 0, heads: null };

/** @internal The island state of the current render. */
export function _renderIslands(): RenderIslands {
  const scope = _idScope();
  if (scope === null) return outside;
  let state = byScope.get(scope);
  if (state === undefined) byScope.set(scope, (state = { n: 0, heads: new Set() }));
  return state;
}

/** @internal Restart the process-wide counter (tests). */
export function _resetIslandIds(): void {
  outside.n = 0;
}
