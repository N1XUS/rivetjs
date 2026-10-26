// Lite runtime: keyed lists (`<For each by>`, RT-DIET lite v2; a leaf of `dom-lite.ts`, see `dom-lite-core.ts`).
import type { Signal } from "@rivetjs/reactivity";
import { type Eff, _lw, effect, miss, own, release, signal, untracked } from "./dom-lite-core.ts";

/** A row's static markup: `[tag, attributes, …children]`, a child a Text's data, `0` / `1` a content opener / closer. */
export type LiteSpec = [tag: string, attributes: Record<string, string>, ...children: (string | 0 | 1 | LiteSpec)[]];
const build = (d: Document, s: string | 0 | 1 | LiteSpec): Node => {
  if (typeof s == "string") return d.createTextNode(s);
  if (typeof s == "number") return d.createComment(s ? "]" : "[");
  const el = d.createElement(s[0]);
  for (const k in s[1]) el.setAttribute(k, s[1][k]!);
  for (let i = 2; i < s.length; i++) el.append(build(d, s[i] as LiteSpec));
  return el;
};
type Row<T> = [key: unknown, item: Signal<T>, index: Signal<number>, nodes: Node[], effects: Eff[]];
/**
 * A keyed list (`<For each by>`; RT-DIET lite v2): `at` = its content opener; server rows `<!--r[-->el<!--]-->` are
 * adopted in order (one per item of `each()`, else `LiteMiss`), each through `row(el, item, index)`; later lists
 * reconcile by key — kept rows get their new item / index, new rows are built from `spec`, removed rows release their
 * bindings, the rest move into order.
 */
export function _lf<T>(
  at: Node,
  each: () => readonly T[],
  by: (item: T, index: number) => unknown,
  row: (n: Element, item: Signal<T>, index: Signal<number>) => void,
  spec: LiteSpec,
): void {
  const d = at.ownerDocument!,
    end = _lw(at, "h"),
    make = (item: T, index: number, nodes?: Node[]): Row<T> => {
      const x = signal(item),
        i = signal(index),
        mine: Eff[] = [];
      nodes ??= [d.createComment("r["), build(d, spec), d.createComment("]")];
      own(mine, () => row(nodes[1] as Element, x, i));
      return [by(item, index), x, i, nodes, mine];
    };
  let rows: Row<T>[] = [],
    first = true;
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
