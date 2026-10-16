// Ported from Angular Components (src/cdk/scrolling/fixed-size-virtual-scroll.ts), MIT, © Google LLC.
// Rivet: `CdkFixedSizeVirtualScroll` directive inputs (itemSize 20, minBufferPx 100, maxBufferPx 200)
// are `createVirtualScroll` options; the strategy class is unchanged.
import { distinct, Emitter, type Stream } from "./emitter.ts";
import type { VirtualScrollStrategy, VirtualScrollStrategyViewport } from "./virtual-scroll-strategy.ts";

/** Virtual scrolling strategy for lists with items of known fixed size. */
export class FixedSizeVirtualScrollStrategy implements VirtualScrollStrategy {
  private readonly _scrolledIndexChange = new Emitter<number>();
  scrolledIndexChange: Stream<number> = distinct(this._scrolledIndexChange);
  private _viewport: VirtualScrollStrategyViewport | null = null;
  private _itemSize: number;
  private _minBufferPx: number;
  private _maxBufferPx: number;

  /**
   * @param itemSize The size of the items in the virtually scrolling list.
   * @param minBufferPx The minimum amount of buffer (in pixels) before needing to render more
   * @param maxBufferPx The amount of buffer (in pixels) to render when rendering more.
   */
  constructor(itemSize: number, minBufferPx: number, maxBufferPx: number) {
    this._itemSize = itemSize;
    this._minBufferPx = minBufferPx;
    this._maxBufferPx = maxBufferPx;
  }

  attach(viewport: VirtualScrollStrategyViewport) {
    this._viewport = viewport;
    this._updateTotalContentSize();
    this._updateRenderedRange();
  }

  detach() {
    this._scrolledIndexChange.complete();
    this._viewport = null;
  }

  /** Update the item size and buffer size. */
  updateItemAndBufferSize(itemSize: number, minBufferPx: number, maxBufferPx: number) {
    if (maxBufferPx < minBufferPx) throw Error("CDK virtual scroll: maxBufferPx must be greater than or equal to minBufferPx");
    this._itemSize = itemSize;
    this._minBufferPx = minBufferPx;
    this._maxBufferPx = maxBufferPx;
    this._updateTotalContentSize();
    this._updateRenderedRange();
  }

  onContentScrolled() {
    this._updateRenderedRange();
  }

  onDataLengthChanged() {
    this._updateTotalContentSize();
    this._updateRenderedRange();
  }

  onContentRendered() {
    /* no-op */
  }

  onRenderedOffsetChanged() {
    /* no-op */
  }

  scrollToIndex(index: number, behavior: ScrollBehavior): void {
    if (this._viewport) this._viewport.scrollToOffset(index * this._itemSize, behavior);
  }

  private _updateTotalContentSize() {
    if (!this._viewport) return;
    this._viewport.setTotalContentSize(this._viewport.getDataLength() * this._itemSize);
  }

  private _updateRenderedRange() {
    if (!this._viewport) return;
    const renderedRange = this._viewport.getRenderedRange();
    const newRange = { start: renderedRange.start, end: renderedRange.end };
    const viewportSize = this._viewport.getViewportSize();
    const dataLength = this._viewport.getDataLength();
    let scrollOffset = this._viewport.measureScrollOffset();
    // Prevent NaN as result when dividing by zero.
    let firstVisibleIndex = this._itemSize > 0 ? scrollOffset / this._itemSize : 0;

    // Scrolled to the bottom and the data shrank: recalculate the first visible index.
    if (newRange.end > dataLength) {
      const maxVisibleItems = Math.ceil(viewportSize / this._itemSize);
      const newVisibleIndex = Math.max(0, Math.min(firstVisibleIndex, dataLength - maxVisibleItems));
      // The first visible index changed: update the offset for the start / end buffers, and adjust
      // the range to cover the new position (bottom of the new list).
      if (firstVisibleIndex != newVisibleIndex) {
        firstVisibleIndex = newVisibleIndex;
        scrollOffset = newVisibleIndex * this._itemSize;
        newRange.start = Math.floor(firstVisibleIndex);
      }
      newRange.end = Math.max(0, Math.min(dataLength, newRange.start + maxVisibleItems));
    }

    const startBuffer = scrollOffset - newRange.start * this._itemSize;
    if (startBuffer < this._minBufferPx && newRange.start != 0) {
      const expandStart = Math.ceil((this._maxBufferPx - startBuffer) / this._itemSize);
      newRange.start = Math.max(0, newRange.start - expandStart);
      newRange.end = Math.min(dataLength, Math.ceil(firstVisibleIndex + (viewportSize + this._minBufferPx) / this._itemSize));
    } else {
      const endBuffer = newRange.end * this._itemSize - (scrollOffset + viewportSize);
      if (endBuffer < this._minBufferPx && newRange.end != dataLength) {
        const expandEnd = Math.ceil((this._maxBufferPx - endBuffer) / this._itemSize);
        if (expandEnd > 0) {
          newRange.end = Math.min(dataLength, newRange.end + expandEnd);
          newRange.start = Math.max(0, Math.floor(firstVisibleIndex - this._minBufferPx / this._itemSize));
        }
      }
    }

    this._viewport.setRenderedRange(newRange);
    this._viewport.setRenderedContentOffset(Math.round(this._itemSize * newRange.start));
    this._scrolledIndexChange.next(Math.floor(firstVisibleIndex));
  }
}
