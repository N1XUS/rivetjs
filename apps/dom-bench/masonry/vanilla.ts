// Lane `vanilla`: hand-written DOM baselines for the comparison note (algorithm equivalents, not the libraries):
// - `css-columns`: CSS multi-column layout (`column-count`) — no script after mount, column-major order;
// - `round-robin`: react-masonry-css's algorithm — item i goes to column i mod n (flex columns, no balancing), a
//   breakpoint change rebuilds the columns;
// - `measure-absolute`: masonry.js's algorithm — read every item height, place absolutely into the shortest column
//   (layout read per item, then one write pass), re-run on resize.
import { GAP, columnsAt, tiles, type MasonryBench, type Mode } from "./shape.ts";

let current: Mode = "css-columns";
let items: HTMLElement[] = [];
let columnCount = 0;
const host = () => document.querySelector<HTMLElement>("#host")!;

function tile(t: { aspectRatio: number; label: string }): HTMLElement {
  const el = document.createElement("div");
  el.className = "tile";
  el.style.aspectRatio = String(t.aspectRatio);
  el.textContent = t.label;
  return el;
}

function roundRobin() {
  const n = columnsAt(host().clientWidth);
  if (n === columnCount) return;
  columnCount = n;
  const root = host().firstElementChild as HTMLElement;
  root.textContent = "";
  const cols: HTMLElement[] = [];
  for (let c = 0; c < n; c++) {
    const col = document.createElement("div");
    col.style.cssText = `flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:${GAP}px`;
    cols.push(col);
    root.append(col);
  }
  items.forEach((el, i) => cols[i % n]!.append(el));
}

function measureAbsolute() {
  const root = host().firstElementChild as HTMLElement;
  const width = root.clientWidth;
  const n = columnsAt(width);
  const w = (width - (n - 1) * GAP) / n;
  for (const el of items) el.style.width = `${w}px`;
  const heights = items.map((el) => el.offsetHeight);
  const cols = new Array<number>(n).fill(0);
  const pos: [number, number][] = [];
  for (const h of heights) {
    let c = 0;
    for (let k = 1; k < n; k++) if (cols[k]! < cols[c]!) c = k;
    pos.push([c * (w + GAP), cols[c]!]);
    cols[c]! += h + GAP;
  }
  items.forEach((el, i) => (el.style.transform = `translate(${pos[i]![0]}px, ${pos[i]![1]}px)`));
  root.style.height = `${Math.max(0, ...cols) - GAP}px`;
}

const bench: MasonryBench = {
  mount(count, mode) {
    current = mode;
    columnCount = 0;
    items = tiles(count).map(tile);
    const root = document.createElement("div");
    host().append(root);
    if (mode === "css-columns") {
      root.style.cssText = `column-gap:${GAP}px`;
      root.style.columnCount = String(columnsAt(host().clientWidth));
      for (const el of items) {
        el.style.breakInside = "avoid";
        el.style.marginBottom = `${GAP}px`;
      }
      root.append(...items);
    } else if (mode === "round-robin") {
      root.style.cssText = `display:flex;gap:${GAP}px;align-items:flex-start`;
      roundRobin();
    } else {
      root.style.cssText = "position:relative";
      for (const el of items) el.style.cssText += ";position:absolute;top:0;left:0";
      root.append(...items);
      measureAbsolute();
    }
    return items.length;
  },
  resize(width) {
    host().style.width = `${width}px`;
    // CSS columns: a media query would switch the count; the JS write stands in for it (no relayout script).
    if (current === "css-columns") (host().firstElementChild as HTMLElement).style.columnCount = String(columnsAt(width));
    else if (current === "round-robin") roundRobin();
    else measureAbsolute();
  },
  height() {
    const top = host().getBoundingClientRect().top;
    let max = 0;
    for (const el of items) max = Math.max(max, el.getBoundingClientRect().bottom - top);
    return max;
  },
  scroller: () => null,
  rendered: () => items.length,
  dispose() {
    items = [];
    host().textContent = "";
  },
};
(window as unknown as { masonryBench: MasonryBench }).masonryBench = bench;
