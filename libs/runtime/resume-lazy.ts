// Inline lazy rows add-on (LAZY-ROWS T5), shipped only on pages with lazy row region records (state `L`), before the state
// script (after the rows add-on, whose `$rw` it wraps). Serialized with String(lazy), so it must be self-contained:
// browser globals only.
//
// A lazy `<For>` row is plain server markup between its marker pair `<!--rN[-->…<!--]-->` (N = forId + 1 + k): no `data-r`,
// no handler entry. The loader's delegated walk asks `document.$rw(element)` for the id of each element on the event path
// without `data-r`: an element directly between a lazy row's markers (its next comment sibling is the row's `]` end marker,
// whose id falls in an `L` entry's row range) answers the row's marker id, and the row gets a synthetic capture handler
// `["L", [], chunks]` per event type its rows handle (entry [9]) — the runtime materialises the row on it (`dom-resume.ts`).
// Once the runtime started it answers (`ResumeInstance.q`): a materialised row has handlers of its own.
import type { LoaderDocument, ResumeState } from "./resume-format.ts";

export function lazy(): void {
  const d = document as LoaderDocument,
    prev = d.$rw;
  // End marker → its start's id, document order, as dom-resume `markers()`.
  let ends: Map<Node, number> | undefined;
  const scan = (): void => {
    const walker = d.createTreeWalker(d, 128),
      open: number[] = [];
    let last = -1,
      step = 0,
      node: Comment | null,
      x: RegExpExecArray | null;
    ends = new Map();
    while ((node = walker.nextNode() as Comment | null))
      if ((x = /^r(\d*)\[?$/.exec(node.data))) open.push((last = x[1] ? ((step = last < 0 ? 0 : +x[1] - last), +x[1]) : last + step));
      else if (/^[\]/]$/.test(node.data) && open.length) ends.set(node, open.pop()!);
  };
  d.$rw = (x: number | Element, observer?: IntersectionObserver): Element | string | undefined => {
    const found = prev?.(x, observer);
    if (found !== undefined || typeof x == "number" || observer) return found;
    const rt = d.$r!.r();
    if (rt?.q) return rt.q(x);
    let end = x.nextSibling as Comment | null;
    while (end && end.nodeType != 8) end = end.nextSibling as Comment | null;
    if (end?.data != "]") return;
    if (!ends?.has(end)) scan();
    const m = ends!.get(end)!,
      s: ResumeState = d.$r!.p();
    for (const e of s.L || []) {
      // The items: a JSON value entry (`{j}`) or an array of refs.
      const items = s.t[e[3]] as { j?: unknown[] } & unknown[];
      if (m > e[0] && m <= e[0] + (items.j || items).length) {
        const h = (s.e[m] ||= {});
        for (const type of (e[9] || "").split(" ")) if (type) h[type + "!"] ||= ["L", [], e[6]];
        return "" + m;
      }
    }
  };
}
