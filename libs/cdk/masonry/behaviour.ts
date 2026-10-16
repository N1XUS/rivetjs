// Rivet-authored (not a port): event handlers + measured reflow of `@rivetjs/cdk/masonry` (`Masonry`, `Bento`).
// Selection / focus semantics follow React Aria's GridList (`useGridList` / `useGridListItem` / useSelectableItem,
// Apache-2.0, © Adobe) with `layout="grid"` 2D navigation:
// - one tab stop: the grid element is `tabIndex=0` until focus is inside; items are `tabIndex=-1` (focusing the grid
//   forwards to the last focused / first item);
// - arrow keys move by visual position over the items' rects (DOM rects at key time; virtualized: the layout's rects):
//   Up / Down = nearest item above / below with horizontal overlap; Left / Right = nearest item in the adjacent column
//   by `deltaX − overlapY` (react-stately WaterfallLayout `getKeyRightOf` metric); Home / End = first / last (reading
//   order), PageUp / PageDown = about one viewport up / down;
// - selection: Space toggles (replace behaviour: replaces, Ctrl / Cmd toggles), click toggles / replaces, Shift + click
//   / Shift + arrow select the reading-order range from the anchor, Ctrl / Cmd + A selects all, Escape clears (unless
//   `disallowEmptySelection`); replace behaviour moves the selection with the keyboard focus (Ctrl keeps it);
// - actions: Enter, click with `selectionMode="none"` or an empty toggle selection, double click (replace) → onAction.
// Handlers are DELEGATED on the grid element (no per-item closures); the context is plain data built by `./index.tsx`.
// Closures created here (ResizeObserver callbacks, rAF retries) are browser-only and never serialized.
import { batch, untrack, type Signal } from "@rivetjs/reactivity";
import { DEV, devWhere } from "#dev";
import { controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { isKeySelected, rangeSelection, replaceSelection, selectAllState, toggleKeySelection } from "../data-grid/state.ts";
import type { Selection, SelectionBehavior, SelectionMode } from "../collections/types.ts";
import { breakpointAt, columnWidth, placeNumeric, type Breakpoint, type Key, type Rect } from "./layout.ts";
import { gridItems, motionAllowed, playFlip, type Boxes, type MotionOptions } from "./flip.ts";
import type { FlipDriver } from "../flip/index.ts";

export type { Selection, SelectionBehavior, SelectionMode };

/** What the handlers read and write (built by the component; plain data). */
export interface MasonryContext {
  /** Item keys in reading (DOM) order. */
  keys: () => readonly Key[];
  selection: ControlledState<Selection>;
  mode: () => SelectionMode;
  behavior: () => SelectionBehavior;
  disabled: () => ReadonlySet<Key>;
  disallowEmpty: () => boolean;
  anchor: Signal<Key | null>;
  /** Last focused key (restored when focus comes back to the grid). */
  focused: Signal<Key | null>;
  hasAction: () => boolean;
  onAction: (key: Key) => void;
  /** `"list"` semantics: no arrow keys, no selection. */
  isList: () => boolean;
  /** Virtualized: item rects at the scroller width (null: read DOM rects). */
  rects: (width: number) => { key: Key; rect: Rect }[] | null;
}

const ITEM = "[data-rv-item]";
const INTERACTIVE = "a[href], button, input, textarea, select, label, [contenteditable=''], [contenteditable='true'], [data-masonry-ignore]";

const escapeKey = (key: Key) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(String(key)) : String(key).replace(/"/g, '\\"'));

/** The key of an item element (numeric keys round-trip through `data-key-type`). */
export function keyOf(item: Element): Key {
  const raw = item.getAttribute("data-key")!;
  return item.getAttribute("data-key-type") === "number" ? Number(raw) : raw;
}

/** The item element of `target` that belongs to `grid` (nested grids keep their own items). */
function itemOf(grid: Element, target: Element | null): HTMLElement | null {
  const item = target?.closest?.<HTMLElement>(ITEM) ?? null;
  return item && item.closest("[data-rv-grid]") === grid ? item : null;
}

/** The rendered item element of `key` in `grid`. */
export function itemElement(grid: Element, key: Key): HTMLElement | null {
  for (const el of grid.querySelectorAll<HTMLElement>(`${ITEM}[data-key="${escapeKey(key)}"]`)) if (el.closest("[data-rv-grid]") === grid) return el;
  return null;
}

const setSelection = (ctx: MasonryContext, next: Selection) => batch(() => setControlledValue(ctx.selection, next));
const isDisabledKey = (ctx: MasonryContext, key: Key) => ctx.disabled().has(key);
const selectionEmpty = (ctx: MasonryContext) => {
  const s = controlledValue(ctx.selection);
  return s !== "all" && s.size === 0;
};

/** Toggle `key` (react-stately `toggleSelection`; disallowEmptySelection keeps the last key). */
export function toggleKey(ctx: MasonryContext, key: Key) {
  const mode = ctx.mode();
  if (mode === "none" || isDisabledKey(ctx, key)) return;
  const current = controlledValue(ctx.selection);
  if (ctx.disallowEmpty() && isKeySelected(current, key) && current !== "all" && current.size === 1) return;
  setSelection(
    ctx,
    toggleKeySelection(current, key, mode, () => ctx.keys(), ctx.disabled()),
  );
  ctx.anchor.set(key);
}

function replaceKey(ctx: MasonryContext, key: Key) {
  if (ctx.mode() === "none" || isDisabledKey(ctx, key)) return;
  setSelection(ctx, replaceSelection(ctx.mode(), key, ctx.disabled()));
  ctx.anchor.set(key);
}

function extendTo(ctx: MasonryContext, key: Key) {
  if (ctx.mode() !== "multiple") return replaceKey(ctx, key);
  const anchor = untrack(ctx.anchor) ?? key;
  setSelection(ctx, rangeSelection(ctx.keys(), anchor, key, ctx.disabled()));
}

/** Ctrl / Cmd + A: everything ↔ nothing (react-stately `toggleSelectAll`). */
export function toggleAll(ctx: MasonryContext) {
  if (ctx.mode() !== "multiple") return;
  setSelection(ctx, selectAllState(controlledValue(ctx.selection), ctx.keys(), ctx.disabled()) === "all" ? new Set() : "all");
}

// ---------------------------------------------------------------------------------------------------------------
// Pointer
// ---------------------------------------------------------------------------------------------------------------

/** Delegated `pointerdown`: remember the modality (pointer focus is not focus-visible). */
export function masonryPointerDown(event: PointerEvent) {
  (event.currentTarget as HTMLElement).setAttribute("data-rv-modality", "pointer");
}

/** Delegated `click`. */
export function masonryClick(event: MouseEvent, ctx: MasonryContext) {
  const grid = event.currentTarget as HTMLElement;
  const target = event.target as Element;
  const item = itemOf(grid, target);
  if (!item) return;
  const interactive = target.closest(INTERACTIVE);
  if (interactive && interactive !== item && item.contains(interactive)) return;
  const key = keyOf(item);
  if (isDisabledKey(ctx, key)) return;
  const mode = ctx.isList() ? "none" : ctx.mode();
  if (event.shiftKey && mode === "multiple" && untrack(ctx.anchor) != null) return extendTo(ctx, key);
  if (ctx.hasAction() && (mode === "none" || (ctx.behavior() === "toggle" && selectionEmpty(ctx)))) return ctx.onAction(key);
  if (mode === "none") return;
  if (event.metaKey || event.ctrlKey || ctx.behavior() === "toggle") return toggleKey(ctx, key);
  replaceKey(ctx, key);
}

/** Delegated `dblclick`: replace behaviour runs the action on double click (RA). */
export function masonryDoubleClick(event: MouseEvent, ctx: MasonryContext) {
  const grid = event.currentTarget as HTMLElement;
  const item = itemOf(grid, event.target as Element);
  if (!item || !ctx.hasAction() || ctx.behavior() !== "replace" || ctx.mode() === "none") return;
  const key = keyOf(item);
  if (!isDisabledKey(ctx, key)) ctx.onAction(key);
}

// ---------------------------------------------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------------------------------------------

/** Delegated `focusin`: forward grid focus to an item; mark the focused item; leave the tab order while inside. */
export function masonryFocusIn(event: FocusEvent, ctx: MasonryContext) {
  const grid = event.currentTarget as HTMLElement;
  const target = event.target as HTMLElement;
  if (target === grid) {
    const keys = ctx.keys();
    const last = untrack(ctx.focused);
    const selection = controlledValue(ctx.selection);
    const firstSelected = selection === "all" ? undefined : keys.find((k) => selection.has(k));
    const key = last != null && keys.includes(last) ? last : (firstSelected ?? keys.find((k) => !isDisabledKey(ctx, k)));
    if (key != null) focusKey(grid, ctx, key);
    return;
  }
  const item = itemOf(grid, target);
  if (!item) return;
  grid.tabIndex = -1;
  if (target === item) {
    item.setAttribute("data-focused", "true");
    if (grid.getAttribute("data-rv-modality") !== "pointer") item.setAttribute("data-focus-visible", "true");
  }
  ctx.focused.set(keyOf(item));
}

/** Delegated `focusout`: clear the item marks; focus leaving the grid puts it back in the tab order. */
export function masonryFocusOut(event: FocusEvent) {
  const grid = event.currentTarget as HTMLElement;
  const item = itemOf(grid, event.target as Element);
  if (item && item === event.target) {
    item.removeAttribute("data-focused");
    item.removeAttribute("data-focus-visible");
  }
  const next = event.relatedTarget as Node | null;
  if (!next || !grid.contains(next)) {
    grid.tabIndex = 0;
    grid.removeAttribute("data-rv-modality");
  }
}

/** Scroll container of the grid (virtualized: the virtualizer's scroller). */
const scrollerOf = (grid: HTMLElement): HTMLElement | null => grid.querySelector<HTMLElement>(":scope > .rv-Virtualizer, :scope > [data-rv-scroller]");

/** Focus the item of `key`, scrolling a virtualized grid to it first (the view renders in a later frame). */
export function focusKey(grid: HTMLElement, ctx: MasonryContext, key: Key) {
  const apply = (el: HTMLElement) => {
    el.focus({ preventScroll: true });
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const el = itemElement(grid, key);
  if (el) return apply(el);
  const scroller = scrollerOf(grid);
  const rect = scroller ? ctx.rects(scroller.clientWidth)?.find((r) => r.key === key)?.rect : undefined;
  if (!scroller || !rect) return;
  const top = scroller.scrollTop;
  if (rect.y < top) scroller.scrollTop = rect.y;
  else if (rect.y + rect.height > top + scroller.clientHeight) scroller.scrollTop = rect.y + rect.height - scroller.clientHeight;
  scroller.dispatchEvent(new Event("scroll"));
  let tries = 0;
  const retry = () => {
    const found = itemElement(grid, key);
    if (found) return apply(found);
    if (++tries < 20) requestAnimationFrame(retry);
  };
  requestAnimationFrame(retry);
}

// ---------------------------------------------------------------------------------------------------------------
// Imperative handle (DOM-based: also works on a resumed page whose component never ran)
// ---------------------------------------------------------------------------------------------------------------

/** `handleRef` of `Masonry` / `Bento`. */
export interface MasonryHandle {
  /** Re-place the items now (measured: from the observed sizes, next frame; virtualized: re-read the scroller). Exact layouts are CSS: nothing to do. */
  relayout(): void;
  /** Scroll the item into view (virtualized: also when it is not rendered). */
  scrollToItem(key: Key): void;
  /** The item's box relative to the grid (x from the start edge), or null when unknown. */
  getPosition(key: Key): Rect | null;
}

/** Imperative relayout of a masonry grid element. */
export function masonryRelayout(grid: HTMLElement): void {
  if (relayoutMeasured(grid)) return;
  scrollerOf(grid)?.dispatchEvent(new Event("scroll"));
}

/** Scrolls item `key` of a masonry grid into view (`rects`: virtualized layout rects at a scroller width). */
export function masonryScrollTo(grid: HTMLElement, key: Key, rects?: ((width: number) => { key: Key; rect: Rect }[] | null) | null): void {
  const el = itemElement(grid, key);
  if (el) {
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }
  const scroller = scrollerOf(grid);
  const rect = scroller ? rects?.(scroller.clientWidth)?.find((r) => r.key === key)?.rect : undefined;
  if (!scroller || !rect) return;
  const top = scroller.scrollTop;
  if (rect.y < top) scroller.scrollTop = rect.y;
  else if (rect.y + rect.height > top + scroller.clientHeight) scroller.scrollTop = rect.y + rect.height - scroller.clientHeight;
  scroller.dispatchEvent(new Event("scroll"));
}

/** Box of item `key` relative to the grid (start-edge x): rendered rect, else `layoutRect` at the grid width. */
export function masonryPosition(grid: HTMLElement, key: Key, layoutRect?: ((key: Key, width: number) => Rect | null) | null): Rect | null {
  const el = itemElement(grid, key);
  if (el) {
    const g = grid.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const rtl = getComputedStyle(grid).direction === "rtl";
    return { x: rtl ? g.right - r.right : r.left - g.left, y: r.top - g.top, width: r.width, height: r.height };
  }
  return layoutRect?.(key, grid.clientWidth) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Keyboard (2D by visual position)
// ---------------------------------------------------------------------------------------------------------------

interface Box {
  key: Key;
  x: number;
  y: number;
  r: number;
  b: number;
}

/** Item boxes: the virtualized layout's rects, else the rendered items' client rects. */
function boxes(grid: HTMLElement, ctx: MasonryContext): Box[] {
  const scroller = scrollerOf(grid);
  const virtual = scroller ? ctx.rects(scroller.clientWidth) : null;
  if (virtual) return virtual.map(({ key, rect }) => ({ key, x: rect.x, y: rect.y, r: rect.x + rect.width, b: rect.y + rect.height }));
  const out: Box[] = [];
  for (const el of grid.querySelectorAll<HTMLElement>(ITEM)) {
    if (el.closest("[data-rv-grid]") !== grid) continue;
    const r = el.getBoundingClientRect();
    out.push({ key: keyOf(el), x: r.left, y: r.top, r: r.right, b: r.bottom });
  }
  return out;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/** The nearest box from `from` in a direction (null: none). */
export function nearest(all: readonly Box[], from: Box, dir: "up" | "down" | "left" | "right", skip: (key: Key) => boolean): Box | null {
  let best: Box | null = null;
  let bestScore = Infinity;
  let fallback: Box | null = null;
  let fallbackScore = Infinity;
  const cx = (from.x + from.r) / 2;
  const cy = (from.y + from.b) / 2;
  for (const c of all) {
    if (c.key === from.key || skip(c.key)) continue;
    let ahead: boolean;
    let gap: number;
    let ov: number;
    if (dir === "up" || dir === "down") {
      ahead = dir === "up" ? c.b <= from.y + 1 : c.y >= from.b - 1;
      gap = dir === "up" ? from.y - c.b : c.y - from.b;
      ov = overlap(c.x, c.r, from.x, from.r);
    } else {
      ahead = dir === "left" ? c.r <= from.x + 1 : c.x >= from.r - 1;
      gap = dir === "left" ? from.x - c.r : c.x - from.r;
      ov = overlap(c.y, c.b, from.y, from.b);
    }
    if (!ahead) continue;
    if (ov > 0) {
      // Vertical moves: nearest edge first, then the widest overlap; horizontal: WaterfallLayout's deltaX − overlapY.
      const score = dir === "up" || dir === "down" ? gap * 1e4 - ov : gap - ov;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    } else {
      const dx = (c.x + c.r) / 2 - cx;
      const dy = (c.y + c.b) / 2 - cy;
      const score = dx * dx + dy * dy;
      if (score < fallbackScore) {
        fallbackScore = score;
        fallback = c;
      }
    }
  }
  return best ?? (dir === "left" || dir === "right" ? fallback : null);
}

/** Delegated `keydown`. */
export function masonryKeyDown(event: KeyboardEvent, ctx: MasonryContext) {
  const grid = event.currentTarget as HTMLElement;
  if (event.defaultPrevented || event.isComposing) return;
  grid.setAttribute("data-rv-modality", "keyboard");
  const target = event.target as HTMLElement;
  const item = itemOf(grid, target);
  // Keys typed into interactive content inside an item belong to it.
  if (item && target !== item) return;
  if (!item || ctx.isList()) return;
  const key = keyOf(item);
  const mod = event.ctrlKey || event.metaKey;
  const mode = ctx.mode();
  const skip = (k: Key) => isDisabledKey(ctx, k);
  let next: Key | null | undefined;
  switch (event.key) {
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowLeft":
    case "ArrowRight": {
      const all = boxes(grid, ctx);
      const from = all.find((b) => b.key === key);
      if (!from) return;
      const dir = event.key === "ArrowUp" ? "up" : event.key === "ArrowDown" ? "down" : event.key === "ArrowLeft" ? "left" : "right";
      next = nearest(all, from, dir, skip)?.key ?? null;
      break;
    }
    case "PageUp":
    case "PageDown": {
      const all = boxes(grid, ctx);
      let from = all.find((b) => b.key === key);
      if (!from) return;
      const scroller = scrollerOf(grid);
      const page = scroller?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 600);
      const start = from.y;
      const dir = event.key === "PageUp" ? "up" : "down";
      for (let step = 0; step < 1000; step++) {
        const n = nearest(all, from, dir, skip);
        if (!n) break;
        from = n;
        if (Math.abs(n.y - start) >= page) break;
      }
      next = from.key === key ? null : from.key;
      break;
    }
    case "Home":
    case "End": {
      const keys = ctx.keys().filter((k) => !skip(k));
      next = event.key === "Home" ? keys[0] : keys[keys.length - 1];
      break;
    }
    case " ":
    case "Spacebar":
      event.preventDefault();
      if (mode === "none") return;
      if (event.shiftKey && mode === "multiple") return extendTo(ctx, key);
      if (mod || ctx.behavior() === "toggle") return toggleKey(ctx, key);
      return replaceKey(ctx, key);
    case "Enter":
      event.preventDefault();
      if (isDisabledKey(ctx, key)) return;
      if (ctx.hasAction()) return ctx.onAction(key);
      if (mode !== "none") return ctx.behavior() === "toggle" ? toggleKey(ctx, key) : replaceKey(ctx, key);
      return;
    case "a":
    case "A":
      if (!mod || mode !== "multiple") return;
      event.preventDefault();
      return toggleAll(ctx);
    case "Escape":
      if (mode === "none" || ctx.disallowEmpty() || selectionEmpty(ctx)) return;
      event.preventDefault();
      return setSelection(ctx, new Set());
    default:
      return;
  }
  event.preventDefault();
  if (next == null || next === key) return;
  focusKey(grid, ctx, next);
  if (mode === "none") return;
  if (event.shiftKey && mode === "multiple") extendTo(ctx, next);
  else if (!mod && ctx.behavior() === "replace") replaceKey(ctx, next);
}

// ---------------------------------------------------------------------------------------------------------------
// Measured reflow (unknown sizes)
// ---------------------------------------------------------------------------------------------------------------

export interface MeasureOptions {
  /** Breakpoints (columns + gaps per container width), or an accessor (live layout props; read on every pass). */
  breakpoints: readonly Breakpoint[] | (() => readonly Breakpoint[]);
  /** Columns an item spans at breakpoint `min` (default 1; `null` = no spans in this grid). Read on every pass (live spans). */
  spanOf?: ((item: HTMLElement, min: number) => number | null) | null;
  /**
   * Mixed lists: the leading items the server placed (exact CSS, never moved here) and the column tops under them at a
   * container width (the measured items continue below).
   */
  prefix?: (() => { count: number; bottoms: (width: number) => ArrayLike<number> } | null) | null;
  /** Animate relayouts started by `relayoutMeasured(grid, true)` (span changes); value or accessor. */
  motion?: boolean | MotionOptions | FlipDriver | (() => boolean | MotionOptions | FlipDriver | undefined) | undefined;
}

const bpsOf = (options: MeasureOptions): readonly Breakpoint[] => (typeof options.breakpoints === "function" ? options.breakpoints() : options.breakpoints);
const motionOf = (options: MeasureOptions): boolean | MotionOptions | FlipDriver | undefined =>
  typeof options.motion === "function" ? options.motion() : options.motion;

const heights = new WeakMap<Element, number>();
/** Last placed boxes per grid (FLIP "first" without reads). */
const placed = new WeakMap<HTMLElement, Boxes>();
/** Live watchers per grid (imperative relayout). */
const watchers = new WeakMap<HTMLElement, { schedule: (animate: boolean) => void }>();

const itemsOf = (grid: HTMLElement): HTMLElement[] => gridItems(grid);

/**
 * Write phase of a measured layout (no reads): places the measured `items` (heights in `sizes`, grid content width
 * `width`) shortest-column first (spans, under a server-placed prefix), moves them by `transform` and sets the grid
 * height. The first pass turns the CSS-columns first paint into absolute positioning (items already have the column
 * width: `width: var(--rv-mw)`).
 */
function writeMeasured(
  grid: HTMLElement,
  items: readonly HTMLElement[],
  sizes: Float64Array,
  width: number,
  rtl: boolean,
  options: MeasureOptions,
  animate: boolean,
): number {
  const breakpoints = bpsOf(options);
  const bp = breakpoints[breakpointAt(breakpoints, width)]!;
  const [gapX, gapY] = bp.gap;
  const w = Math.max(0, columnWidth(width, bp.columns, gapX));
  const pre = options.prefix?.() ?? null;
  const skip = pre ? Math.min(pre.count, items.length) : 0;
  const measured = skip ? items.slice(skip) : items;
  const heightsOf = skip ? sizes.subarray(skip) : sizes;
  // `spanOf` returning null = no spans (every item 1 column).
  let spans: number[] | null = null;
  if (options.spanOf && measured.length && options.spanOf(measured[0]!, bp.min) != null) spans = measured.map((el) => options.spanOf!(el, bp.min) ?? 1);
  const p = placeNumeric(heightsOf, spans, bp.columns, w, gapX, gapY, pre && skip ? pre.bottoms(width) : null);
  // CSS-columns first paint → absolute positioning (again after a live layout prop rewrote the grid style).
  const gs = grid.style;
  if (gs.columnWidth || gs.paddingTop || gs.position !== "relative") {
    gs.columnWidth = "";
    gs.columnGap = "";
    gs.paddingTop = "";
    gs.position = "relative";
  }
  if (!grid.hasAttribute("data-measured")) grid.setAttribute("data-measured", "true");
  const motion = motionOf(options);
  const before = animate && motionAllowed(motion) ? placed.get(grid) : undefined;
  const after: Boxes = new Map();
  for (let i = 0; i < measured.length; i++) {
    const el = measured[i]!;
    const s = el.style;
    if (s.position !== "absolute") s.position = "absolute";
    if (s.top !== "0px") {
      s.top = "0px";
      s.insetInlineStart = "0px";
      s.marginBlockEnd = "0px";
      s.breakInside = "";
    }
    if (s.visibility) s.visibility = "";
    const span = spans ? spans[i]! : 1;
    const itemWidth = span > 1 ? `${p.width[i]}px` : "var(--rv-mw)";
    if (s.width !== itemWidth) s.width = itemWidth;
    const x = p.x[i]!;
    const y = p.y[i]!;
    s.transform = `translate(${rtl ? -x : x}px, ${y}px)`;
    after.set(keyOf(el), { x, y, width: p.width[i]!, height: heightsOf[i]! });
  }
  placed.set(grid, after);
  grid.style.height = p.height + "px";
  if (before) playFlip(grid, before, after, rtl, [-Infinity, Infinity], typeof motion === "object" ? motion : undefined);
  return p.height;
}

/**
 * One measured layout pass over `grid`'s items on demand (imperative relayout): one read phase (every height, the grid
 * width, the direction), then the write phase. Returns the content height. `watchMeasured` never calls it: it takes
 * every size from ResizeObserver entries and does no layout reads at all.
 */
export function reflowMeasured(grid: HTMLElement, options: MeasureOptions): number {
  const items = itemsOf(grid);
  const rtl = getComputedStyle(grid).direction === "rtl";
  const width = grid.clientWidth;
  const sizes = new Float64Array(items.length);
  for (let i = 0; i < items.length; i++) {
    sizes[i] = items[i]!.getBoundingClientRect().height;
    heights.set(items[i]!, sizes[i]!);
  }
  return writeMeasured(grid, items, sizes, width, rtl, options, false);
}

/** Schedules a measured relayout of `grid` (watched: next frame, from the observer caches; `animate`: FLIP). */
export function relayoutMeasured(grid: HTMLElement, animate = false): boolean {
  const watcher = watchers.get(grid);
  if (!watcher) return false;
  watcher.schedule(animate);
  return true;
}

/**
 * Keeps a measured grid laid out without forced layouts: one ResizeObserver on the root (content width) and on every
 * item (border-box height) feeds the size caches; a MutationObserver on the grid observes items the list adds (hidden
 * and taken out of the flow until their first placement: no in-flow ghost under the placed cards) and drops removed
 * ones. Changes coalesce into one `requestAnimationFrame` that runs the pure placement and the write phase only (sizes
 * come from the observer entries, never from layout reads). Returns the disconnect function.
 */
export function watchMeasured(grid: HTMLElement, options: MeasureOptions): () => void {
  if (typeof ResizeObserver === "undefined") {
    reflowMeasured(grid, options);
    return () => {};
  }
  const root = grid.parentElement ?? grid;
  // The only read outside observer entries (style, before any write): the inline direction.
  const rtl = getComputedStyle(grid).direction === "rtl";
  let width = -1;
  let frame = 0;
  let animate = false;
  const run = () => {
    frame = 0;
    if (width < 0) return;
    const items = itemsOf(grid);
    const sizes = new Float64Array(items.length);
    for (let i = 0; i < items.length; i++) {
      const h = heights.get(items[i]!);
      if (h == null) return; // an added item's first size is still on its way: its entry schedules the next frame
      sizes[i] = h;
    }
    const flip = animate;
    animate = false;
    writeMeasured(grid, items, sizes, width, rtl, options, flip);
  };
  const schedule = (withMotion = false) => {
    if (withMotion) animate = true;
    if (!frame) frame = requestAnimationFrame(run);
  };
  watchers.set(grid, { schedule });
  const observer = new ResizeObserver((entries) => {
    let dirty = false;
    for (const entry of entries) {
      if (entry.target === root) {
        const box = entry.contentBoxSize?.[0];
        const next = box ? box.inlineSize : entry.contentRect.width;
        if (next !== width) {
          width = next;
          dirty = true;
        }
        continue;
      }
      const box = entry.borderBoxSize?.[0];
      const h = box ? box.blockSize : entry.contentRect.height;
      if (h !== heights.get(entry.target)) {
        heights.set(entry.target, h);
        dirty = true;
      }
    }
    if (dirty) schedule();
  });
  const mutations = new MutationObserver((records) => {
    let removed = false;
    for (const record of records) {
      for (const node of record.addedNodes)
        if ((node as HTMLElement).hasAttribute?.("data-rv-item")) {
          const s = (node as HTMLElement).style;
          // Out of the flow and invisible until placed (still measured: visibility keeps the box).
          s.position = "absolute";
          s.visibility = "hidden";
          observer.observe(node as Element);
        }
      for (const node of record.removedNodes)
        if ((node as HTMLElement).hasAttribute?.("data-rv-item")) {
          observer.unobserve(node as Element);
          heights.delete(node as Element);
          removed = true;
        }
    }
    if (removed) schedule();
  });
  observer.observe(root);
  for (const el of itemsOf(grid)) observer.observe(el);
  mutations.observe(grid, { childList: true });
  return () => {
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
    mutations.disconnect();
    watchers.delete(grid);
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Measured ratios (justified items without a size)
// ---------------------------------------------------------------------------------------------------------------

/** Callbacks of the shared ratio observer, by element. */
const ratioCallbacks = new WeakMap<Element, (box: ResizeObserverSize | undefined) => void>();
let ratioObserver: ResizeObserver | null = null;

/** Ratio of a pending item: an image's natural ratio once loaded, else the border box (rendered at a fixed width). */
function ratioOfElement(el: Element, box: ResizeObserverSize | undefined): number | null {
  const img = el.querySelector("img");
  if (img) return img.complete && img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
  if (!box || box.blockSize < 1 || box.inlineSize < 1) return null;
  return box.inlineSize / box.blockSize;
}

/**
 * Measures the aspect ratio of one pending item element and reports it once (`record`), then stops: an image reports
 * its natural ratio once loaded, other content its border box (ResizeObserver entry: no layout read). Returns stop.
 */
export function observeRatio(el: HTMLElement, record: (ratio: number) => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  let done = false;
  const report = (ratio: number | null) => {
    if (done || ratio == null || !(ratio > 0) || !Number.isFinite(ratio)) return;
    done = true;
    stop();
    record(ratio);
  };
  const onLoad = (e: Event) => {
    if ((e.target as Element).tagName === "IMG") report(ratioOfElement(el, undefined));
  };
  const stop = () => {
    ratioObserver?.unobserve(el);
    ratioCallbacks.delete(el);
    el.removeEventListener("load", onLoad, true);
  };
  ratioObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) ratioCallbacks.get(entry.target)?.(entry.borderBoxSize?.[0]);
  });
  ratioCallbacks.set(el, (box) => report(ratioOfElement(el, box)));
  el.addEventListener("load", onLoad, true);
  ratioObserver.observe(el, { box: "border-box" });
  return stop;
}

/** Observes the ratios of every pending item of `grid` (server-rendered ones on a resumed page). Returns disconnect. */
const ratioWatched = new WeakSet<HTMLElement>();

export function watchRatios(grid: HTMLElement, pending: (key: Key) => boolean, record: (key: Key, ratio: number) => void): () => void {
  // One watcher per grid (started at mount for server-rendered pending items, or by the first client placement that has some).
  if (ratioWatched.has(grid)) return () => {};
  ratioWatched.add(grid);
  const stops = new Map<Element, () => void>();
  const watch = (el: HTMLElement): void => {
    if (stops.has(el) || !el.hasAttribute("data-key")) return;
    const key = keyOf(el);
    if (pending(key))
      stops.set(
        el,
        observeRatio(el, (ratio) => record(key, ratio)),
      );
  };
  for (const el of gridItems(grid)) watch(el);
  // Rows created later (appended items without a ratio): one childList observer, no per-row ref.
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) if (n instanceof HTMLElement) watch(n);
      for (const n of r.removedNodes) {
        const stop = stops.get(n as Element);
        if (stop) (stop(), stops.delete(n as Element));
      }
    }
  });
  mo.observe(grid, { childList: true });
  return () => {
    ratioWatched.delete(grid);
    mo.disconnect();
    stops.forEach((stop) => stop());
  };
}

const isDev = (): boolean => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NODE_ENV === "development";
/**
 * Dev warning: items of unknown size in a server-placed grid. At mount (`layout="exact"`): they are measured in the
 * browser, like `auto`. After mount (`afterMount`): the layout kind was chosen at mount, so they are placed as squares.
 */
export function warnUnknownExact(count: number, afterMount = false): void {
  if (DEV && isDev())
    console.warn(
      (afterMount
        ? `[rivet:cdk] Masonry: an item of unknown size was added to a server-placed grid (every item had a size at mount): it is placed as a square. Give it a size or use layout="measure".`
        : `[rivet:cdk] Masonry: layout="exact" with ${count} item(s) of unknown size: they are measured in the browser.`) + devWhere(),
    );
}
