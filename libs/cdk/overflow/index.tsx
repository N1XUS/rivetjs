// Ported from React Spectrum v3 (Apache-2.0, © Adobe): the overflow measuring of `@react-spectrum/breadcrumbs`
// (packages/@adobe/react-spectrum/src/breadcrumbs/Breadcrumbs.tsx: `updateOverflow` / `computeVisibleItems`) and
// `@react-spectrum/actiongroup` `overflowMode="collapse"` (packages/@adobe/react-spectrum/src/actiongroup/ActionGroup.tsx:
// `updateOverflow` / `computeVisibleItems`, `outerWidth` / `outerHeight`), generalised into one headless module.
// - `collapse: "start"` = Breadcrumbs: keep the last items (and the root with `showRoot`), collapse the leading ones into
//   one overflow element placed after the root; `collapse: "end"` = ActionGroup: keep the leading items, collapse the tail
//   into an overflow element placed last.
// - Measurement sequence = Spectrum's `useValueEffect` generator: show every item, measure, show the items that fit (with
//   the overflow element), measure again so the overflow element fits too. Each step is a signal write outside any batch:
//   Rivet flushes it into the DOM synchronously, so the measurement reads the new layout (one frame, no paint between).
// - Triggers: a ResizeObserver on the container (RA `useResizeObserver`), a change of the items / `isDisabled`
//   (RA `useLayoutEffect` on children), `document.fonts.ready` (S2 Breadcrumbs). All in one `clientEffect`: it never runs
//   on the server; on a resumed page it starts when the container becomes visible.
// - SSR: the server renders `defaultVisibleItems` (default: every item, as Spectrum's initial state); the browser
//   then measures. See `apps/cdk-docs/content/foundations/overflow.md` (layout-shift policy).
// Rivet:
// - The container's own element children are the measured items (Spectrum: the `<ul>` children / the ActionGroup items).
// - A flex `column-gap` / `row-gap` on the container is counted between items (Spectrum's CSS has no gap; S2 Breadcrumbs
//   subtracts the container gap the same way). `maxVisibleItems` (default 4 for "start" = Spectrum's
//   `MAX_VISIBLE_ITEMS`, unlimited for "end") and `defaultVisibleItems` are options.
// - Not ported: ActionGroup's `buttonLabelBehavior="collapse"` pass and "collapse everything when selectable" rule
//   (ActionGroup specifics, not overflow logic).
import { computed, signal, untrack } from "@rivetjs/reactivity";
import { clientEffect, type Ref } from "@rivetjs/runtime/dom";
import { read, type MaybeAccessor } from "../interactions/utils.ts";

/** Where items collapse: `"start"` (Breadcrumbs: leading items) or `"end"` (ActionGroup: trailing items). */
export type OverflowCollapse = "start" | "end";

/** Marker for the overflow element's place in `Overflow.items()` (a string, so `<For by>` keys it). */
export const OVERFLOW = "\u0000rv-overflow";
export type OverflowMarker = typeof OVERFLOW;

/** Spectrum Breadcrumbs `MIN_VISIBLE_ITEMS`. */
const MIN_VISIBLE_ITEMS = 1;
/** Spectrum Breadcrumbs `MAX_VISIBLE_ITEMS`. */
const MAX_VISIBLE_ITEMS = 4;

export interface OverflowMeasureOptions {
  /** `"start"`: keep the last items (Breadcrumbs). `"end"`: keep the first items (ActionGroup). @default 'end' */
  collapse?: OverflowCollapse | undefined;
  /** `"start"`: always keep the root (first) item while it fits (Spectrum Breadcrumbs `showRoot`). */
  showRoot?: boolean | undefined;
  /** `"start"`: the last item sits on its own line, it never collapses (Spectrum Breadcrumbs `isMultiline`). */
  isMultiline?: boolean | undefined;
  /** At most this many items stay visible (`"auto"` = no limit). @default 4 for "start", 'auto' for "end" */
  maxVisibleItems?: number | "auto" | undefined;
  /** `"end"`: measure widths (`horizontal`) or heights (`vertical`). @default 'horizontal' */
  orientation?: "horizontal" | "vertical" | undefined;
}

export interface OverflowOptions<T> extends OverflowMeasureOptions {
  /** The container (`ref()`): its element children are the items (and the overflow element), in order. */
  ref: Ref<HTMLElement> | (() => HTMLElement | undefined);
  /** The items, in order (accessor: a change re-measures). */
  items: () => readonly T[];
  /** Visible items before the browser measures (server render, first client render). @default every item */
  defaultVisibleItems?: number | undefined;
  /** No measuring, every item visible (Spectrum `overflowMode="wrap"`). May be an accessor. */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** Called with the item elements while every item is shown, before each measurement (e.g. to read their text). */
  onMeasureAll?: ((elements: HTMLElement[]) => void) | undefined;
}

export interface Overflow<T> {
  /** How many items are visible (the rest are collapsed). */
  visibleCount: () => number;
  /** Whether some items are collapsed (the overflow element is shown). */
  isCollapsed: () => boolean;
  /** Whether a measurement is running (ActionGroup `isMeasuring`: let the container take all the space meanwhile). */
  isMeasuring: () => boolean;
  /** What to render, in order: the visible items with `OVERFLOW` where the overflow element goes (only while collapsed). */
  items: () => readonly (T | OverflowMarker)[];
  /** The visible items before the overflow element. */
  before: () => readonly T[];
  /** The collapsed items, in order (what the overflow element lists). */
  hidden: () => readonly T[];
  /** The visible items after the overflow element. */
  after: () => readonly T[];
}

interface Slices<T> {
  before: readonly T[];
  hidden: readonly T[];
  after: readonly T[];
}

/**
 * Splits `items` into visible-before / hidden / visible-after for `visible` visible items (Spectrum Breadcrumbs `contents`:
 * `[root?, menu, ...last]`; ActionGroup: `[...first, menu]`).
 */
export function overflowSlices<T>(items: readonly T[], visible: number, options: Pick<OverflowMeasureOptions, "collapse" | "showRoot"> = {}): Slices<T> {
  const total = items.length;
  if (visible >= total) return { before: items, hidden: [], after: [] };
  if (options.collapse !== "start") return { before: items.slice(0, Math.max(0, visible)), hidden: items.slice(Math.max(0, visible)), after: [] };
  const n = Math.max(MIN_VISIBLE_ITEMS, visible);
  const root = !!options.showRoot && n > 1;
  const endItems = root ? n - 1 : n;
  return { before: root ? items.slice(0, 1) : [], hidden: items.slice(root ? 1 : 0, total - endItems), after: items.slice(total - endItems) };
}

/**
 * The measured item elements: the container's element children, minus boxless ones (`display: none` / `contents`, e.g. the
 * overlay anchor a Popover leaves next to its trigger). Spectrum measures `children` as is (its items are the only children).
 */
export function overflowChildren(container: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const child of Array.from(container.children) as HTMLElement[]) {
    const display = getComputedStyle(child).display;
    if (display !== "none" && display !== "contents") out.push(child);
  }
  return out;
}

const toNumber = (value: string): number => {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 0 : parsed;
};

/** The container's flex gap along the main axis (0 when none / not flex). */
function gapOf(container: HTMLElement, vertical: boolean): number {
  const style = getComputedStyle(container);
  return toNumber(vertical ? style.rowGap : style.columnGap);
}

const maxOf = (options: OverflowMeasureOptions): number => {
  const max = options.maxVisibleItems;
  if (max === "auto") return Infinity;
  return max ?? (options.collapse === "start" ? MAX_VISIBLE_ITEMS : Infinity);
};

/**
 * Spectrum Breadcrumbs `computeVisibleItems`: how many items fit in `container` (its `offsetWidth`) given the item
 * elements as rendered with `visible` visible items of `total` (`[root?, menu?, ...visible]`).
 */
export function computeVisibleItemsStart(container: HTMLElement, total: number, visible: number, options: OverflowMeasureOptions = {}): number {
  const listItems = overflowChildren(container);
  if (listItems.length <= 0) return visible;
  const containerWidth = container.offsetWidth;
  const gap = gapOf(container, false);
  const isShowingMenu = total > visible;
  let calculatedWidth = 0;
  let newVisibleItems = 0;
  let maxVisibleItems = maxOf({ ...options, collapse: "start" });

  if (options.showRoot) {
    calculatedWidth += listItems.shift()!.offsetWidth + gap;
    newVisibleItems++;
  }

  if (isShowingMenu) {
    calculatedWidth += (listItems.shift()?.offsetWidth ?? 0) + gap;
    maxVisibleItems--;
  }

  if (options.showRoot && calculatedWidth >= containerWidth) newVisibleItems--;

  if (options.isMultiline) {
    listItems.pop();
    newVisibleItems++;
  } else if (listItems.length > 0) {
    // Ensure the last breadcrumb isn't truncated when we measure it.
    const last = listItems.pop()!;
    const overflow = last.style.overflow;
    last.style.overflow = "visible";
    calculatedWidth += last.offsetWidth;
    if (calculatedWidth < containerWidth) newVisibleItems++;
    last.style.overflow = overflow;
  }

  for (const breadcrumb of listItems.reverse()) {
    calculatedWidth += breadcrumb.offsetWidth + gap;
    if (calculatedWidth < containerWidth) newVisibleItems++;
  }

  return Math.max(MIN_VISIBLE_ITEMS, Math.min(maxVisibleItems, newVisibleItems));
}

/** ActionGroup `outerWidth` / `outerHeight` (logical margins: the first item's start and the last item's end are ignored). */
function outerSize(element: HTMLElement, vertical: boolean, ignoreStart: boolean, ignoreEnd: boolean): number {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  if (vertical) return rect.height + (ignoreStart ? 0 : toNumber(style.marginTop)) + (ignoreEnd ? 0 : toNumber(style.marginBottom));
  const rtl = style.direction === "rtl";
  const start = rtl ? style.marginRight : style.marginLeft;
  const end = rtl ? style.marginLeft : style.marginRight;
  return rect.width + (ignoreStart ? 0 : toNumber(start)) + (ignoreEnd ? 0 : toNumber(end));
}

/**
 * Spectrum ActionGroup `computeVisibleItems`: how many leading items fit in `container` (its bounding size) given the
 * item elements as rendered with `visible` visible items of `total` (`[...visible, menu?]`).
 */
export function computeVisibleItemsEnd(container: HTMLElement, total: number, visible: number, options: OverflowMeasureOptions = {}): number {
  const vertical = options.orientation === "vertical";
  const listItems = overflowChildren(container);
  const rect = container.getBoundingClientRect();
  const containerSize = vertical ? rect.height : rect.width;
  const gap = gapOf(container, vertical);
  const isShowingMenu = visible < total;
  let calculatedSize = 0;
  let newVisibleItems = 0;

  if (isShowingMenu) {
    const item = listItems.pop();
    if (item) calculatedSize += outerSize(item, vertical, false, true) + gap;
  }

  for (const [i, item] of listItems.entries()) {
    calculatedSize += outerSize(item, vertical, i === 0, i === listItems.length - 1) + (i > 0 ? gap : 0);
    if (Math.round(calculatedSize) <= Math.round(containerSize)) newVisibleItems++;
    else break;
  }

  return Math.min(maxOf(options), newVisibleItems);
}

interface OverflowRun {
  container: HTMLElement;
  total: number;
  options: OverflowMeasureOptions;
  visible: { set(value: number): unknown };
  measuring: { set(value: boolean): unknown };
  onMeasureAll: ((elements: HTMLElement[]) => void) | undefined;
}

/** Spectrum `updateOverflow`: show every item, measure, show what fits, measure again with the overflow element shown. */
export function updateOverflow(run: OverflowRun): void {
  const { container, total, options, visible, measuring } = run;
  const start = options.collapse === "start";
  const compute = start ? computeVisibleItemsStart : computeVisibleItemsEnd;
  // Update to show all items.
  measuring.set(true);
  visible.set(total);
  run.onMeasureAll?.(overflowChildren(container));
  // Measure, and update to show the items that fit.
  let next = compute(container, total, total, options);
  const again = next < total && next > (start ? 1 : 0);
  visible.set(next);
  // If the number of items is less than the number of children, then update again to ensure that the menu fits.
  if (again) visible.set((next = compute(container, total, next, options)));
  measuring.set(false);
}

/**
 * Measures a container's items and collapses the ones that do not fit (React Spectrum Breadcrumbs / ActionGroup
 * overflow). Render `overflow.items()` into the container (the `OVERFLOW` marker = your overflow element, e.g. a
 * "…" button opening a Menu of `overflow.hidden()`), or use `before` / `hidden` / `after`.
 */
export function createOverflow<T>(options: OverflowOptions<T>): Overflow<T> {
  const { ref, items, isDisabled, onMeasureAll } = options;
  const measure: OverflowMeasureOptions = {
    collapse: options.collapse ?? "end",
    showRoot: options.showRoot,
    isMultiline: options.isMultiline,
    maxVisibleItems: options.maxVisibleItems,
    orientation: options.orientation,
  };
  const initial = options.defaultVisibleItems;
  // A JSON-safe "every item" (the signal resumes; `Infinity` does not serialize).
  const visible = signal<number>(initial == null ? Number.MAX_SAFE_INTEGER : Math.max(0, initial));
  const measuring = signal(false);
  const count = computed(() => Math.min(visible(), items().length));
  const isCollapsed = computed(() => !read(isDisabled) && count() < items().length);
  const slices = computed(() => {
    const list = items();
    return isCollapsed() ? overflowSlices(list, count(), measure) : ({ before: list, hidden: [], after: [] } as Slices<T>);
  });
  const before = computed(() => slices().before);
  const hidden = computed(() => slices().hidden);
  const after = computed(() => slices().after);
  const rendered = computed((): readonly (T | OverflowMarker)[] => {
    const s = slices();
    return isCollapsed() ? [...s.before, OVERFLOW, ...s.after] : s.before;
  });
  clientEffect(() => {
    const container = ref();
    const total = items().length;
    if (!container) return;
    if (read(isDisabled)) return void visible.set(total);
    let alive = true;
    const run: OverflowRun = { container, total, options: measure, visible, measuring, onMeasureAll };
    // The measured-axis size (container width; height for a vertical `"end"` group) at the last completed measurement.
    const vertical = measure.collapse === "end" && measure.orientation === "vertical";
    let measured = -1;
    const update = () => alive && untrack(() => updateOverflow(run));
    // Watch the container (Spectrum: the nav / the ActionGroup's parent). The first callback measures synchronously (no
    // paint before the first collapse). Our own show-all / collapse writes change the container's content, so a container
    // whose height follows its content fires the observer again:
    // - same size on the measured axis = the re-fire of our own write: skipped;
    // - changed size (a real resize): measured in the next animation frame, not inside the callback. A measurement that
    //   leaves the observed element a different size than the callback saw cannot be delivered in the same frame
    //   ("ResizeObserver loop completed with undelivered notifications"). The measurement is still one synchronous
    //   sequence (show all, collapse) inside that frame callback, so it never paints a half state.
    let frame = 0;
    const onResize = (entries: ResizeObserverEntry[]) => {
      const rect = entries[entries.length - 1]?.contentRect;
      const size = rect ? (vertical ? rect.height : rect.width) : -1;
      if (size >= 0 && size === measured) return;
      const first = measured === -1;
      measured = size;
      if (first) return update();
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null;
    if (observer) observer.observe(container);
    else queueMicrotask(update);
    // Recalculate when fonts are loaded (S2 Breadcrumbs).
    void document.fonts?.ready.then(update);
    return () => {
      alive = false;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  });
  return {
    visibleCount: count,
    isCollapsed,
    isMeasuring: measuring,
    items: rendered,
    before,
    hidden,
    after,
  };
}
