// Rivet-authored (not a port): animated relayout of `@rivetjs/cdk/masonry` over the shared FLIP core (`../flip`). When
// the layout changes on the client (an item grows / shrinks, items reorder), the items that moved start at their old
// box and travel to the new one on the house motion (or the `motion` prop's `FlipDriver`):
// - First: BEFORE the new styles land; server-placed grids take it from the previous geometry (one grid rect read,
//   `animatingBoxes` for items still moving), measured grids read every item once (`captureBoxes`);
// - Last: the new boxes come from the pure geometry (no read after the writes);
// - Invert + Play: `../flip` `playFlip` (the grown item animates its size, neighbours slide); on settle the overrides
//   go away and the CSS geometry stays.
// This adapter maps item keys (`data-key`) to elements. `prefers-reduced-motion: reduce` or `motion={false}` skip it.
import { animatingBoxes as boxesOf, flipAllowed, motion1dDriver, playFlip as play, stopFlip, type FlipDriver, type FlipItem } from "../flip/index.ts";
import type { Key, Rect } from "./layout.ts";

export { stopFlip };

export interface MotionOptions {
  /** Motion1D base duration (embla units, default 25). */
  duration?: number;
  /** Motion1D friction (default 0.68). */
  friction?: number;
}

/** Item boxes (start-edge x) relative to the grid, by key. */
export type Boxes = Map<Key, Rect>;

const keyOf = (el: Element): Key => {
  const raw = el.getAttribute("data-key")!;
  return el.getAttribute("data-key-type") === "number" ? Number(raw) : raw;
};

/** Whether relayouts animate here (`motion` prop, reduced-motion preference). */
export const motionAllowed: (motion: boolean | MotionOptions | FlipDriver | undefined) => boolean = flipAllowed;

/** The grid's direct items. */
export function gridItems(grid: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of grid.children) if ((el as HTMLElement).hasAttribute?.("data-rv-item")) out.push(el as HTMLElement);
  return out;
}

const byKey = (boxes: Map<HTMLElement, Rect>): Boxes => {
  const out: Boxes = new Map();
  for (const [el, box] of boxes) out.set(keyOf(el), box);
  return out;
};

/** Visual boxes of the items whose relayout animation is still running (start-edge x, grid-relative); empty otherwise. */
export function animatingBoxes(grid: HTMLElement, rtl: boolean): Boxes {
  return byKey(boxesOf(grid, rtl));
}

/** Read phase: the current (visual) boxes of every item, start-edge x, relative to the grid. */
export function captureBoxes(grid: HTMLElement, rtl: boolean): { boxes: Boxes; width: number } {
  const g = grid.getBoundingClientRect();
  const boxes: Boxes = new Map();
  for (const el of gridItems(grid)) {
    const r = el.getBoundingClientRect();
    boxes.set(keyOf(el), { x: rtl ? g.right - r.right : r.left - g.left, y: r.top - g.top, width: r.width, height: r.height });
  }
  return { boxes, width: g.width };
}

/**
 * Write phase: animate every item from `before` to `after` (start-edge boxes relative to the grid). `viewport` = the
 * visible band of the grid in grid coordinates (items outside it before and after jump).
 */
export function playFlip(
  grid: HTMLElement,
  before: Boxes,
  after: Boxes,
  rtl: boolean,
  viewport: [number, number],
  options?: MotionOptions | FlipDriver,
  finalOf?: (key: Key) => Readonly<Record<string, string>> | undefined,
): void {
  const items: FlipItem[] = [];
  for (const el of gridItems(grid)) {
    const key = keyOf(el);
    const from = before.get(key);
    const to = after.get(key);
    if (from && to) items.push({ el, from, to, final: finalOf && (() => finalOf(key)) });
  }
  const driver = options && "play" in options ? options : motion1dDriver(options);
  play(grid, items, { viewport, rtl, driver });
}
