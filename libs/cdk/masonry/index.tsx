// Rivet-authored (not a port): `@rivetjs/cdk/masonry` — `Masonry` (Pinterest-style shortest-column layout for cards and
// image mosaics) and `Bento` (tile grid with per-item spans). No React Aria / RAC / Angular CDK counterpart; semantics
// follow React Aria's GridList (`role="grid"` > `row` > `gridcell`, 2D `layout="grid"` keys, selection modes; see
// `./behaviour.ts`). Spec: `docs/design/specs/2026-10-11-masonry-design.md`.
// Rivet:
// - data-driven (like `data-grid`): `items` + one render function; per-item layout data from accessors
//   (`getAspectRatio`, `getColSpan` / `getRowSpan`) — the server must know every size before any item renders;
// - server-exact: known sizes are placed on the server (`./layout.ts`) and written as inline CSS that is exact at any
//   container width (`100cqw` math; several breakpoints = masked `max()` terms, no `<style>`): zero CLS, nothing runs
//   before an interaction (`preload="visible"` root fetches the handler chunks when it shows up);
// - unknown sizes (`layout="measure"`): CSS columns first paint at the final column width, then one client effect
//   measures and places every item in one read phase + one write phase, ResizeObserver → one relayout per frame;
// - `virtualize`: the cdk `Virtualizer` with `MasonryLayout` (WaterfallLayout + exact ratios);
// - rows are keyed (`For` by key): a resumed page adopts the server rows; handlers are delegated on the grid element.
import { computed, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { For, Show, clientEffect, ref as elementRef, type DOMValue } from "@rivetjs/runtime/dom";
import { splitProps } from "@rivetjs/runtime/props";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { controllable } from "../interactions/controllable.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { loadMoreSentinel } from "../utils/load-more-sentinel.tsx";
import { Virtualizer } from "../virtualizer/virtualizer.tsx";
import { isKeySelected } from "../data-grid/state.ts";
import { animatingBoxes, motionAllowed, playFlip, type Boxes, type MotionOptions } from "./flip.ts";
import type { FlipDriver } from "../flip/index.ts";
import { geometryHeight, geometryStyle, num, rectsAt, type Geometry } from "./geometry.ts";
import { placeJustifiedRun, type JustifiedLastRow, type JustifiedRun } from "./justified.ts";
import {
  keyOf,
  masonryPosition,
  masonryRelayout,
  masonryScrollTo,
  relayoutMeasured,
  type MasonryHandle,
  type MeasureOptions,
  masonryClick,
  masonryDoubleClick,
  masonryFocusIn,
  masonryFocusOut,
  masonryKeyDown,
  masonryPointerDown,
  watchMeasured,
  watchRatios,
  observeRatio,
  warnUnknownExact,
  type MasonryContext,
  type Selection,
  type SelectionBehavior,
  type SelectionMode,
} from "./behaviour.ts";
import {
  bentoGeometry,
  breakpointAt,
  columnGapCss,
  columnWidth,
  defaultAspectRatio,
  defaultColSpan,
  defaultItemHeight,
  defaultItemKey,
  defaultRowSpan,
  defaultSpan,
  fitColumns,
  gridVars,
  packBento,
  placeColumns,
  referenceWidths,
  registerGridProperties,
  resolveBreakpoints,
  responsiveAt,
  responsiveMins,
  justifiedSplits,
  capBreakpoints,
  unitRange,
  validRatio,
  type BentoPack,
  type BentoPlacement,
  type BentoRowHeight,
  type Breakpoint,
  type Columns,
  type ColumnsRun,
  type Gap,
  type Key,
  type Rect,
  type Responsive,
} from "./layout.ts";
import { MasonryLayout, type MasonryLayoutOptions } from "./masonry-layout.ts";

export * from "./layout.ts";
export * from "./geometry.ts";
export { placeJustified, placeJustifiedRun, type JustifiedLastRow, type JustifiedOptions, type JustifiedRun } from "./justified.ts";
export { captureBoxes, playFlip, stopFlip, motionAllowed, type Boxes, type MotionOptions } from "./flip.ts";
export type { FlipDriver } from "../flip/index.ts";
export {
  masonryPosition,
  masonryRelayout,
  masonryScrollTo,
  reflowMeasured,
  relayoutMeasured,
  watchMeasured,
  type MasonryHandle,
  type MeasureOptions,
} from "./behaviour.ts";
export { MasonryLayout, type MasonryLayoutOptions } from "./masonry-layout.ts";
export type { MasonryContext, Selection, SelectionBehavior, SelectionMode } from "./behaviour.ts";

type MaybeAccessor<T> = T | (() => T);
/** A `{ current }` holder or a callback (like resizable's `groupRef`). */
export type ImperativeRef<H> = { current: H | null } | ((handle: H | null) => void);
function assignRef<H>(ref: ImperativeRef<H>, handle: H): void {
  if (typeof ref === "function") ref(handle);
  else ref.current = handle;
}
const read = <T,>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

/** What the item renderer and `itemClass` functions get (accessors: read them in bindings). */
export interface MasonryItemState {
  key: Key;
  /** Position in `items` (reading order). */
  index: () => number;
  isSelected: () => boolean;
  isDisabled: () => boolean;
}

/** Props shared by `Masonry` and `Bento`. Global DOM attributes go to the root element. */
export interface MasonryBaseProps<T> extends GlobalDOMAttributes<HTMLDivElement> {
  /** The items (reading order). A Signal / accessor updates the layout in place. */
  items: MaybeAccessor<readonly T[]>;
  /** Item content: `(item, state) => …` (rendered inside the item element; read `state` accessors in bindings). */
  children: (item: T, state: MasonryItemState) => Content;
  /** Unique item key (default `item.id`, then `item.key`, then the index). Read once at mount: keys identify the rendered rows; a new reader would re-key every row. */
  getKey?: ((item: T, index: number) => Key) | undefined;
  /** Column count: a number or a container-width map (`{ 0: 2, 640: 3, 1024: 4 }`, the default). Live. */
  columns?: Columns | undefined;
  /** Derive the columns from a minimum item width instead (`n·min + (n − 1)·gap` px per column count). Live. */
  minItemWidth?: number | undefined;
  /** Upper bound of the column count with `minItemWidth`. Default 4. Live. */
  maxColumns?: number | undefined;
  /** Gap between items in px: one value or `[column, row]`, or a container-width map of those. Default 16. Live. */
  /**
   * Root max width in px (`max-width` on the root). Bounds the last breakpoint's width range, so justified / mixed geometry terms stay exact
   * up to it (and `masonrySizes` can cap image widths). Live.
   */
  maxWidth?: number | undefined;
  gap?: Responsive<Gap> | undefined;
  /** Animated relayout when items move on the client (span / size / order changes): house motion (embla), or a `FlipDriver` (`@rivetjs/cdk/flip`). `false` = jump; reduced motion always jumps. Live (read when a relayout plays). */
  motion?: boolean | MotionOptions | FlipDriver | undefined;
  /** Imperative handle: `relayout()`, `scrollToItem(key)`, `getPosition(key)` (also available as DOM functions for resumed handlers). */
  handleRef?: ImperativeRef<MasonryHandle> | undefined;
  selectionMode?: SelectionMode | undefined;
  /** `"toggle"` (default): clicks toggle; `"replace"`: clicks replace, Ctrl / Cmd toggles, double click = action. Read once at mount: picks the pointer handlers wired at mount. */
  selectionBehavior?: SelectionBehavior | undefined;
  /** Selected keys: value, two-way Signal or accessor. */
  selectedKeys?: Selection | Signal<Selection> | (() => Selection) | undefined;
  defaultSelectedKeys?: Selection | undefined;
  onSelectionChange?: ((keys: Selection) => void) | undefined;
  /** Keys that cannot be focused by arrow keys, selected or actioned. */
  disabledKeys?: MaybeAccessor<Iterable<Key> | undefined>;
  disallowEmptySelection?: boolean | undefined;
  /** Item action (Enter, click when nothing is selectable / selected, double click with `replace`). */
  onAction?: ((key: Key) => void) | undefined;
  /** Called when the end of the items scrolls into view (IntersectionObserver sentinel / virtualizer). */
  onLoadMore?: (() => void) | undefined;
  /** Whether more items are loading (shows `renderLoader`). */
  isLoading?: MaybeAccessor<boolean | undefined>;
  /** Loader content under the items while `isLoading`. */
  renderLoader?: (() => Content) | undefined;
  /** Content when there are no items. */
  renderEmptyState?: (() => Content) | undefined;
  /** `"grid"` (default: arrow keys, selection) or `"list"` (`role="list"`, tab through item content only). Read once at mount: structural (roles + keyboard model of the rendered tree). */
  semantics?: "grid" | "list" | undefined;
  id?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  /** Root class (default `rv-Masonry` / `rv-Bento`). */
  class?: string | undefined;
  style?: Record<string, string | number | undefined> | undefined;
  /** Grid element class (default `rv-Masonry-grid` / `rv-Bento-grid`). */
  gridClass?: string | undefined;
  /** Item element class (default `rv-Masonry-item` / `rv-Bento-item`; a value replaces it), or a function of the item state. */
  itemClass?: string | ((state: MasonryItemState) => string | undefined) | undefined;
  /** Loader element class (default `rv-Masonry-loader` / `rv-Bento-loader`). */
  loaderClass?: string | undefined;
  /** Empty-state row class (default `rv-<Masonry|Bento>-empty`). */
  emptyClass?: string | undefined;
}

export interface MasonryProps<T> extends MasonryBaseProps<T> {
  /** Aspect ratio (width / height) of an item; `null` = unknown (default: `item.aspectRatio`, else `width / height` — `?image` results qualify). May return a Signal / accessor (live). */
  getAspectRatio?: ((item: T) => MaybeAccessor<number | null | undefined>) | undefined;
  /** Fixed height in px of an item that has no ratio (text cards; default `item.height` when the item has no `width` / `aspectRatio`). Live like `getAspectRatio`. */
  getItemHeight?: ((item: T) => MaybeAccessor<number | null | undefined>) | undefined;
  /** Columns an item spans (number or breakpoint map; justified rows: a width weight). Default `item.span`, 1. Live: a Signal / accessor relayouts (animated). */
  getSpan?: ((item: T) => MaybeAccessor<Responsive<number> | null | undefined>) | undefined;
  /** px added to every item's ratio height (a caption row under each image). Live. */
  extraItemHeight?: number | undefined;
  /**
   * `"auto"` (default): server-placed when every item's size is known, a known leading run server-placed + the rest
   * measured, else measured; `"exact"`; `"measure"`; `"justified"` (rows that fill the width, Flickr justified-layout).
   * Read once at mount: structural (server-placed vs measured DOM, observers); switching would re-create every row.
   */
  layout?: "auto" | "exact" | "measure" | "justified" | undefined;
  /** Columns: `"both"` stretches each column's last item to the tallest column (flush bottom; images `object-fit: cover`). Live. */
  fit?: "none" | "both" | undefined;
  /** Justified: target row height in px (number or container-width map; keys split breakpoints). Default 240. Live. */
  rowHeight?: Responsive<number> | undefined;
  /** Justified: rows may vary ± rowHeight · tolerance. Default 0.25 (also spaces the width splits: geometric ratio (1 + t) / (1 − t)). Live. */
  rowHeightTolerance?: number | undefined;
  /** Justified: edge-case bounds (default 0.5× / 2× rowHeight; beyond them items crop). Live. */
  minRowHeight?: number | undefined;
  maxRowHeight?: number | undefined;
  /** Justified: last row `"fill"` (default: rebalanced, flush on both axes), `"justify"`, `"left"`, `"center"`. `"fill"` falls back to `"left"` when no rebalance fits the height bounds. Live. */
  lastRow?: JustifiedLastRow | undefined;
  /** Container width the greedy compares columns at (default: the middle of each breakpoint's range). Live. */
  referenceWidth?: number | undefined;
  /** Render only the items in view (cdk `Virtualizer` + `MasonryLayout`). Read once at mount (structural), and so are the layout options of the virtual layout object. */
  virtualize?: boolean | undefined;
  /** Scroller height when virtualized (CSS length or px). Default 600. */
  height?: number | string | undefined;
  /** Viewport size of the server-rendered window when virtualized (match the scroller). Default 800 × 600. */
  initialSize?: { width: number; height: number } | undefined;
}

export interface BentoProps<T> extends MasonryBaseProps<T> {
  /** Columns a tile spans: number or breakpoint map (default `item.colSpan`, 1); clamped to the column count. */
  getColSpan?: ((item: T) => Responsive<number> | null | undefined) | undefined;
  /** Rows a tile spans: number or breakpoint map (default `item.rowSpan`, 1). */
  getRowSpan?: ((item: T) => Responsive<number> | null | undefined) | undefined;
  /** Row height: px (default 160), `{ aspectRatio }` (column width / ratio), or `"auto"` (native CSS grid rows). Live, except switching to / from `"auto"` (read once at mount: native grid vs placed tiles). */
  rowHeight?: BentoRowHeight | undefined;
  /** `"dense"` (default: first fit, fills holes) or `"skyline"` (lowest drop, no backfill). Live. */
  pack?: BentoPack | undefined;
}

const OWNED = ["style"] as const;
/** Gridcell / unplaced item style (frozen: written as one `cssText`). */
const FULL: Readonly<Record<string, string>> = Object.freeze({ height: "100%" });
const LIVE_KEYS = ["disabledKeys", "isLoading"] as const;
/** Live layout props of Masonry (read in the `config` / `entries` computeds). */
const MASONRY_LIVE = [
  "items",
  "columns",
  "minItemWidth",
  "maxColumns",
  "gap",
  "rowHeight",
  "fit",
  "extraItemHeight",
  "referenceWidth",
  "rowHeightTolerance",
  "minRowHeight",
  "maxRowHeight",
  "lastRow",
  "maxWidth",
  "motion",
] as const;
/** Live layout props of Bento. */
const BENTO_LIVE = ["items", "columns", "minItemWidth", "maxColumns", "gap", "rowHeight", "pack", "maxWidth", "motion"] as const;
/**
 * Justified items waiting for a measured ratio (or behind one): a provisional row of hidden 1:1 placeholders below the
 * placed prefix (`--rv-pt` top, `--rv-pr` row height, `--rv-pa` advance, set on the grid while pending). The first
 * `PENDING_SLOTS` sit side by side; the rest wait past the inline end. The grid clips its inline overflow while pending,
 * so off-row placeholders never scroll the page and lazy images there stay unloaded until they move into the row.
 */
const PENDING_SLOTS = 24;
const pendingSlots: Readonly<Record<string, string>>[] = [];
function pendingSlot(j: number): Readonly<Record<string, string>> {
  const s = Math.min(j, PENDING_SLOTS);
  return (pendingSlots[s] ??= Object.freeze({
    position: "absolute",
    top: "var(--rv-pt)",
    "inset-inline-start": s === PENDING_SLOTS ? "calc(100% + 1px)" : s ? `calc(${s} * var(--rv-pa))` : "0px",
    width: "var(--rv-pr)",
    "box-sizing": "border-box",
    visibility: "hidden",
  }));
}
/** One px value per breakpoint as CSS (masked `max()` when they differ). */
function maskedPx(values: readonly number[]): string {
  return values.every((v) => v === values[0]) ? `${num(values[0]!)}px` : `max(${values.map((v, b) => `calc(${num(v)}px - var(--rv-m${b}))`).join(", ")})`;
}
const cx = (...parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(" ") || undefined;
const px = (v: number | string | undefined, fallback: string) => (v == null ? fallback : typeof v === "number" ? `${v}px` : v);

/** One entry of the items pipeline. */
interface Entry<T> {
  key: Key;
  item: T;
  index: number;
}
interface Entries<T> {
  keys: Key[];
  byKey: Map<Key, Entry<T>>;
  list: Entry<T>[];
}
/** Marker of a key that just left the items (its row keeps its last values until `For` disposes it). */
const GONE: unique symbol = Symbol("gone");
/** Row item equality: the same item object keeps the row's content (no re-render on an append / reorder). */
const keepItem = (previous: unknown, next: unknown) => previous === next || next === GONE;
const keepIndex = (previous: unknown, next: unknown) => previous === next || (next as number) < 0;
/** Live row inputs of one key: the item (by reference) and its position, as separate computeds. */
interface Row<T> {
  item: () => T;
  index: () => number;
}

function entriesOf<T>(items: readonly T[], getKey: (item: T, index: number) => Key): Entries<T> {
  const keys: Key[] = new Array(items.length);
  const byKey = new Map<Key, Entry<T>>();
  const list: Entry<T>[] = new Array(items.length);
  for (let i = 0; i < items.length; i++) {
    const key = getKey(items[i]!, i);
    const entry = { key, item: items[i]!, index: i };
    keys[i] = key;
    list[i] = entry;
    byKey.set(key, entry);
  }
  return { keys, byKey, list };
}

/** Internal: the grid element, rows, handlers, selection, loader and empty state shared by Masonry and Bento. */
interface ShellProps<T> {
  props: MasonryBaseProps<T>;
  kind: "Masonry" | "Bento";
  entries: () => Entries<T>;
  /** Item inline style (geometry). */
  itemStyle: (key: Key) => Readonly<Record<string, string>> | undefined;
  /** Grid inline style. */
  gridStyle: () => Record<string, string> | undefined;
  /** `data-layout` (live for Bento `pack`). */
  layout: string | (() => string);
  /** Measured mode: one client effect keeps the items placed. */
  measure: MeasureOptions | null;
  /** Live inputs of the measured layout (spans): a change relayouts with motion. */
  measureVersion?: (() => unknown) | null;
  /** The grid element ref (shared with the caller's FLIP / handle code). */
  grid: GridRef;
  /** Justified items without a ratio at mount (server-rendered pending rows): one effect measures them (`pending` keys). */
  measureRatio?: { pending: (key: Key) => boolean; record: (key: Key, ratio: number) => void } | null;
  /** `max-width` of the root (px), live. */
  maxWidth?: (() => number | null) | null;
  /** Item rect (start-edge, grid-relative) from the layout at a grid width, for keys not rendered / FLIP. */
  layoutRect?: ((key: Key, width: number) => Rect | null) | null;
  /** Virtualized rects at a scroller width (keyboard geometry), or null. */
  rects: (width: number) => { key: Key; rect: Rect }[] | null;
  /** aria-rowindex / colindex of an item (Bento with one breakpoint), or null. */
  cellIndex: (key: Key) => { row: number; col: number } | null;
  /** Virtualized Masonry options, or null. */
  virtual: {
    layout: () => MasonryLayout<Entry<T>>;
    layoutOptions: MasonryLayoutOptions;
    initialSize: { width: number; height: number };
    height: string;
  } | null;
}

function Shell<T>(shell: ShellProps<T>): DOMValue {
  const props = shell.props;
  const kind = shell.kind;
  const dom = globalDOMProps(props, OWNED);
  const [live] = splitProps(props as unknown as Record<string, unknown>, LIVE_KEYS) as unknown as [Pick<MasonryBaseProps<T>, (typeof LIVE_KEYS)[number]>];
  // PROPS-CAPTURE: closures capture locals only (a captured `props` would serialize every prop).
  const render = props.children;
  const itemClassProp = props.itemClass;
  const onAction = props.onAction;
  const onLoadMore = props.onLoadMore;
  const renderLoader = props.renderLoader;
  const renderEmptyState = props.renderEmptyState;
  const hasLoadMore = !!props.onLoadMore;
  const isList = props.semantics === "list";
  const selectionMode: SelectionMode = isList ? "none" : (props.selectionMode ?? "none");
  const selectionBehavior: SelectionBehavior = props.selectionBehavior ?? "toggle";
  const disallowEmpty = !!props.disallowEmptySelection;
  const entries = shell.entries;
  const itemStyle = shell.itemStyle;
  const gridStyle = shell.gridStyle;
  const cellIndex = shell.cellIndex;
  const rects = shell.rects;
  const measure = shell.measure;
  const virtual = shell.virtual;
  const classes = {
    root: props.class ?? `rv-${kind}`,
    grid: props.gridClass ?? `rv-${kind}-grid`,
    item: `rv-${kind}-item`,
    loader: props.loaderClass ?? `rv-${kind}-loader`,
    empty: props.emptyClass ?? `rv-${kind}-empty`,
  };

  const selection = controllable<Selection>(props.selectedKeys as never, props.defaultSelectedKeys ?? new Set<Key>(), props.onSelectionChange);
  const anchor = signal<Key | null>(null);
  const focused = signal<Key | null>(null);
  const disabled = computed(() => new Set(read(live.disabledKeys) ?? []));
  const keys = computed(() => entries().keys);
  const loading = () => !!read(live.isLoading);
  const isSelected = (key: Key) => selectionMode !== "none" && isKeySelected(selection.value(), key, disabled());

  const ctx: MasonryContext = {
    keys: () => keys(),
    selection,
    mode: () => selectionMode,
    behavior: () => selectionBehavior,
    disabled: () => disabled(),
    disallowEmpty: () => disallowEmpty,
    anchor,
    focused,
    hasAction: () => !!onAction,
    onAction: (key) => onAction?.(key),
    isList: () => isList,
    rects: (width) => rects(width),
  };

  const grid = shell.grid;
  const measureRatio = shell.measureRatio ?? null;
  const maxWidth = shell.maxWidth ?? null;
  // Items without a ratio at mount (justified): one effect measures the pending rows (also those created later). A grid
  // whose items all have ratios at mount boots nothing; its first client placement with a pending item starts the watcher.
  if (measureRatio)
    clientEffect(() => {
      const element = grid();
      if (!element) return;
      return watchRatios(
        element,
        (key) => measureRatio.pending(key),
        (key, ratio) => measureRatio.record(key, ratio),
      );
    });
  const measureVersion = shell.measureVersion ?? null;
  const layoutRect = shell.layoutRect ?? null;
  if (measure)
    clientEffect(() => {
      // Once per grid element: the observers follow added / removed items and size changes (no per-change effect).
      const element = grid();
      if (!element) return;
      return watchMeasured(element, measure);
    });
  if (measure && measureVersion) {
    let first = true;
    clientEffect(() => {
      measureVersion();
      const element = untrack(grid);
      if (first || !element) return void (first = false);
      relayoutMeasured(element, true);
    });
  }
  const handleRef = props.handleRef;
  if (handleRef)
    assignRef(handleRef, {
      relayout: () => {
        const element = grid();
        if (element) masonryRelayout(element);
      },
      scrollToItem: (key) => {
        const element = grid();
        if (element) masonryScrollTo(element, key, (width) => rects(width));
      },
      getPosition: (key) => {
        const element = grid();
        return element ? masonryPosition(element, key, layoutRect) : null;
      },
    });
  // Virtualized: the Virtualizer renders its first window at `initialSize` and starts its engine on the first scroll or
  // focus. Masonry column widths depend on the real width, so start it at once when the scroller size differs (one
  // synthetic scroll; the engine then follows resizes itself). Boots one client effect, like the measured mode.
  const initialSize = virtual?.initialSize ?? null;
  if (initialSize)
    clientEffect(() => {
      const scroller = grid()?.querySelector<HTMLElement>(":scope > [data-rv-scroller]");
      if (!scroller) return;
      if (Math.abs(scroller.clientWidth - initialSize.width) > 0.5 || Math.abs(scroller.clientHeight - initialSize.height) > 0.5)
        scroller.dispatchEvent(new Event("scroll"));
    });
  const sentinel = elementRef<HTMLDivElement>();
  if (hasLoadMore && !virtual) loadMoreSentinel({ collection: (() => keys()) as never, onLoadMore: () => onLoadMore?.() }, () => sentinel());

  const itemClass = typeof itemClassProp === "function" ? undefined : (itemClassProp ?? classes.item);
  // One item element (row + gridcell, or listitem) for a key; `state` accessors read the live entry.
  const itemOf = (key: Key, row: Row<T>, styled: boolean) => {
    const rowItem = row.item;
    const rowIndex = row.index;
    const state: MasonryItemState = {
      key,
      index: () => rowIndex(),
      isSelected: () => isSelected(key),
      isDisabled: () => disabled().has(key),
    };
    // Re-renders only when this key's item object changes (an append / reorder / other item's update keeps the DOM).
    const content = <>{(rowItem() as unknown) === GONE ? null : render(rowItem(), state)}</>;
    // Per-row memo: a relayout that keeps this item's style object writes nothing to it.
    const rowStyle = styled ? computed(() => itemStyle(key)) : null;
    if (isList)
      return (
        <div
          role="listitem"
          class={typeof itemClassProp === "function" ? itemClassProp(state) : itemClass}
          data-rv-item=""
          data-key={String(key)}
          data-key-type={typeof key === "number" ? "number" : undefined}
          style={rowStyle ? rowStyle() : FULL}
        >
          {content}
        </div>
      );
    return (
      <div
        role="row"
        class={typeof itemClassProp === "function" ? itemClassProp(state) : itemClass}
        data-rv-item=""
        data-key={String(key)}
        data-key-type={typeof key === "number" ? "number" : undefined}
        tabIndex={-1}
        aria-rowindex={cellIndex(key)?.row}
        aria-selected={selectionMode !== "none" ? (isSelected(key) ? "true" : "false") : undefined}
        data-selected={isSelected(key) ? "true" : undefined}
        aria-disabled={disabled().has(key) ? "true" : undefined}
        data-disabled={disabled().has(key) ? "true" : undefined}
        style={rowStyle ? rowStyle() : FULL}
      >
        <div role="gridcell" aria-colindex={cellIndex(key)?.col} style={FULL}>
          {content}
        </div>
      </div>
    );
  };

  const empty = renderEmptyState ? (
    <Show when={() => keys().length === 0 && !loading()}>
      <div role={isList ? "listitem" : "row"} class={classes.empty} data-empty="">
        {isList ? renderEmptyState() : <div role="gridcell">{renderEmptyState()}</div>}
      </div>
    </Show>
  ) : null;
  const loaderElement = renderLoader ? (
    <div class={classes.loader} data-loading={loading() ? "true" : undefined} hidden={!loading()} aria-hidden={loading() ? undefined : "true"}>
      {renderLoader()}
    </div>
  ) : null;

  const root = classes.root;
  const baseStyle = { "container-type": "inline-size", ...props.style };
  const style = maxWidth ? () => (maxWidth() ? { ...baseStyle, "max-width": `${maxWidth()}px` } : baseStyle) : () => baseStyle;
  const gridClass = classes.grid;

  if (virtual) {
    // The virtualizer's items are the entries (key + item): no key lookups per item.
    const list = () => entries().list;
    return (
      <div
        {...dom}
        class={root}
        style={style()}
        data-rv-masonry=""
        data-layout={typeof shell.layout === "function" ? shell.layout() : shell.layout}
        data-virtualized="true"
        preload="visible"
      >
        <div
          ref={grid}
          role={isList ? "list" : "grid"}
          data-rv-grid=""
          class={gridClass}
          id={props.id}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          aria-multiselectable={selectionMode === "multiple" ? "true" : undefined}
          aria-rowcount={isList ? undefined : keys().length}
          tabIndex={isList ? undefined : 0}
          onKeyDown={(e) => masonryKeyDown(e, ctx)}
          onClick={(e) => masonryClick(e, ctx)}
          onDblClick={(e) => masonryDoubleClick(e, ctx)}
          onPointerDown={(e) => masonryPointerDown(e)}
          onFocusIn={(e) => masonryFocusIn(e, ctx)}
          onFocusOut={(e) => masonryFocusOut(e)}
        >
          <Virtualizer
            items={list}
            getKey={(entry: Entry<T>) => entry.key}
            layout={virtual.layout}
            layoutOptions={virtual.layoutOptions}
            initialSize={virtual.initialSize}
            isLoading={() => loading()}
            onLoadMore={hasLoadMore ? () => onLoadMore?.() : undefined}
            data-rv-scroller=""
            class={`rv-${kind}-scroller`}
            style={{ height: virtual.height }}
          >
            {(_entry, view) => {
              const key = untrack(() => view().key);
              if (untrack(() => view().type) === "loader") return loaderElement;
              // Resumable recipes: inline arrows over locals (a helper's closures would not resume).
              const item = computed((): T => (entries().byKey.get(key)?.item ?? GONE) as T, { equals: keepItem });
              const index = computed((): number => entries().byKey.get(key)?.index ?? -1, { equals: keepIndex });
              return itemOf(key, { item, index }, false);
            }}
          </Virtualizer>
          {empty}
        </div>
      </div>
    );
  }

  return (
    <div
      {...dom}
      class={root}
      style={style()}
      data-rv-masonry=""
      data-layout={typeof shell.layout === "function" ? shell.layout() : shell.layout}
      preload="visible"
    >
      <div
        ref={grid}
        role={isList ? "list" : "grid"}
        data-rv-grid=""
        class={gridClass}
        id={props.id}
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-multiselectable={selectionMode === "multiple" ? "true" : undefined}
        tabIndex={isList ? undefined : 0}
        style={gridStyle()}
        onKeyDown={(e) => masonryKeyDown(e, ctx)}
        onClick={(e) => masonryClick(e, ctx)}
        onDblClick={(e) => masonryDoubleClick(e, ctx)}
        onPointerDown={(e) => masonryPointerDown(e)}
        onFocusIn={(e) => masonryFocusIn(e, ctx)}
        onFocusOut={(e) => masonryFocusOut(e)}
      >
        <For each={keys} by={(k) => k}>
          {(keyOf) => {
            // Rows are keyed by their (primitive) key: a resumed page adopts every server row on the first change.
            const key = untrack(keyOf);
            // Resumable recipes: inline arrows over locals (a helper's closures would not resume).
            const item = computed((): T => (entries().byKey.get(key)?.item ?? GONE) as T, { equals: keepItem });
            const index = computed((): number => entries().byKey.get(key)?.index ?? -1, { equals: keepIndex });
            return itemOf(key, { item, index }, true);
          }}
        </For>
        {empty}
      </div>
      {hasLoadMore ? <div ref={sentinel} data-load-more="" aria-hidden="true" style={{ height: "1px" }} /> : null}
      {loaderElement}
    </div>
  );
}

type GridRef = ReturnType<typeof elementRef<HTMLDivElement>>;

/** Reads a reader result that may be a Signal / accessor (live per-item controls). */
const value = <V,>(v: V | (() => V)): V => (typeof v === "function" ? (v as () => V)() : v);

/** Breakpoint index and unit (column width; one column: the container width) at grid width `width`. */
function unitAt(breakpoints: readonly Breakpoint[], width: number): [number, number] {
  const b = breakpointAt(breakpoints, width);
  const bp = breakpoints[b]!;
  return [b, columnWidth(width, bp.columns, bp.gap[0])];
}

/**
 * FLIP around a client relayout of server-placed (CSS) geometry. `capture(previous)` = First: the old boxes come from
 * the previous geometry at the grid's current width (one read: the grid rect), DOM reads only for items whose
 * animation is still running (their visual box); null when motion is off, on the server, or before the grid exists.
 * `play()` (a microtask after the writes) animates them to the new geometry evaluated at the same width.
 */
interface FlipFirst {
  el: HTMLDivElement;
  boxes: Boxes;
  width: number;
  rtl: boolean;
  band: [number, number];
}
interface FlipPrevious {
  geometries: readonly Geometry[];
  index: ReadonlyMap<Key, number>;
}
function flipper(
  grid: GridRef,
  breakpoints: () => readonly Breakpoint[],
  motion: () => MasonryBaseProps<unknown>["motion"],
): {
  capture(previous: FlipPrevious | null): FlipFirst | null;
  play(first: FlipFirst | null, geometries: readonly Geometry[], keys: readonly Key[], styles: ReadonlyMap<Key, Readonly<Record<string, string>>>): void;
} {
  return {
    capture(previous): FlipFirst | null {
      if (typeof document === "undefined" || !previous || !motionAllowed(motion())) return null;
      const el = untrack(grid);
      if (!el || !el.isConnected) return null;
      const rect = el.getBoundingClientRect();
      const rtl = getComputedStyle(el).direction === "rtl";
      const [b, u] = unitAt(breakpoints(), rect.width);
      const g = previous.geometries[b];
      const boxes: Boxes = new Map();
      if (g) {
        const rects = rectsAt(g, u);
        for (const [key, i] of previous.index) if (rects[i]) boxes.set(key, rects[i]!);
      }
      // Items still moving: their visual box (a relayout during an animation starts from where they are).
      for (const [key, box] of animatingBoxes(el, rtl)) boxes.set(key, box);
      return { el, boxes, width: rect.width, rtl, band: [-rect.top, window.innerHeight - rect.top] };
    },
    play(first, geometries, keys, styles) {
      if (!first) return;
      const m = motion();
      const options = typeof m === "object" ? m : undefined;
      // After the flush that writes the new styles; the final values come from the style map (never a stale read).
      queueMicrotask(() => {
        const [b, u] = unitAt(breakpoints(), first.width);
        const rects = rectsAt(geometries[b]!, u);
        const after: Boxes = new Map();
        for (let i = 0; i < rects.length && i < keys.length; i++) after.set(keys[i]!, rects[i]!);
        playFlip(first.el, first.boxes, after, first.rtl, first.band, options, (key) => styles.get(key));
      });
    },
  };
}

/** Item `i` of `b` has the same boxes as item `j` of `a` in every breakpoint (numeric terms, no CSS rebuilt). */
function sameBoxes(a: readonly Geometry[], j: number, b: readonly Geometry[], i: number): boolean {
  for (let k = 0; k < a.length; k++) {
    const p = a[k]!;
    const q = b[k]!;
    if (p.ratio[j] !== q.ratio[i]) return false;
    for (const f of ["x", "width", "height", "top"] as const) if (p[f][2 * j] !== q[f][2 * i] || p[f][2 * j + 1] !== q[f][2 * i + 1]) return false;
    if (!sameTerms(p.topMore?.[j], q.topMore?.[i]) || !sameTerms(p.heightMore?.[j], q.heightMore?.[i])) return false;
  }
  return true;
}
const sameTerms = (a: Float64Array | null | undefined, b: Float64Array | null | undefined) => {
  if (!a || !b) return !a === !b;
  if (a.length !== b.length) return false;
  for (let t = 0; t < a.length; t++) if (a[t] !== b[t]) return false;
  return true;
};

/** Style objects whose values did not change keep their identity (the binding writes nothing). */
function sameStyle(a: Readonly<Record<string, string>> | undefined, b: Readonly<Record<string, string>>): boolean {
  if (!a) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/** Geometry extents shifted by each breakpoint's row gap (space under a server-placed prefix). */
const padded = (geometries: readonly Geometry[], breakpoints: readonly Breakpoint[]): Geometry[] =>
  geometries.map((g, b) => {
    const ext = g.extent.slice();
    for (let t = 1; t < ext.length; t += 2) ext[t]! += breakpoints[b]!.gap[1];
    return { ...g, extent: ext };
  });

/**
 * Masonry: items flow into the shortest column (Pinterest-style), or into justified rows (`layout="justified"`). Sizes
 * known (aspect ratios, `?image` width / height, fixed heights) → the server lays out (exact inline CSS at any width,
 * zero CLS, no client JS); unknown sizes → measured in the browser (a known leading run stays server-placed).
 */
export function Masonry<T>(props: MasonryProps<T>): DOMValue {
  // Read once at mount (structural: they choose the DOM shape, observers and effects): `layout`, `virtualize`,
  // `semantics`, the reader functions. Every other layout prop is live (the `config` computed below).
  const mode = props.layout ?? "auto";
  const justified = mode === "justified";
  const keyProp = props.getKey;
  const ratioProp = props.getAspectRatio;
  const heightProp = props.getItemHeight;
  const spanProp = props.getSpan;
  const [live] = splitProps(props as unknown as Record<string, unknown>, MASONRY_LIVE) as unknown as [Pick<MasonryProps<T>, (typeof MASONRY_LIVE)[number]>];
  const config = computed(() => {
    const rowHeight: Responsive<number> = live.rowHeight ?? 240;
    const maxWidth = live.maxWidth != null && live.maxWidth > 0 ? live.maxWidth : null;
    const tolerance = live.rowHeightTolerance ?? 0.25;
    let breakpoints = justified
      ? resolveBreakpoints(1, null, 1, live.gap, [...responsiveMins(rowHeight), ...justifiedSplits(tolerance, maxWidth)])
      : resolveBreakpoints(live.columns, live.minItemWidth, live.maxColumns ?? 4, live.gap);
    if (maxWidth) breakpoints = capBreakpoints(breakpoints, maxWidth);
    registerGridProperties(breakpoints.length);
    return {
      breakpoints,
      refWidths: referenceWidths(breakpoints, live.referenceWidth, maxWidth),
      ranges: breakpoints.map((_, b) => unitRange(breakpoints, b, maxWidth)),
      vars: gridVars(breakpoints),
      extra: live.extraItemHeight ?? 0,
      fit: live.fit === "both",
      rowHeight,
      maxWidth,
      justified: { tolerance, minRowHeight: live.minRowHeight, maxRowHeight: live.maxRowHeight, lastRow: live.lastRow },
    };
  });
  // Justified items without a ratio: measured in the browser (natural image ratio, else the box at a fixed width).
  // A Map + version signal: recording a ratio is O(1) (no copy of every ratio so far).
  const ratios = new Map<string, number>();
  const ratioVersion = signal(0);
  // Module-level defaults are referenced inside the closures (imports), never held in a captured local.
  const getKey = (item: T, index: number): Key => (keyProp ?? defaultItemKey)(item, index);
  const ratioOf = (item: T, key: Key): number | null =>
    validRatio(value((ratioProp ?? defaultAspectRatio)(item))) ?? (justified ? (ratioVersion(), ratios.get(String(key)) ?? null) : null);
  const heightOf = (item: T): number | null => validRatio(value((heightProp ?? defaultItemHeight)(item)));
  const spanOf = (item: T): Responsive<number> => value((spanProp ?? defaultSpan)(item)) ?? 1;
  const known = (item: T, key: Key) => ratioOf(item, key) != null || (!justified && heightOf(item) != null);
  const entries = computed(() => entriesOf(read(live.items) ?? [], getKey));
  const initial = untrack(entries).list;
  let lead = 0;
  while (lead < initial.length && untrack(() => known(initial[lead]!.item, initial[lead]!.key))) lead++;
  // `exact` = `auto` for unknown sizes: never a silent square / zero-height box.
  const kind: "exact" | "measure" | "mixed" | "justified" = justified
    ? "justified"
    : mode === "measure"
      ? "measure"
      : lead === initial.length
        ? "exact"
        : lead > 0
          ? "mixed"
          : "measure";
  if (mode === "exact" && kind !== "exact") warnUnknownExact(initial.length - lead);
  const grid: GridRef = elementRef<HTMLDivElement>();
  const flip = flipper(
    grid,
    () => untrack(config).breakpoints,
    () => live.motion,
  );

  // Server-known placement (exact, justified, the known prefix of a mixed / justified list): per breakpoint,
  // incremental for columns; unchanged item geometry keeps its style object (no DOM write).
  let prev: { keys: Key[]; alpha: Float64Array; beta: Float64Array; spans: Uint16Array[]; runs: ColumnsRun[]; config: unknown } | null = null;
  let last: { styles: Map<Key, Readonly<Record<string, string>>>; index: Map<Key, number>; geometries: Geometry[] } | null = null;
  let prevJustified: { keys: Key[]; aspects: Float64Array[]; runs: JustifiedRun[]; config: unknown } | null = null;
  let warned = false;
  // Declared before `placement` (resume captures are read at creation). Pending = no ratio yet (prop or measured).
  const ratioPending = (key: Key): boolean => {
    const entry = untrack(entries).byKey.get(key);
    return !!entry && untrack(() => ratioOf(entry.item, key)) == null;
  };
  const ratioRecord = (key: Key, ratio: number) => {
    ratios.set(String(key), ratio);
    ratioVersion.set(untrack(ratioVersion) + 1);
  };
  const placement = computed(() => {
    const c = config();
    const breakpoints = c.breakpoints;
    const list = entries().list;
    let count = list.length;
    if (kind === "mixed" || kind === "justified") {
      count = 0;
      while (count < list.length && known(list[count]!.item, list[count]!.key)) count++;
    }
    const first = flip.capture(last ? { geometries: last.geometries, index: last.index } : null);
    const keys: Key[] = new Array(count);
    for (let i = 0; i < count; i++) keys[i] = list[i]!.key;
    let geometries: Geometry[];
    let runs: ColumnsRun[] = [];
    const rowHeights: number[] = [];
    if (kind === "justified") {
      // Per breakpoint, resumed from the row holding the first changed item (same config): a span toggle re-packs the rows from there.
      const resume = prevJustified && prevJustified.config === c ? prevJustified : null;
      const aspectsAt: Float64Array[] = [];
      const jruns = breakpoints.map((bp, b) => {
        const aspects = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          const entry = list[i]!;
          aspects[i] = ratioOf(entry.item, entry.key)! * Math.max(0.01, Number(responsiveAt(spanOf(entry.item), bp.min, 1)) || 1);
        }
        aspectsAt.push(aspects);
        let from = 0;
        if (resume) {
          const before = resume.aspects[b]!;
          const n = Math.min(count, resume.keys.length);
          while (from < n && resume.keys[from] === keys[from] && before[from] === aspects[from]) from++;
        }
        const options = { ...c.justified, rowHeight: responsiveAt(c.rowHeight, bp.min, 240), gap: bp.gap };
        rowHeights.push(options.rowHeight);
        return placeJustifiedRun(aspects, c.refWidths[b]!, options, resume && from > 0 ? { run: resume.runs[b]!, from } : null);
      });
      prevJustified = { keys, aspects: aspectsAt, runs: jruns, config: c };
      // Items without a ratio added on the client: start the ratio watcher (no-op when it runs; never on the server).
      if (count < list.length && typeof document !== "undefined") {
        const el = untrack(grid);
        if (el) watchRatios(el, ratioPending, ratioRecord);
      }
      geometries = jruns.map((run) => run.geometry);
    } else {
      const alpha = new Float64Array(count);
      const beta = new Float64Array(count);
      for (let i = 0; i < count; i++) {
        const entry = list[i]!;
        const r = ratioOf(entry.item, entry.key);
        const h = r ? null : heightOf(entry.item);
        if (!r && h == null) {
          // An `exact` grid gained an item of unknown size after mount (the kind is chosen at mount): square + dev warning.
          if (!warned) (warnUnknownExact(1, true), (warned = true));
          alpha[i] = 1;
          beta[i] = c.extra;
          continue;
        }
        alpha[i] = r ? 1 / r : 0;
        beta[i] = r ? c.extra : h!;
      }
      const spans = breakpoints.map((bp) => {
        const out = new Uint16Array(count);
        for (let i = 0; i < count; i++) out[i] = Math.max(1, Math.floor(Number(responsiveAt(spanOf(list[i]!.item), bp.min, 1))) || 1);
        return out;
      });
      // First changed input: re-place from there on (the columns before it keep their state).
      let from = 0;
      if (prev && prev.config === c) {
        const n = Math.min(count, prev.keys.length);
        while (
          from < n &&
          prev.keys[from] === keys[from] &&
          prev.alpha[from] === alpha[from] &&
          prev.beta[from] === beta[from] &&
          spans.every((sp, b) => sp[from] === prev!.spans[b]![from])
        )
          from++;
      }
      const resume = prev && from > 0 ? prev : null;
      runs = breakpoints.map((bp, b) =>
        placeColumns(
          { alpha, beta, span: spans[b] },
          bp.columns,
          columnWidth(c.refWidths[b]!, bp.columns, bp.gap[0]),
          c.ranges[b]![0],
          c.ranges[b]![1],
          bp.gap[0],
          bp.gap[1],
          resume ? { run: resume.runs[b]!, from } : null,
        ),
      );
      geometries = runs.map((run, b) => (c.fit ? fitColumns(run, c.ranges[b]![0], c.ranges[b]![1]) : run.geometry));
      prev = { keys, alpha, beta, spans, runs, config: c };
    }
    const styles = new Map<Key, Readonly<Record<string, string>>>();
    const index = new Map<Key, number>();
    for (let i = 0; i < count; i++) {
      const key = keys[i]!;
      index.set(key, i);
      const j = last?.index.get(key);
      const before = j == null ? undefined : last!.styles.get(key);
      // Same boxes in every breakpoint: keep the style object without rebuilding it (the binding writes nothing).
      if (before && last!.geometries.length === geometries.length && sameBoxes(last!.geometries, j!, geometries, i)) {
        styles.set(key, before);
        continue;
      }
      const next = geometryStyle(geometries, i);
      styles.set(key, sameStyle(before, next) ? before! : next);
    }
    last = { styles, index, geometries };
    flip.play(first, geometries, keys, styles);
    const height = geometryHeight(geometries);
    // Justified items without a ratio (or behind one): the provisional row below the prefix (the grid height includes it).
    let pending: Record<string, string> | null = null;
    if (kind === "justified" && count < list.length) {
      for (let i = count; i < list.length; i++) styles.set(list[i]!.key, pendingSlot(i - count));
      pending = {
        "--rv-pr": maskedPx(rowHeights),
        "--rv-pa": maskedPx(rowHeights.map((h, b) => h + breakpoints[b]!.gap[0])),
        "--rv-pt": count ? `calc(${height} + ${maskedPx(breakpoints.map((bp) => bp.gap[1]))})` : "0px",
        "overflow-x": "clip",
      };
    }
    return {
      styles,
      count,
      geometries,
      runs,
      pending,
      height: pending ? "calc(var(--rv-pt) + var(--rv-pr))" : height,
      padTop: count ? geometryHeight(padded(geometries, breakpoints)) : "0px",
    };
  });
  // Measured first paint (CSS columns): only built when something is measured (exact pages do not serialize it).
  const measured = kind === "measure" || kind === "mixed";
  const measuredGrid = measured
    ? computed((): Record<string, string> => ({
        ...config().vars,
        "column-width": "calc(var(--rv-mw) - 0.01px)",
        "column-gap": columnGapCss(config().breakpoints),
      }))
    : null;
  const measuredItem = measured
    ? computed((): Readonly<Record<string, string>> => {
        const breakpoints = config().breakpoints;
        return Object.freeze({
          "box-sizing": "border-box",
          width: "var(--rv-mw)",
          "break-inside": "avoid",
          "margin-block-end": breakpoints.every((bp) => bp.gap[1] === breakpoints[0]!.gap[1])
            ? `${num(breakpoints[0]!.gap[1])}px`
            : `max(${breakpoints.map((bp, b) => `calc(${num(bp.gap[1])}px - var(--rv-m${b}))`).join(", ")})`,
        });
      })
    : null;
  const layoutRect = (key: Key, width: number): Rect | null => {
    const p = placement();
    const i = p.styles.has(key) ? untrack(entries).byKey.get(key)?.index : undefined;
    if (i == null || i >= p.count) return null;
    const [b, u] = unitAt(config().breakpoints, width);
    return rectsAt(p.geometries[b]!, u)[i] ?? null;
  };

  if (props.virtualize) {
    // Virtualized: the Virtualizer's layout options are read once at mount (its engine owns the relayout).
    const c0 = untrack(config);
    const layoutOptions: MasonryLayoutOptions = {
      breakpoints: c0.breakpoints,
      extra: c0.extra,
      referenceWidth: props.referenceWidth ?? null,
      justified: justified ? { rowHeight: c0.rowHeight, ...c0.justified } : null,
    };
    const height = px(props.height, "600px");
    // Live spans / ratios re-run the virtualizer layout (a new items array → the engine re-lays out).
    const version = computed(() =>
      entries()
        .list.map((e) => `${JSON.stringify(spanOf(e.item))}:${ratioOf(e.item, e.key)}`)
        .join("|"),
    );
    const virtualEntries = computed(() => {
      version();
      const e = entries();
      return { ...e, list: e.list.slice() };
    });
    return (
      <Shell
        props={props}
        kind="Masonry"
        entries={virtualEntries}
        itemStyle={() => undefined}
        gridStyle={() => undefined}
        layout="virtual"
        measure={null}
        grid={grid}
        rects={(width) => {
          // Known sizes only: measured virtual rows navigate by their rendered rects.
          const list = entries().list;
          if (!list.every((e) => ratioOf(e.item, e.key) != null)) return null;
          const layout = new MasonryLayout<Entry<T>>(
            (entry) => ratioOf(entry.item, entry.key),
            (entry) => spanOf(entry.item),
          );
          return virtualRects(layout, list, width, layoutOptions);
        }}
        cellIndex={() => null}
        virtual={{
          layout: () =>
            new MasonryLayout<Entry<T>>(
              (entry) => ratioOf(entry.item, entry.key),
              (entry) => spanOf(entry.item),
            ),
          layoutOptions,
          initialSize: props.initialSize ?? { width: 800, height: 600 },
          height,
        }}
      />
    );
  }
  const serverPlaced = kind !== "measure";
  // Local consts referenced unconditionally (resumable captures; a const referenced only inside a conditional is not).
  const measureSpan = (el: HTMLElement, min: number): number | null => {
    if (!spanProp) return null;
    const entry = untrack(entries).byKey.get(keyOf(el));
    return entry ? Math.max(1, Math.floor(Number(responsiveAt(spanOf(entry.item), min, 1))) || 1) : 1;
  };
  const measurePrefix = () => {
    if (kind !== "mixed") return null;
    const p = untrack(placement);
    const breakpoints = untrack(config).breakpoints;
    return {
      count: p.count,
      bottoms: (width: number) => {
        const [b, u] = unitAt(breakpoints, width);
        return p.runs[b]!.state.bottoms.map((terms, c) => {
          if (!p.runs[b]!.state.count[c]) return 0;
          let v = -Infinity;
          for (let t = 0; t < terms.length; t += 2) v = Math.max(v, terms[t]! * u + terms[t + 1]!);
          return v;
        });
      },
    };
  };
  const measureBreakpoints = () => config().breakpoints;
  const measureMotion = () => live.motion;
  const measure: MeasureOptions | null =
    kind === "measure" || kind === "mixed"
      ? {
          breakpoints: measureBreakpoints,
          spanOf: measureSpan,
          prefix: measurePrefix,
          motion: measureMotion,
        }
      : null;
  // Justified items waiting for a measured ratio (or behind one): hidden, at a fixed width, until placed.
  const pendingStyle = justified ? pendingSlot(PENDING_SLOTS) : null;
  const measureRatio = justified && lead < initial.length ? { pending: ratioPending, record: ratioRecord } : null;
  return (
    <Shell
      props={props}
      kind="Masonry"
      entries={entries}
      itemStyle={(key) => {
        if (!serverPlaced) return measuredItem!();
        // Removed rows read once more before disposal (exact: no fallback style).
        return placement().styles.get(key) ?? pendingStyle ?? measuredItem?.();
      }}
      gridStyle={() =>
        kind === "measure"
          ? measuredGrid!()
          : kind === "mixed"
            ? { ...measuredGrid!(), position: "relative", "padding-top": placement().padTop }
            : { ...config().vars, ...placement().pending, position: "relative", height: placement().height }
      }
      layout={kind}
      measure={measure}
      measureVersion={
        measure
          ? () => {
              config();
              return spanProp
                ? entries()
                    .list.map((e) => JSON.stringify(spanOf(e.item)))
                    .join("|")
                : "";
            }
          : null
      }
      measureRatio={measureRatio}
      maxWidth={() => config().maxWidth}
      grid={grid}
      layoutRect={serverPlaced ? layoutRect : null}
      rects={() => null}
      cellIndex={() => null}
      virtual={null}
    />
  );
}

/** Virtualized rects of `list` at a scroller width (keyboard geometry outside the rendered window). */
function virtualRects<T>(layout: MasonryLayout<Entry<T>>, list: readonly Entry<T>[], width: number, options: MasonryLayoutOptions) {
  return layout.rectsFor(
    list.map((entry) => ({ key: entry.key, value: entry })),
    width,
    options,
  );
}

/**
 * Bento: tiles with column / row spans on a uniform grid, packed on the server (`dense` fills holes like CSS
 * `grid-auto-flow: dense`; `skyline` keeps rows in reading order). Fixed or aspect row heights are exact inline CSS at
 * any width; `rowHeight="auto"` uses the browser's own CSS grid (content-sized rows).
 */
export function Bento<T>(props: BentoProps<T>): DOMValue {
  // Read once at mount (structural): `rowHeight="auto"` (native CSS grid) vs placed tiles, the reader functions.
  const keyProp = props.getKey;
  const colSpanProp = props.getColSpan;
  const rowSpanProp = props.getRowSpan;
  const getKey = (item: T, index: number): Key => (keyProp ?? defaultItemKey)(item, index);
  const colSpanOf = (item: T): Responsive<number> => value((colSpanProp ?? defaultColSpan)(item)) ?? 1;
  const rowSpanOf = (item: T): Responsive<number> => value((rowSpanProp ?? defaultRowSpan)(item)) ?? 1;
  const [live] = splitProps(props as unknown as Record<string, unknown>, BENTO_LIVE) as unknown as [Pick<BentoProps<T>, (typeof BENTO_LIVE)[number]>];
  const entries = computed(() => entriesOf(read(live.items) ?? [], getKey));
  const auto = props.rowHeight === "auto";
  const config = computed(() => {
    const maxWidth = live.maxWidth != null && live.maxWidth > 0 ? live.maxWidth : null;
    let breakpoints = resolveBreakpoints(live.columns ?? 4, live.minItemWidth, live.maxColumns ?? 4, live.gap);
    if (maxWidth) breakpoints = capBreakpoints(breakpoints, maxWidth);
    registerGridProperties(breakpoints.length);
    const rowHeight = live.rowHeight ?? 160;
    return { breakpoints, vars: gridVars(breakpoints), rowHeight: rowHeight === "auto" ? 160 : rowHeight, pack: (live.pack ?? "dense") as BentoPack, maxWidth };
  });
  const grid: GridRef = elementRef<HTMLDivElement>();

  if (auto) {
    // Native CSS grid (content-sized rows): spans resolve at the smallest breakpoint, clamped to its column count.
    return (
      <Shell
        props={props}
        kind="Bento"
        entries={entries}
        itemStyle={(key) => {
          const entry = entries().byKey.get(key);
          if (!entry) return undefined;
          const minColumns = Math.min(...config().breakpoints.map((b) => b.columns));
          const cs = Math.min(minColumns, Math.max(1, Math.floor(responsiveAt(colSpanOf(entry.item), 0, 1))));
          const rs = Math.max(1, Math.floor(responsiveAt(rowSpanOf(entry.item), 0, 1)));
          return Object.freeze({ "grid-column": `span ${cs}`, "grid-row": `span ${rs}` });
        }}
        gridStyle={() => {
          const { breakpoints, vars, pack } = config();
          const single = breakpoints.length === 1;
          return {
            ...vars,
            display: "grid",
            "grid-template-columns": single
              ? `repeat(${breakpoints[0]!.columns}, minmax(0, 1fr))`
              : "repeat(auto-fill, minmax(calc(var(--rv-mw) - 0.01px), 1fr))",
            "grid-auto-flow": pack === "dense" ? "row dense" : "row",
            "grid-auto-rows": "minmax(min-content, auto)",
            "column-gap": columnGapCss(breakpoints),
            "row-gap": breakpoints.every((bp) => bp.gap[1] === breakpoints[0]!.gap[1])
              ? `${num(breakpoints[0]!.gap[1])}px`
              : `max(${breakpoints.map((bp, b) => `calc(${num(bp.gap[1])}px - var(--rv-m${b}))`).join(", ")})`,
          };
        }}
        layout="grid"
        measure={null}
        maxWidth={() => config().maxWidth}
        grid={grid}
        rects={() => null}
        cellIndex={() => null}
        virtual={null}
      />
    );
  }

  const flip = flipper(
    grid,
    () => untrack(config).breakpoints,
    () => live.motion,
  );
  let last: { styles: Map<Key, Readonly<Record<string, string>>>; index: Map<Key, number>; geometries: Geometry[] } | null = null;
  const placement = computed(() => {
    const { breakpoints, rowHeight, pack } = config();
    const list = entries().list;
    const first = flip.capture(last ? { geometries: last.geometries, index: last.index } : null);
    const placements: BentoPlacement[] = breakpoints.map((bp) => {
      const cs = new Uint16Array(list.length);
      const rs = new Uint16Array(list.length);
      for (let i = 0; i < list.length; i++) {
        cs[i] = Math.max(1, Math.floor(responsiveAt(colSpanOf(list[i]!.item), bp.min, 1)));
        rs[i] = Math.max(1, Math.floor(responsiveAt(rowSpanOf(list[i]!.item), bp.min, 1)));
      }
      return packBento(cs, rs, bp.columns, pack);
    });
    const geometries = placements.map((p, b) => bentoGeometry(p, rowHeight, breakpoints[b]!.gap[0], breakpoints[b]!.gap[1]));
    const single = breakpoints.length === 1;
    const styles = new Map<Key, Readonly<Record<string, string>>>();
    const index = new Map<Key, number>();
    const cells = new Map<Key, { row: number; col: number }>();
    const keys: Key[] = [];
    for (let i = 0; i < list.length; i++) {
      const key = list[i]!.key;
      keys.push(key);
      index.set(key, i);
      const j = last?.index.get(key);
      const before = j == null ? undefined : last!.styles.get(key);
      if (before && last!.geometries.length === geometries.length && sameBoxes(last!.geometries, j!, geometries, i)) styles.set(key, before);
      else {
        const next = geometryStyle(geometries, i);
        styles.set(key, sameStyle(before, next) ? before! : next);
      }
      if (single) cells.set(key, { row: placements[0]!.row[i]! + 1, col: placements[0]!.col[i]! + 1 });
    }
    last = { styles, index, geometries };
    flip.play(first, geometries, keys, styles);
    return { styles, cells, height: geometryHeight(geometries), placements, geometries, pack };
  });
  const layoutRect = (key: Key, width: number): Rect | null => {
    const i = untrack(entries).byKey.get(key)?.index;
    if (i == null) return null;
    const [b, u] = unitAt(config().breakpoints, width);
    return rectsAt(placement().geometries[b]!, u)[i] ?? null;
  };
  return (
    <Shell
      props={props}
      kind="Bento"
      entries={entries}
      itemStyle={(key) => placement().styles.get(key)}
      gridStyle={() => ({ ...config().vars, position: "relative", height: placement().height })}
      layout={() => config().pack}
      measure={null}
      maxWidth={() => config().maxWidth}
      grid={grid}
      layoutRect={layoutRect}
      rects={() => null}
      cellIndex={(key) => placement().cells.get(key) ?? null}
      virtual={null}
    />
  );
}
