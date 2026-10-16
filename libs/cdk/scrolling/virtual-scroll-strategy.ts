// Ported from Angular Components (src/cdk/scrolling/virtual-scroll-strategy.ts), MIT, © Google LLC.
// Rivet: strategies are plain objects passed to the viewport (no VIRTUAL_SCROLL_STRATEGY token);
// they talk to the viewport through `VirtualScrollStrategyViewport`, the subset of
// CdkVirtualScrollViewport they use (implemented by the browser engine and by the server model).
import type { Stream } from "./emitter.ts";

/** A range of indices: `start` inclusive, `end` exclusive (Angular `ListRange`). */
export interface ListRange {
  start: number;
  end: number;
}

/** The viewport API a strategy drives. */
export interface VirtualScrollStrategyViewport {
  getDataLength(): number;
  getViewportSize(): number;
  getRenderedRange(): ListRange;
  setRenderedRange(range: ListRange): void;
  setTotalContentSize(size: number): void;
  setRenderedContentOffset(offset: number, to?: "to-start" | "to-end"): void;
  getOffsetToRenderedContentStart(): number | null;
  measureScrollOffset(from?: "top" | "left" | "right" | "bottom" | "start" | "end"): number;
  measureRenderedContentSize(): number;
  measureRangeSize(range: ListRange): number;
  scrollToOffset(offset: number, behavior?: ScrollBehavior): void;
}

/** A strategy that dictates which items should be rendered in the viewport. */
export interface VirtualScrollStrategy {
  /** Emits when the index of the first element visible in the viewport changes. */
  scrolledIndexChange: Stream<number>;
  /** Attaches this scroll strategy to a viewport. */
  attach(viewport: VirtualScrollStrategyViewport): void;
  /** Detaches this scroll strategy from the currently attached viewport. */
  detach(): void;
  /** Called when the viewport is scrolled (debounced using requestAnimationFrame). */
  onContentScrolled(): void;
  /** Called when the length of the data changes. */
  onDataLengthChanged(): void;
  /** Called when the range of items rendered in the DOM has changed. */
  onContentRendered(): void;
  /** Called when the offset of the rendered items changed. */
  onRenderedOffsetChanged(): void;
  /** Scroll to the offset for the given index. */
  scrollToIndex(index: number, behavior: ScrollBehavior): void;
}

/** Checks if the given ranges are equal. */
export const rangesEqual = (r1: ListRange, r2: ListRange): boolean => r1.start == r2.start && r1.end == r2.end;
