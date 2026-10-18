// libs/runtime/server.ts — _list replaces `items.map(row => <jsx/>)`.
// Each row's dynamic values go into ONE flat, presized array ("the tape") at rows * width.
// No record object per row. The `map` identity check is the "untampered built-ins" contract:
// if someone patched Array.prototype.map, we fall back to calling it and lose the fast path.
export function _list(
  items: readonly unknown[],
  original: (item: unknown, index: number, array: readonly unknown[]) => unknown,
  plan: ListPlan,
  each: (tape: unknown[], base: number, item: unknown, index: number) => void,
): unknown {
  const map = items.map;
  if (map !== arrayMap || !Array.isArray(items)) {
    if (typeof map !== "function") throw new TypeError("List source map is not a function");
    return Reflect.apply(map, items, [original]);
  }
  const length = toLength(items.length);
  const constructor = items.constructor;
  if (constructor !== Array) return speciesMap(items, length, constructor, original);
  // Presized while V8 still keeps a preallocated array in fast elements; growth copies otherwise
  // dominate the tape's allocation. Larger lists append in order.
  const width = plan.attributes.length,
    size = length * width;
  const tape: unknown[] = size <= PRESIZED ? new Array(size) : [];
  let rows = 0;
  for (let k = 0; k < length; k++) {
    if (k in items) {
      each(tape, rows * width, items[k], k);
      rows++;
    }
  }
  listPin ??= new List({ fragments: [""], attributes: [], bytes: null, fixed: 0 }, [], 0);
  return new List(plan, tape, rows);
}
