// Virtual scroll state: plain signals + options (serializable), shared by CdkVirtualScrollViewport and
// CdkVirtualForOf (explicit shared state instead of Angular DI). The server computes the first rendered range by running the real strategy against
// a measurement model (initial viewport size, estimated item sizes); the browser engine takes over on
// the first scroll / interaction (zero JS before it).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";
import { AutoSizeVirtualScrollStrategy } from "./auto-size-virtual-scroll.ts";
import { FixedSizeVirtualScrollStrategy } from "./fixed-size-virtual-scroll.ts";
import type { ListRange, VirtualScrollStrategy, VirtualScrollStrategyViewport } from "./virtual-scroll-strategy.ts";

export type { Orientation } from "../collections/types.ts";
import type { Orientation } from "../collections/types.ts";

export interface VirtualScrollOptions<T> {
  /** The data (Angular `cdkVirtualForOf`): a signal (live) or an array. */
  items: Signal<readonly T[]> | Signal<T[]> | readonly T[];
  /** Fixed item size in px (Angular `itemSize`, default 20). Ignored with `autosize`. */
  itemSize?: number;
  /** Auto-size strategy (cdk-experimental `autosize`) for items of unknown / varying size. */
  autosize?: boolean;
  /** Minimum buffer beyond the viewport in px (default 100). */
  minBufferPx?: number;
  /** Buffer to render when rendering more, in px (default 200). */
  maxBufferPx?: number;
  orientation?: Orientation;
  /** Keep rendered items in the DOM after they scroll out of view (default false). */
  appendOnly?: boolean;
  /**
   * Scroll container: `"self"` (default: the viewport scrolls), `"window"` (Angular `scrollWindow`)
   * or `"element"` (the nearest `CdkVirtualScrollableElement` ancestor; pass this state to it).
   */
  scrollable?: "self" | "window" | "element";
  /** Template cache size (Angular `cdkVirtualForTemplateCacheSize`): accepted for parity; rows are keyed. */
  templateCacheSize?: number;
  /** Viewport size in px assumed for the server-rendered range (default 0: just the buffer). */
  initialViewportSize?: number;
  id?: string;
}

export interface VirtualScrollState<T> {
  readonly id: string;
  readonly items: Signal<readonly T[]>;
  /** Rendered range (rows `[start, end)` are in the DOM). */
  readonly range: Signal<ListRange>;
  /** Total content size in px (spacer). */
  readonly totalSize: Signal<number>;
  /** Content wrapper transform (`translateY(<offset>px)`). */
  readonly transform: Signal<string>;
  /** Offset of the rendered content in px (last `setRenderedContentOffset` "to-start" value). */
  readonly offset: Signal<number>;
  readonly itemSize: number;
  readonly autosize: boolean;
  readonly minBufferPx: number;
  readonly maxBufferPx: number;
  readonly orientation: Orientation;
  readonly appendOnly: boolean;
  readonly scrollable: "self" | "window" | "element";
}

/**
 * Viewport callbacks: component props (`<CdkVirtualScrollViewport onScrolledIndexChange>`), not
 * state options — a `const` initialized with inline functions is re-created on the client from its
 * symbol (compiler rule for derived consts), which would detach the state's signals.
 */
export interface VirtualScrollCallbacks {
  /** Index of the first visible item (fixed strategy; Angular `scrolledIndexChange`). */
  onScrolledIndexChange?: (index: number) => void;
  /** Rendered range (Angular `renderedRangeStream` / CdkVirtualForOf `viewChange`). */
  onRenderedRangeChange?: (range: ListRange) => void;
}

/** The strategy for `state` (Angular: the `itemSize` / `autosize` directive's strategy). */
export function createStrategy(state: Pick<VirtualScrollState<unknown>, "autosize" | "itemSize" | "minBufferPx" | "maxBufferPx">): VirtualScrollStrategy {
  if (state.maxBufferPx < state.minBufferPx) throw Error("CDK virtual scroll: maxBufferPx must be greater than or equal to minBufferPx");
  return state.autosize
    ? new AutoSizeVirtualScrollStrategy(state.minBufferPx, state.maxBufferPx)
    : new FixedSizeVirtualScrollStrategy(state.itemSize, state.minBufferPx, state.maxBufferPx);
}

/** Content transform for an offset (Angular `setRenderedContentOffset`). */
export function contentTransform(orientation: Orientation, offset: number, rtl = false, toEnd = false): string {
  const axis = orientation == "horizontal" ? "X" : "Y";
  const axisDirection = orientation == "horizontal" && rtl ? -1 : 1;
  let transform = `translate${axis}(${Number(axisDirection * offset)}px)`;
  if (toEnd) transform += ` translate${axis}(-100%)`;
  return transform;
}

/**
 * Measurement model of a viewport that is not in a browser (server render): scroll offset 0, the
 * given viewport size, rendered items measured at the estimated size. Runs strategies unchanged.
 */
export class VirtualScrollModel implements VirtualScrollStrategyViewport {
  range: ListRange = { start: 0, end: 0 };
  total = 0;
  offset = 0;
  private dataLength: number;
  private viewportSize: number;
  private estimate: number;
  private appendOnly: boolean;
  private strategy?: VirtualScrollStrategy;
  constructor(dataLength: number, viewportSize: number, estimate: number, appendOnly = false) {
    this.dataLength = dataLength;
    this.viewportSize = viewportSize;
    this.estimate = estimate;
    this.appendOnly = appendOnly;
  }
  run(strategy: VirtualScrollStrategy): this {
    this.strategy = strategy;
    strategy.attach(this);
    strategy.onContentRendered();
    strategy.onRenderedOffsetChanged();
    strategy.detach();
    return this;
  }
  getDataLength = () => this.dataLength;
  getViewportSize = () => this.viewportSize;
  getRenderedRange = () => this.range;
  setRenderedRange(range: ListRange) {
    this.range = this.appendOnly ? { start: 0, end: Math.max(this.range.end, range.end) } : range;
  }
  setTotalContentSize(size: number) {
    this.total = size;
  }
  setRenderedContentOffset(offset: number) {
    this.offset = this.appendOnly ? 0 : offset;
  }
  getOffsetToRenderedContentStart = () => this.offset;
  measureScrollOffset = () => 0;
  measureRenderedContentSize = () => (this.range.end - this.range.start) * this.estimate;
  measureRangeSize = (range: ListRange) => Math.max(0, range.end - range.start) * this.estimate;
  scrollToOffset() {}
}

/** Virtual scroll state with the server-rendered (first) range computed. */
export function createVirtualScroll<T>(options: VirtualScrollOptions<T>): VirtualScrollState<T> {
  const items = (typeof options.items === "function" ? options.items : signal(options.items)) as Signal<readonly T[]>;
  const orientation = options.orientation ?? "vertical";
  const base = {
    autosize: !!options.autosize,
    itemSize: options.itemSize ?? 20,
    minBufferPx: options.minBufferPx ?? 100,
    maxBufferPx: options.maxBufferPx ?? 200,
  };
  const model = new VirtualScrollModel(untrack(items).length, options.initialViewportSize ?? 0, base.autosize ? 50 : base.itemSize, !!options.appendOnly).run(
    createStrategy(base),
  );
  return {
    id: options.id ?? createId(),
    items,
    range: signal(model.range),
    totalSize: signal(model.total),
    transform: signal(contentTransform(orientation, model.offset)),
    offset: signal(model.offset),
    ...base,
    orientation,
    appendOnly: !!options.appendOnly,
    scrollable: options.scrollable ?? "self",
  };
}
