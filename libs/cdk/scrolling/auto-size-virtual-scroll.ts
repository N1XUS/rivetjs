// Ported from Angular Components (src/cdk-experimental/scrolling/auto-size-virtual-scroll.ts), MIT,
// © Google LLC. Rivet: `CdkAutoSizeVirtualScroll` inputs (minBufferPx 100, maxBufferPx 200) are
// `createVirtualScroll({ autosize: true })` options; strategy logic unchanged.
import { stream, type Stream } from "./emitter.ts";
import type { ListRange, VirtualScrollStrategy, VirtualScrollStrategyViewport } from "./virtual-scroll-strategy.ts";

/** Tracks the size of items that have been seen and estimates the average item size. */
export class ItemSizeAverager {
  /** The total amount of weight behind the current average. */
  private _totalWeight = 0;
  private _averageItemSize: number;
  private _defaultItemSize: number;

  /** @param defaultItemSize The default size to use for items when no data is available. */
  constructor(defaultItemSize = 50) {
    this._defaultItemSize = defaultItemSize;
    this._averageItemSize = defaultItemSize;
  }

  getAverageItemSize(): number {
    return this._averageItemSize;
  }

  /** Adds a measurement sample: `size` pixels for `range`. */
  addSample(range: ListRange, size: number) {
    const newTotalWeight = this._totalWeight + range.end - range.start;
    if (newTotalWeight) {
      const newAverageItemSize = (size + this._averageItemSize * this._totalWeight) / newTotalWeight;
      if (newAverageItemSize) {
        this._averageItemSize = newAverageItemSize;
        this._totalWeight = newTotalWeight;
      }
    }
  }

  reset() {
    this._averageItemSize = this._defaultItemSize;
    this._totalWeight = 0;
  }
}

/** Virtual scrolling strategy for lists with items of unknown or dynamic size. */
export class AutoSizeVirtualScrollStrategy implements VirtualScrollStrategy {
  scrolledIndexChange: Stream<number> = stream<number>(() => {
    throw Error("cdk-virtual-scroll: scrolledIndexChange is currently not supported for the autosize scroll strategy");
  });
  private _viewport: VirtualScrollStrategyViewport | null = null;
  private _minBufferPx: number;
  private _maxBufferPx: number;
  private _averager: ItemSizeAverager;
  private _lastScrollOffset!: number;
  private _lastRenderedContentSize!: number;
  private _lastRenderedContentOffset!: number;
  /** Consecutive cycles where removing extra items failed (estimate too aggressive). */
  private _removalFailures = 0;

  /**
   * @param minBufferPx Minimum buffer beyond the viewport (px); below it more items render.
   * @param maxBufferPx Buffer to shoot for when rendering new items (px).
   * @param averager Estimates the size of unseen items.
   */
  constructor(minBufferPx: number, maxBufferPx: number, averager = new ItemSizeAverager()) {
    this._minBufferPx = minBufferPx;
    this._maxBufferPx = maxBufferPx;
    this._averager = averager;
  }

  attach(viewport: VirtualScrollStrategyViewport) {
    this._averager.reset();
    this._viewport = viewport;
    this._renderContentForCurrentOffset();
  }

  detach() {
    this._viewport = null;
  }

  onContentScrolled() {
    if (this._viewport) this._updateRenderedContentAfterScroll();
  }

  onDataLengthChanged() {
    if (this._viewport) {
      this._renderContentForCurrentOffset();
      this._checkRenderedContentSize();
    }
  }

  onContentRendered() {
    if (this._viewport) this._checkRenderedContentSize();
  }

  onRenderedOffsetChanged() {
    if (this._viewport) this._checkRenderedContentOffset();
  }

  scrollToIndex(): void {
    throw Error("cdk-virtual-scroll: scrollToIndex is currently not supported for the autosize scroll strategy");
  }

  /** Update the buffer parameters. */
  updateBufferSize(minBufferPx: number, maxBufferPx: number) {
    if (maxBufferPx < minBufferPx) throw Error("CDK virtual scroll: maxBufferPx must be greater than or equal to minBufferPx");
    this._minBufferPx = minBufferPx;
    this._maxBufferPx = maxBufferPx;
  }

  private _updateRenderedContentAfterScroll() {
    const viewport = this._viewport!;
    const scrollOffset = viewport.measureScrollOffset();
    let scrollDelta = scrollOffset - this._lastScrollOffset;
    let scrollMagnitude = Math.abs(scrollDelta);
    const renderedRange = viewport.getRenderedRange();

    // Scrolling toward the top: the predicted size of the content above and the actual scrollable
    // space may differ; correct the difference a little on each scroll event.
    let offsetCorrection = 0;
    if (scrollDelta < 0) {
      const predictedOffset = renderedRange.start * this._averager.getAverageItemSize();
      const offsetDifference = predictedOffset - this._lastRenderedContentOffset;
      offsetCorrection = Math.round(offsetDifference * Math.max(0, Math.min(1, scrollMagnitude / (scrollOffset + scrollMagnitude))));
      scrollDelta = scrollDelta - offsetCorrection;
      scrollMagnitude = Math.abs(scrollDelta);
    }

    const startBuffer = this._lastScrollOffset - this._lastRenderedContentOffset;
    const endBuffer = this._lastRenderedContentOffset + this._lastRenderedContentSize - (this._lastScrollOffset + viewport.getViewportSize());
    // Unfilled space on the side the user scrolls toward.
    const underscan = scrollMagnitude + this._minBufferPx - (scrollDelta < 0 ? startBuffer : endBuffer);

    if (underscan > 0) {
      // Larger jump than the viewport: the user won't notice a discontinuity, jump to the estimate.
      if (scrollMagnitude >= viewport.getViewportSize()) this._renderContentForCurrentOffset();
      else {
        // Fill enough for a `maxBufferPx` buffer (wiggle room for a wrong estimate).
        const addItems = Math.max(0, Math.ceil((underscan - this._minBufferPx + this._maxBufferPx) / this._averager.getAverageItemSize()));
        // Extra filled space on the side the user scrolls away from.
        const overscan = (scrollDelta < 0 ? endBuffer : startBuffer) - this._minBufferPx + scrollMagnitude;
        // Less aggressive after failed removals.
        const unboundedRemoveItems = Math.floor(overscan / this._averager.getAverageItemSize() / (this._removalFailures + 1));
        const removeItems = Math.min(renderedRange.end - renderedRange.start, Math.max(0, unboundedRemoveItems));

        const range = this._expandRange(renderedRange, scrollDelta < 0 ? addItems : 0, scrollDelta > 0 ? addItems : 0);
        if (scrollDelta < 0) range.end = Math.max(range.start + 1, range.end - removeItems);
        else range.start = Math.min(range.end - 1, range.start + removeItems);

        // Offset from whichever end doesn't need the newly added items measured.
        let contentOffset: number;
        let contentOffsetTo: "to-start" | "to-end";
        if (scrollDelta < 0) {
          const removedSize = viewport.measureRangeSize({ start: range.end, end: renderedRange.end });
          if (removedSize <= overscan) {
            contentOffset = this._lastRenderedContentOffset + this._lastRenderedContentSize - removedSize;
            this._removalFailures = 0;
          } else {
            // Removal larger than the overscan can absorb: undo it, be less aggressive next time.
            range.end = renderedRange.end;
            contentOffset = this._lastRenderedContentOffset + this._lastRenderedContentSize;
            this._removalFailures++;
          }
          contentOffsetTo = "to-end";
        } else {
          const removedSize = viewport.measureRangeSize({ start: renderedRange.start, end: range.start });
          if (removedSize <= overscan) {
            contentOffset = this._lastRenderedContentOffset + removedSize;
            this._removalFailures = 0;
          } else {
            range.start = renderedRange.start;
            contentOffset = this._lastRenderedContentOffset;
            this._removalFailures++;
          }
          contentOffsetTo = "to-start";
        }
        viewport.setRenderedRange(range);
        viewport.setRenderedContentOffset(contentOffset + offsetCorrection, contentOffsetTo);
      }
    } else if (offsetCorrection) {
      // Range unchanged, but simulate scrolling slightly slower / faster than the user did.
      viewport.setRenderedContentOffset(this._lastRenderedContentOffset + offsetCorrection);
    }
    this._lastScrollOffset = scrollOffset;
  }

  /** Measure the rendered content, update the size estimate and the total content size. */
  private _checkRenderedContentSize() {
    const viewport = this._viewport!;
    this._lastRenderedContentSize = viewport.measureRenderedContentSize();
    this._averager.addSample(viewport.getRenderedRange(), this._lastRenderedContentSize);
    this._updateTotalContentSize(this._lastRenderedContentSize);
  }

  private _checkRenderedContentOffset() {
    this._lastRenderedContentOffset = this._viewport!.getOffsetToRenderedContentStart()!;
  }

  /** Render what the estimate says belongs at the current scroll offset. */
  private _renderContentForCurrentOffset() {
    const viewport = this._viewport!;
    const scrollOffset = viewport.measureScrollOffset();
    this._lastScrollOffset = scrollOffset;
    this._removalFailures = 0;
    const itemSize = this._averager.getAverageItemSize();
    const firstVisibleIndex = Math.min(viewport.getDataLength() - 1, Math.floor(scrollOffset / itemSize));
    const bufferSize = Math.ceil(this._maxBufferPx / itemSize);
    const range = this._expandRange(this._getVisibleRangeForIndex(firstVisibleIndex), bufferSize, bufferSize);
    viewport.setRenderedRange(range);
    viewport.setRenderedContentOffset(itemSize * range.start);
  }

  /** Visible range starting at `startIndex`, backed up near the end so it fills the viewport. */
  private _getVisibleRangeForIndex(startIndex: number): ListRange {
    const viewport = this._viewport!;
    const range: ListRange = { start: startIndex, end: startIndex + Math.ceil(viewport.getViewportSize() / this._averager.getAverageItemSize()) };
    const extra = range.end - viewport.getDataLength();
    if (extra > 0) range.start = Math.max(0, range.start - extra);
    return range;
  }

  private _expandRange(range: ListRange, expandStart: number, expandEnd: number): ListRange {
    const viewport = this._viewport!;
    return { start: Math.max(0, range.start - expandStart), end: Math.min(viewport.getDataLength(), range.end + expandEnd) };
  }

  private _updateTotalContentSize(renderedContentSize: number) {
    const viewport = this._viewport!;
    const renderedRange = viewport.getRenderedRange();
    viewport.setTotalContentSize(renderedContentSize + (viewport.getDataLength() - (renderedRange.end - renderedRange.start)) * this._averager.getAverageItemSize());
  }
}
