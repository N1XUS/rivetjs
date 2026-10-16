// Inline rows add-on, shipped only on pages with path-addressed list rows (state `w`), before the state script.
// Serialized with String(rows), so it must be self-contained: browser globals only.
//
// Rows written from a compiled row plan carry no `data-r` ids: their element ids follow from the row id and the plan's
// element paths (state `w`) below the row root — the element before the row's end marker (`<!--rN[-->` … `<!--]-->`,
// ids continuing a stride are left out), or the root keeping its own `data-r` (anchored rows outside row regions).
// `document.$rw(x, observer?)` gives the element of an id or the id of an element, for the loader (delegated events,
// visible preloads) until the runtime starts; then the runtime answers (`ResumeInstance.q`).
import type { LoaderDocument, ResumeState } from "./resume-format.ts";

export function rows(): void {
  const d = document as LoaderDocument;
  // End marker → its start's id, and id → end marker; document order, as dom-resume `markers()`.
  let ends: Map<Node, number>, at: Record<number, Comment>;
  const scan = (): void => {
    const walker = d.createTreeWalker(d, 128),
      open: number[] = [];
    let last = -1,
      step = 0,
      id: number,
      node: Comment | null,
      x: RegExpExecArray | null;
    ends = new Map();
    at = {};
    while ((node = walker.nextNode() as Comment | null))
      if ((x = /^r(\d*)\[?$/.exec(node.data))) open.push((last = x[1] ? ((step = last < 0 ? 0 : +x[1] - last), +x[1]) : last + step));
      else if (/^[\]/]$/.test(node.data) && open.length) (ends.set(node, (id = open.pop()!)), (at[id] = node));
  };
  d.$rw = (x: number | Element, observer?: IntersectionObserver): Element | string | undefined => {
    // A visible preload's element (the loader's `schedule`, before the state is parsed): found and observed at idle.
    if (observer)
      return void (window.requestIdleCallback || setTimeout)(() => {
        const node = d.$rw!(x) as Element | undefined;
        if (node) observer.observe(node);
      });
    const rt = d.$r!.r();
    if (rt?.q) return rt.q(x);
    const s: ResumeState = d.$r!.p();
    if (typeof x == "number") {
      for (const [first, stride, count, paths, anchor] of s.w || []) {
        const k = Math.floor((x - first) / stride),
          row = first + k * stride,
          j = x - row - 1;
        if (k >= 0 && k < count && paths[j]) {
          if (!anchor && !at?.[row]?.isConnected) scan();
          const [tag, steps] = paths[j]!.split(":");
          let node: Element | null | undefined = anchor ? d.querySelector('[data-r="' + (row + 1) + '"]') : at[row]?.previousElementSibling;
          for (const i of steps ? steps.split(".") : []) node = node?.children[+i];
          return node?.localName == tag ? node : undefined;
        }
      }
      return;
    }
    // The element's row root: the nearest ancestor-or-self followed by a `]` end marker of a `w` row, or with the `data-r`
    // of an anchored `w` row root (climbing stops at any other element with an id); then its child indexes below it.
    const chain: Element[] = [];
    for (let node: Element | null = x; node?.nodeType == 1; node = node.parentElement) {
      const end = node.nextSibling as Comment | null,
        own = node.getAttribute("data-r");
      let m: number | undefined;
      if (own) m = +own - 1;
      else if (end?.nodeType == 8 && end.data == "]") {
        if (!ends?.has(end)) scan();
        m = ends.get(end);
      }
      if (m !== undefined && chain.length)
        for (const [first, stride, count, paths, anchor] of s.w || [])
          if (!own == !anchor && m >= first && m < first + count * stride && (m - first) % stride == 0) {
            let path = "";
            for (let i = chain.length; i--;) {
              let n = 0;
              for (let sibling = chain[i]!; (sibling = sibling.previousElementSibling!);) n++;
              path += (path ? "." : "") + n;
            }
            const j = paths.indexOf(x.localName + ":" + path);
            return j < 0 ? undefined : "" + (m + 1 + j);
          }
      if (own) return;
      chain.push(node);
    }
  };
}
