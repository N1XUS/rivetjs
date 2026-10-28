// Lite runtime: keyed lists (`<For each by>`, RT-DIET lite v2; a leaf of `dom-lite.ts`, see `dom-lite-core.ts`).
import type { Signal } from "@rivetjs/reactivity";
import { type Eff, _lw, effect, miss, own, release, signal, untracked } from "./dom-lite-core.ts";
import { build, type LiteSpec } from "./dom-lite-spec.ts";

export type { LiteSpec } from "./dom-lite-spec.ts";
type Row<T> = [key: unknown, item: Signal<T>, index: Signal<number>, nodes: Node[], effects: Eff[]];
/**
 * A keyed list (`<For each by>`; RT-DIET lite v2): `at` = its content opener; server rows `<!--r[-->el<!--]-->` are
 * adopted in order (one per item of `each()`, else `LiteMiss`), each through `row(el, item, index)`; later lists
 * reconcile by key — kept rows get their new item / index, new rows are built from `spec` (`0`: copies of the first server row), removed rows release their
 * bindings, the rest move into order.
 */
export function _lf<T>(
  at: Node,
  each: () => readonly T[],
  by: (item: T, index: number) => unknown,
  row: (n: Element, item: Signal<T>, index: Signal<number>) => void,
  spec: LiteSpec | 0,
): void {
  const d = at.ownerDocument!,
    end = _lw(at, "h"),
    make = (item: T, index: number, nodes?: Node[]): Row<T> => {
      const x = signal(item),
        i = signal(index),
        mine: Eff[] = [];
      nodes ??= [d.createComment("r["), spec ? build(d, spec) : tpl!.cloneNode(true), d.createComment("]")];
      own(mine, () => row(nodes[1] as Element, x, i));
      return [by(item, index), x, i, nodes, mine];
    };
  let rows: Row<T>[] = [],
    first = true,
    tpl: Element | undefined;
  untracked(() => {
    const items = each();
    for (let n = at.nextSibling, i = 0; n != end; n = n!.nextSibling, i++) {
      const el = n!.nextSibling,
        close = el?.nextSibling;
      if (i >= items.length || n!.nodeType != 8 || !(n as Comment).data.startsWith("r") || el?.nodeType != 1 || (close as Comment)?.data != "]") miss("row");
      rows.push(make(items[i]!, i, [n!, el!, close!]));
      n = close!;
    }
    if (rows.length != items.length) miss("rows");
    // RT-DIET2: a row holding a static component child (spec `0`) is built as a copy of the first server row (its live
    // parts are the row's bindings, rewritten when they run); a boundary inside it (its own record) is not copied.
    // (Its current state does not matter: a copy's bindings rewrite every live part.)
    spec || (rows.length && !/--b\d|data-b/.test((tpl = rows[0]![3][1] as Element).outerHTML)) || miss("copy");
  });
  effect(() => {
    const next = each();
    if (first) return void (first = false);
    const keep = new Map(rows.map((r) => [r[0], r])),
      out: Row<T>[] = [];
    next.forEach((item, index) => {
      const k = by(item, index),
        r = keep.get(k);
      if (r) (keep.delete(k), r[1].set(item), r[2].set(index), out.push(r));
      else out.push(make(item, index));
    });
    for (const r of keep.values()) (r[3].forEach((n) => (n as ChildNode).remove()), release(r[4]));
    let after: Node = at;
    for (const r of out) {
      const ref = after.nextSibling;
      if (ref != r[3][0]) for (const n of r[3]) end.parentNode!.insertBefore(n, ref);
      after = r[3][2]!;
    }
    rows = out;
  });
}
