// Ported from Angular Components (src/cdk/scrolling/virtual-scroll-viewport.ts + the measuring half
// of virtual-for-of.ts), MIT, © Google LLC.
// Rivet: the browser engine behind <CdkVirtualScrollViewport>, created lazily on the first scroll /
// interaction (`virtualScrollViewport(state)`), never on the server. Rendering goes through the
// state signals (range → keyed `For` rows, totalSize → spacer, transform → content wrapper); Angular's
// change-detection loop (`_markChangeDetectionNeeded` → microtask → apply → after-render callbacks)
// is kept as microtask steps so strategies see the same ordering.
import { batch, createRoot, effect, untrack } from "@rivetjs/reactivity";
import { auditTime, Emitter, type Stream, type Subscription } from "./emitter.ts";
import { CdkVirtualScrollable, CdkVirtualScrollableElement, CdkVirtualScrollableWindow, type ExtendedScrollToOptions, type ScrollEdge } from "./scrollable.ts";
import { contentTransform, createStrategy, type VirtualScrollCallbacks, type VirtualScrollState } from "./state.ts";
import { viewportRuler } from "./viewport-ruler.ts";
import { rangesEqual, type ListRange, type VirtualScrollStrategy, type VirtualScrollStrategyViewport } from "./virtual-scroll-strategy.ts";

const engines = new WeakMap<object, VirtualScrollViewport<unknown>>();

/** Offset of a node's start / end edge along the orientation. */
function getOffset(orientation: "horizontal" | "vertical", direction: "start" | "end", node: Node): number {
  const el = node as Element;
  if (!el.getBoundingClientRect) return 0;
  const rect = el.getBoundingClientRect();
  if (orientation === "horizontal") return direction === "start" ? rect.left : rect.right;
  return direction === "start" ? rect.top : rect.bottom;
}

/** The engine of a virtual scroll viewport element (Angular `CdkVirtualScrollViewport` instance). */
export class VirtualScrollViewport<T = unknown> extends CdkVirtualScrollable implements VirtualScrollStrategyViewport {
  readonly state: VirtualScrollState<T>;
  /** Updated by every viewport interaction (the engine may have been created by an API call first). */
  callbacks: VirtualScrollCallbacks;
  scrollable: CdkVirtualScrollable;
  private _scrollStrategy: VirtualScrollStrategy;
  private readonly _renderedRangeSubject = new Emitter<ListRange>();
  /** Emits when the rendered range changes. */
  readonly renderedRangeStream: Stream<ListRange> = this._renderedRangeSubject;
  private readonly _renderedContentOffsetSubject = new Emitter<number | null>();
  /** Emits the offset from the start of the viewport to the start of the rendered data (px). */
  readonly renderedContentOffset: Stream<number | null> = this._renderedContentOffsetSubject;
  private _totalContentSize: number;
  private _renderedContentTransform: string | undefined;
  private _renderedRange: ListRange;
  private _dataLength: number;
  private _viewportSize = 0;
  private _renderedContentOffset: number;
  private _renderedContentOffsetNeedsRewrite = false;
  private _changeDetectionNeeded = false;
  private _runAfterChangeDetection: Function[] = [];
  private _subscriptions: Subscription[] = [];
  private _disposeData: (() => void) | undefined;
  private _isDestroyed = false;
  private _attached = false;
  /** Rivet: the strategy's latest scrolled index, and the last one `callbacks` got (see `deliverScrolledIndex`). */
  private _scrolledIndex: number | undefined;
  private _deliveredIndex: number | undefined;

  constructor(state: VirtualScrollState<T>, element: HTMLElement, callbacks: VirtualScrollCallbacks = {}) {
    super(element);
    this.state = state;
    this.callbacks = callbacks;
    this._scrollStrategy = createStrategy(state);
    // Start from what the server rendered.
    this._renderedRange = untrack(state.range);
    this._totalContentSize = untrack(state.totalSize);
    this._renderedContentOffset = untrack(state.offset);
    this._renderedContentTransform = untrack(state.transform);
    this._dataLength = untrack(state.items).length;
    const doc = element.ownerDocument;
    if (state.scrollable === "window") this.scrollable = new CdkVirtualScrollableWindow(doc);
    else if (state.scrollable === "element") {
      const host = element.parentElement?.closest<HTMLElement>("[data-rv-virtual-scrollable]");
      this.scrollable = host ? new CdkVirtualScrollableElement(host) : this;
    } else this.scrollable = this;
    if (this.scrollable === this) element.classList.add("cdk-virtual-scrollable");
    this._subscriptions.push(viewportRuler(doc).change().subscribe(() => this.checkViewportSize()));
  }

  get orientation(): "horizontal" | "vertical" {
    return this.state.orientation;
  }

  get appendOnly(): boolean {
    return this.state.appendOnly;
  }

  /** The strategy (Angular: the `itemSize` / `autosize` directive's `_scrollStrategy`). */
  get scrollStrategy(): VirtualScrollStrategy {
    return this._scrollStrategy;
  }

  /**
   * Rivet: hand `onScrolledIndexChange` the latest scrolled index it has not seen. Angular binds the output with the
   * component; here the callbacks arrive with the first viewport event, and an API call (`scrollToIndex` from a
   * button) may create the engine before that: its scroll's index would otherwise be lost (scrolledIndexChange is
   * distinct, so it never fires again for that index).
   */
  deliverScrolledIndex(): void {
    const index = this._scrolledIndex,
      callback = this.callbacks.onScrolledIndexChange;
    if (!callback || index === undefined || index === this._deliveredIndex) return;
    this._deliveredIndex = index;
    callback(index);
  }

  /** Emits when the index of the first element visible in the viewport changes. */
  get scrolledIndexChange(): Stream<number> {
    return this._scrollStrategy.scrolledIndexChange;
  }

  /** Measure, attach the strategy, follow scroll and data changes (Angular ngOnInit + attach(forOf)). */
  override init(): this {
    if (this._attached) return this;
    this._attached = true;
    if (this.scrollable === this) super.init();
    else this.scrollable.init();
    // Angular subscribes lazily (only with listeners): here, only for the fixed strategy, whose
    // scrolledIndexChange is cheap (autosize throws on subscribe).
    if (!this.state.autosize)
      this._subscriptions.push(
        this._scrollStrategy.scrolledIndexChange.subscribe((index) => {
          this._scrolledIndex = index;
          queueMicrotask(() => this.deliverScrolledIndex());
        }),
      );
    this._measureViewportSize();
    this._scrollStrategy.attach(this);
    // Collect scroll events of one frame into one layout check; start with a fake scroll so the
    // initial position (the scroll that woke us) is handled.
    this._scrollStrategy.onContentScrolled();
    this._subscriptions.push(auditTime(this.scrollable.elementScrolled(), 0, true).subscribe(() => this._scrollStrategy.onContentScrolled()));
    // Data: keep the length in sync (Angular: forOf dataStream subscription).
    this._disposeData = createRoot((dispose) => {
      effect(() => {
        const length = this.state.items().length;
        untrack(() => {
          if (length !== this._dataLength) {
            this._dataLength = length;
            this._scrollStrategy.onDataLengthChanged();
          }
          this._doChangeDetection();
        });
      });
      return dispose;
    }).value;
    this._markChangeDetectionNeeded();
    return this;
  }

  override destroy(): void {
    this._scrollStrategy.detach();
    this._renderedRangeSubject.complete();
    this._subscriptions.forEach((s) => s.unsubscribe());
    this._disposeData?.();
    this._isDestroyed = true;
    if (this.scrollable !== this) this.scrollable.destroy();
    super.destroy();
    engines.delete(this.state);
  }

  getDataLength(): number {
    return this._dataLength;
  }

  getViewportSize(): number {
    return this._viewportSize;
  }

  getRenderedRange(): ListRange {
    return this._renderedRange;
  }

  measureBoundingClientRectWithScrollOffset(from: "left" | "top" | "right" | "bottom"): number {
    return this.getElementRef().nativeElement.getBoundingClientRect()[from];
  }

  /** Sets the total size of all content (px), including content that is not rendered. */
  setTotalContentSize(size: number) {
    if (this._totalContentSize !== size) {
      this._totalContentSize = size;
      this.state.totalSize.set(size);
      this._markChangeDetectionNeeded();
    }
  }

  /** Sets the currently rendered range of indices. */
  setRenderedRange(range: ListRange) {
    if (!rangesEqual(this._renderedRange, range)) {
      if (this.appendOnly) range = { start: 0, end: Math.max(this._renderedRange.end, range.end) };
      this._renderedRange = range;
      this._renderedRangeSubject.next(range);
      this.state.range.set(range);
      const onRange = this.callbacks.onRenderedRangeChange;
      if (onRange) onRange(range);
      this._markChangeDetectionNeeded(() => this._scrollStrategy.onContentRendered());
    }
  }

  /** Offset from the start of the viewport to the start of the rendered data (px). */
  getOffsetToRenderedContentStart(): number | null {
    return this._renderedContentOffsetNeedsRewrite ? null : this._renderedContentOffset;
  }

  /** Sets the offset from the start of the viewport to the start or end of the rendered data (px). */
  setRenderedContentOffset(offset: number, to: "to-start" | "to-end" = "to-start") {
    // In appendOnly, we always start from the top.
    offset = this.appendOnly && to === "to-start" ? 0 : offset;
    const transform = contentTransform(this.orientation, offset, this.dir.value == "rtl", to === "to-end");
    this._renderedContentOffset = offset;
    // "to-end" is rewritten as a "to-start" offset on the next render cycle (else content would
    // grow in the wrong direction).
    if (to === "to-end") this._renderedContentOffsetNeedsRewrite = true;
    if (this._renderedContentTransform != transform) {
      this._renderedContentTransform = transform;
      this._markChangeDetectionNeeded(() => {
        if (this._renderedContentOffsetNeedsRewrite) {
          this._renderedContentOffset -= this.measureRenderedContentSize();
          this._renderedContentOffsetNeedsRewrite = false;
          this.setRenderedContentOffset(this._renderedContentOffset);
        } else this._scrollStrategy.onRenderedOffsetChanged();
      });
    }
  }

  /** Scrolls to `offset` from the start (a fictional `scrollRight` in horizontal RTL). */
  scrollToOffset(offset: number, behavior: ScrollBehavior = "auto") {
    const options: ExtendedScrollToOptions = { behavior };
    if (this.orientation === "horizontal") options.start = offset;
    else options.top = offset;
    this.scrollable.scrollTo(options);
  }

  /** Scrolls to the offset of the given index. */
  scrollToIndex(index: number, behavior: ScrollBehavior = "auto") {
    this._scrollStrategy.scrollToIndex(index, behavior);
  }

  /** Scroll offset from the start of the scrollable (default `top` / `start`), minus the viewport offset. */
  override measureScrollOffset(from?: ScrollEdge): number {
    const edge = from ?? (this.orientation === "horizontal" ? "start" : "top");
    const raw = this.scrollable === this ? super.measureScrollOffset(edge) : this.scrollable.measureScrollOffset(edge);
    return Math.max(0, raw - this.measureViewportOffset());
  }

  /** Offset of the viewport from the scrolling container. */
  measureViewportOffset(from?: ScrollEdge): number {
    let fromRect: "left" | "top" | "right" | "bottom";
    const isRtl = this.dir.value == "rtl";
    if (from == "start") fromRect = isRtl ? "right" : "left";
    else if (from == "end") fromRect = isRtl ? "left" : "right";
    else if (from) fromRect = from;
    else fromRect = this.orientation === "horizontal" ? "left" : "top";
    const scrollerClientRect = this.scrollable.measureBoundingClientRectWithScrollOffset(fromRect);
    const viewportClientRect = this.elementRef.nativeElement.getBoundingClientRect()[fromRect];
    return viewportClientRect - scrollerClientRect;
  }

  /** The content wrapper element. */
  get contentWrapper(): HTMLElement {
    const el = this.elementRef.nativeElement;
    return (el.querySelector(":scope > .cdk-virtual-scroll-content-wrapper") as HTMLElement) ?? el;
  }

  /** Measure the combined size of all rendered items. */
  measureRenderedContentSize(): number {
    const contentEl = this.contentWrapper;
    return this.orientation === "horizontal" ? contentEl.offsetWidth : contentEl.offsetHeight;
  }

  /** Root nodes of rendered rows, grouped per row (CdkVirtualForOf views). */
  private _rowNodes(): Element[][] {
    const marker = this.contentWrapper.querySelector(`template[data-rv-vfor="${this.state.id}"]`);
    const nodes: Element[] = [];
    for (let el = marker?.nextElementSibling; el && !el.matches("template[data-rv-vfor-end]"); el = el.nextElementSibling) nodes.push(el);
    const count = this._renderedRange.end - this._renderedRange.start;
    if (!count) return [];
    const per = Math.max(1, Math.round(nodes.length / count));
    const rows: Element[][] = [];
    for (let i = 0; i < nodes.length; i += per) rows.push(nodes.slice(i, i + per));
    return rows;
  }

  /** Combined size of the given (rendered) range. Throws if part of it is not rendered. */
  measureRangeSize(range: ListRange): number {
    if (range.start >= range.end) return 0;
    if (range.start < this._renderedRange.start || range.end > this._renderedRange.end) throw Error(`Error: attempted to measure an item that isn't rendered.`);
    const rows = this._rowNodes();
    const renderedStartIndex = range.start - this._renderedRange.start;
    const rangeLen = range.end - range.start;
    let firstNode: Element | undefined, lastNode: Element | undefined;
    for (let i = 0; i < rangeLen; i++) {
      const view = rows[i + renderedStartIndex];
      if (view?.length) {
        firstNode = lastNode = view[0];
        break;
      }
    }
    for (let i = rangeLen - 1; i > -1; i--) {
      const view = rows[i + renderedStartIndex];
      if (view?.length) {
        lastNode = view[view.length - 1];
        break;
      }
    }
    return firstNode && lastNode ? getOffset(this.orientation, "end", lastNode) - getOffset(this.orientation, "start", firstNode) : 0;
  }

  /** Update the viewport dimensions and re-render. */
  checkViewportSize() {
    this._measureViewportSize();
    this._scrollStrategy.onDataLengthChanged();
  }

  private _measureViewportSize() {
    this._viewportSize = this.scrollable.measureViewportSize(this.orientation);
  }

  /** Queue up a render pass (Angular change detection). */
  private _markChangeDetectionNeeded(runAfter?: Function) {
    if (runAfter) this._runAfterChangeDetection.push(runAfter);
    if (this._changeDetectionNeeded) return;
    this._changeDetectionNeeded = true;
    queueMicrotask(() => this._doChangeDetection());
  }

  /** Apply the transform, then run the after-render callbacks. */
  private _doChangeDetection() {
    if (this._isDestroyed) return;
    batch(() => {
      if (this._renderedContentTransform !== undefined) this.state.transform.set(this._renderedContentTransform);
      if (!this._renderedContentOffsetNeedsRewrite) this.state.offset.set(this._renderedContentOffset);
    });
    this._renderedContentOffsetSubject.next(this.getOffsetToRenderedContentStart());
    queueMicrotask(() => {
      this._changeDetectionNeeded = false;
      const runAfterChangeDetection = this._runAfterChangeDetection;
      this._runAfterChangeDetection = [];
      for (const fn of runAfterChangeDetection) fn();
    });
  }
}

/**
 * The engine for `state` (created and attached on first call, in the browser). `element` defaults to
 * the viewport element (`id = state.id`).
 */
export function virtualScrollViewport<T>(
  state: VirtualScrollState<T>,
  element?: HTMLElement | null,
  callbacks?: VirtualScrollCallbacks,
): VirtualScrollViewport<T> | undefined {
  let engine = engines.get(state) as VirtualScrollViewport<T> | undefined;
  if (engine) {
    if (callbacks && callbacks !== engine.callbacks) {
      engine.callbacks = callbacks;
      engine.deliverScrolledIndex();
    }
    return engine;
  }
  if (typeof document !== "object") return undefined;
  const el = element ?? document.getElementById(state.id);
  if (!el) return undefined;
  engine = new VirtualScrollViewport(state, el, callbacks);
  // Devtools / tests: the engine of a viewport element.
  (el as HTMLElement & { __rivetVirtualScroll?: unknown }).__rivetVirtualScroll = engine;
  engines.set(state, engine as VirtualScrollViewport<unknown>);
  return engine.init();
}

/** Scroll `state`'s viewport to `index` (Angular `viewport.scrollToIndex`). */
export function scrollToIndex<T>(state: VirtualScrollState<T>, index: number, behavior?: ScrollBehavior): void {
  virtualScrollViewport(state)?.scrollToIndex(index, behavior);
}

/** Scroll `state`'s viewport to `offset` px from the start (Angular `viewport.scrollToOffset`). */
export function scrollToOffset<T>(state: VirtualScrollState<T>, offset: number, behavior?: ScrollBehavior): void {
  virtualScrollViewport(state)?.scrollToOffset(offset, behavior);
}
