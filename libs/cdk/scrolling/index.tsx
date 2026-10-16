// @rivetjs/cdk/scrolling — Angular CDK scrolling (virtual scroll, ScrollDispatcher, ViewportRuler,
// CdkScrollable) ported to Rivet. Styles: `@rivetjs/cdk/scrolling.css`.
export { Emitter, auditTime, distinct, filter, stream, type Stream, type Subscription, type Observer } from "./emitter.ts";
export { RtlScrollAxisType, getRtlScrollAxisType, supportsScrollBehavior, _setRtlScrollAxisType } from "./rtl.ts";
export { ViewportRuler, viewportRuler, DEFAULT_RESIZE_TIME, type ViewportScrollPosition } from "./viewport-ruler.ts";
export { ScrollDispatcher, scrollDispatcher, DEFAULT_SCROLL_TIME, type ScrollDispatcherTarget } from "./scroll-dispatcher.ts";
export {
  CdkScrollable,
  CdkVirtualScrollable,
  CdkVirtualScrollableElement as CdkVirtualScrollableElementRef,
  CdkVirtualScrollableWindow,
  type ExtendedScrollToOptions,
  type ScrollableOptions,
  type ScrollEdge,
} from "./scrollable.ts";
export { rangesEqual, type ListRange, type VirtualScrollStrategy, type VirtualScrollStrategyViewport } from "./virtual-scroll-strategy.ts";
export { FixedSizeVirtualScrollStrategy } from "./fixed-size-virtual-scroll.ts";
export { AutoSizeVirtualScrollStrategy, ItemSizeAverager } from "./auto-size-virtual-scroll.ts";
export { createVirtualScroll, createStrategy, contentTransform, VirtualScrollModel, type VirtualScrollOptions, type VirtualScrollState, type VirtualScrollCallbacks, type Orientation } from "./state.ts";
export { VirtualScrollViewport, virtualScrollViewport, scrollToIndex, scrollToOffset } from "./virtual-scroll-viewport.ts";
export { CdkVirtualScrollViewport, CdkVirtualForOf, CdkVirtualScrollableElement, type CdkVirtualForOfContext, type CdkVirtualForOfProps, type CdkVirtualScrollViewportProps } from "./viewport.tsx";
