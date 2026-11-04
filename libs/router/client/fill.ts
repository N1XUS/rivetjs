// Fill routes (`export const fill = true` in a page or layout module): the routes region and the layout outlets of a
// route that fills carry `data-rivet-fill` (generated `.rivet/fill.css` makes them stretch), so the page takes the whole
// content area of its layout without wrappers. Used by the generated `App` only when some routes fill and others do not.
import { compileRoutes } from "@rivetjs/runtime/router";

/** @internal Generated `App`: the regions' `data-rivet-fill` value for the shown route (`table`: every page route, in match order). */
export function _fill(router: { location(): URL }, table: readonly (readonly [path: string, fill: 0 | 1])[]): () => "" | undefined {
  const match = compileRoutes(table.map(([path]) => ({ path, render: () => null }))),
    filled = new Set(table.filter((row) => row[1]).map((row) => row[0]));
  return () => {
    const hit = match(router.location());
    return hit && filled.has(hit.route.path) ? "" : undefined;
  };
}
