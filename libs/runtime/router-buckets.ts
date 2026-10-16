// Server-only route matcher: same first-match (declaration order) result as `router.ts`'s linear
// browser matcher, bucketed for large tables. Imported by `server-router.ts` only, so client bundles
// (`dom-router.ts`, `@rivetjs/router/client`) never ship it.
import { _fits, _pathMatch, _urlParts } from "./router.ts";
import type { _PathMatch, _Segment } from "./router.ts";

type Compiled = { index: number; pattern: _Segment[] };

/*
 * @internal Compile path patterns into a matcher returning the first matching index (declaration order).
 * Candidates are bucketed by first segment (declaration order kept inside each bucket); fully static
 * paths resolve through a Map when no earlier dynamic route could match them (only routes with a
 * parameter / splat segment can: an earlier static path either has the same key or cannot fit).
 */
export function _bucketPaths(patterns: readonly _Segment[][]): (url: URL) => _PathMatch | null {
  const compiled = patterns.map((pattern, index): Compiled => ({ index, pattern }));
  // `root`: candidates for `/`; `loose`: routes whose first segment is a parameter (in every bucket);
  // `buckets`: per first static segment, its routes merged with `loose` in declaration order;
  // `dynamic*`: the same lists restricted to routes with a parameter / splat segment.
  const root: Compiled[] = [],
    loose: Compiled[] = [],
    looseDynamic: Compiled[] = [],
    buckets = new Map<string, Compiled[]>(),
    dynamic = new Map<string, Compiled[]>(),
    exact = new Map<string, Compiled>();
  for (const entry of compiled) {
    const first = entry.pattern[0];
    const isStatic = entry.pattern.every((segment) => segment.text !== undefined);
    // Fully static (no `/` inside a segment): the Map answers it unless an earlier route already would.
    if (isStatic && entry.pattern.every((segment) => !segment.text!.includes("/"))) {
      const parts = entry.pattern.map((segment) => segment.text!),
        key = parts.join("/");
      const before = !first ? root : (dynamic.get(first.text!) ?? looseDynamic);
      if (!exact.has(key) && !before.some((other) => _fits(other.pattern, parts))) exact.set(key, entry);
    }
    if (!first || first.splat) root.push(entry);
    if (!first) continue;
    if (first.text === undefined) {
      loose.push(entry);
      looseDynamic.push(entry);
      for (const list of buckets.values()) list.push(entry);
      for (const list of dynamic.values()) list.push(entry);
    } else {
      let list = buckets.get(first.text);
      if (!list) {
        buckets.set(first.text, (list = loose.slice()));
        dynamic.set(first.text, looseDynamic.slice());
      }
      list.push(entry);
      if (!isStatic) dynamic.get(first.text)!.push(entry);
    }
  }
  return (input: URL): _PathMatch | null => {
    const parts = _urlParts(input);
    if (!parts) return null;
    let hit = exact.size ? exact.get(parts.join("/")) : undefined;
    // A decoded `/` inside a URL segment can collide with a longer static path: the scan decides.
    if (hit && hit.pattern.length !== parts.length) hit = undefined;
    if (!hit)
      for (const entry of parts.length ? (buckets.get(parts[0]!) ?? loose) : root)
        if (_fits(entry.pattern, parts)) {
          hit = entry;
          break;
        }
    return hit ? _pathMatch(hit.index, hit.pattern, parts) : null;
  };
}
