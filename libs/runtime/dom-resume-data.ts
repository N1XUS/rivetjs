// DOM-backed loader data (DOM-DATA, spec docs/design/specs/2026-10-20-dom-backed-loader-data-design.md §3.3): the resume
// runtime's reader of `D` table entries (`resume-format.ts` `DomTree`) — plain JSON trees whose strings the server rendered
// as an element's whole text and left out of the state. Only builds with `rivet({ resume: { domData: true } })` reach this
// module (`dom-data-resume.ts`, served by the compiler plugin); `dom-resume.ts` calls it under `DOM_DATA`.
// Snapshot rule (§3.4): a tree is read on its first decode, and every tree still unread is read at the first idle after
// start / a streamed patch (`sweep`), before client code or a region re-creation replaces server nodes; the decoded value
// is plain data from then on (the DOM text may change, the value does not).
import { DEV } from "#dev";
import type { DomTree, TableEntry } from "./resume-format.ts";

export interface DomDataContext {
  /** The element of a `data-r` / path-addressed (`w`) id (dom-resume `element`: throws when it is missing). */
  element(id: number): Element;
  /** The root element of row region `marker` (the element before its end marker), if the page has it. */
  row(marker: number): Element | null | undefined;
}
type Shape = [skeleton: unknown, paths: string[], subs: unknown[]];

export function _domData(ctx: DomDataContext): {
  expand(table: TableEntry[]): void;
  dom(tree: DomTree, get: (index: number) => unknown): unknown;
  sweep(table: readonly TableEntry[], get: (index: number) => unknown, decoded: (index: number) => boolean): void;
} {
  const missing = (what: string): Error =>
    new Error(DEV ? DEV.hint("Rivet resume: DOM-backed data has no " + what, "drift") : "Missing resume DOM data " + what);
  const anchor = (a: number): Element => {
    if (a >= 0) return ctx.element(a);
    const root = ctx.row(-1 - a);
    if (!root) throw missing("row r" + (-1 - a));
    return root;
  };
  // `tag:i.j` below `root` by element child index (the server's `rowTexts` path), the tag checked: its whole text, or
  // with `@name` its attribute; `#…`: the number it spells.
  const text = (root: Element, path: string): string | number => {
    const number = path.charCodeAt(0) === 35,
      at = path.indexOf("@"),
      steps = path.slice(+number, at < 0 ? undefined : at).split(/[:.]/);
    let node: Element | undefined = root;
    for (let i = 1; node && i < steps.length; i++) if (steps[i]) node = node.children[+steps[i]!];
    const value = node?.localName !== steps[0] ? null : at < 0 ? node!.textContent : node!.getAttribute(path.slice(at + 1));
    if (value === null) throw missing("<" + steps[0] + "> at " + path);
    return number ? +value : value;
  };
  // Leaves: 0 = the next literal (`at.i`), k ≥ 1 = the text at `paths[k - 1]` below `root` (or the row's exception for k),
  // k < 0 = a rows node of skeleton `subs[-1 - k]`: stream `first anchor, stride, count, n, n × (row, k, value)`, then
  // each row's literals in turn (row r below the anchor `first + r * stride`).
  const fill = (skeleton: unknown, root: Element | null, shape: Shape, source: DomTree, at: { i: number }, own?: Map<number, unknown>): unknown => {
    if (typeof skeleton === "number") {
      if (skeleton === 0) return source[at.i++];
      if (skeleton > 0) return own?.has(skeleton) ? own.get(skeleton) : text(root!, shape[1][skeleton - 1]!);
      const first = source[at.i] as number,
        stride = source[at.i + 1] as number,
        out: unknown[] = new Array(source[at.i + 2] as number),
        end = at.i + 4 + 3 * (source[at.i + 3] as number),
        exceptions = new Map<number, Map<number, unknown>>();
      for (let e = at.i + 4; e < end; e += 3) {
        const row = source[e] as number;
        if (!exceptions.has(row)) exceptions.set(row, new Map());
        exceptions.get(row)!.set(source[e + 1] as number, source[e + 2]);
      }
      at.i = end;
      for (let r = 0; r < out.length; r++) out[r] = fill(shape[2][-1 - skeleton], anchor(first + r * stride), shape, source, at, exceptions.get(r));
      return out;
    }
    if (Array.isArray(skeleton)) {
      const out: unknown[] = new Array(skeleton.length);
      for (let i = 0; i < skeleton.length; i++) out[i] = fill(skeleton[i], root, shape, source, at, own);
      return out;
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(skeleton as object)) {
      const value = fill((skeleton as Record<string, unknown>)[key], root, shape, source, at, own);
      if (key === "__proto__") Object.defineProperty(out, key, { value, writable: true, enumerable: true, configurable: true });
      else out[key] = value;
    }
    return out;
  };
  return {
    // Runs (`{Dr: [shape, first anchor, stride, count, ...literals]}`, then count - 1 placeholders) back to one `D` entry each.
    expand(table) {
      for (let i = 0; i < table.length; i++) {
        const run = (table[i] as { Dr?: DomTree } | null)?.Dr;
        if (run === undefined) continue;
        const count = run[3] as number,
          width = (run.length - 4) / count;
        for (let k = 0; k < count; k++)
          table[i + k] = { D: [run[0]!, (run[1] as number) + k * (run[2] as number), ...run.slice(4 + k * width, 4 + (k + 1) * width)] };
      }
    },
    dom(tree, get) {
      const shape = get(tree[0] as number) as Shape;
      return fill(shape[0], tree[1] === null ? null : anchor(tree[1] as number), shape, tree, { i: 2 });
    },
    sweep(table, get, decoded) {
      for (let i = 0; i < table.length; i++) {
        const entry = table[i];
        if (entry !== null && typeof entry === "object" && "D" in entry && !decoded(i))
          try {
            get(i);
          } catch (error) {
            // Left for its first reader (which gets the same error): a page whose markup was changed before resume.
            if (DEV) console.warn(error);
          }
      }
    },
  };
}
