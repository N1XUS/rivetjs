// Engine, layouts and DOM helpers of @rivetjs/cdk/virtualizer (no component: importable from plain .ts / node).
export { LOADER_KEY, initialWindow, projectViews, type LayoutInput, type VirtualView, type VirtualizerModel } from "./behaviour.ts";
export { Virtualizer as VirtualizerEngine, type VirtualizerOptions } from "./virtualizer-core.ts";
export { createVirtualizerState, type VirtualizerState, type VirtualizerStateOptions } from "./state.ts";
export { Point } from "./point.ts";
export { Size } from "./size.ts";
export { Rect, type RectCorner } from "./rect.ts";
export { LayoutInfo } from "./layout-info.ts";
export { Layout } from "./layout.ts";
export { ReusableView, RootView, ChildView } from "./reusable-view.ts";
export { OverscanManager } from "./overscan-manager.ts";
export {
  ScrollAnchorTracker,
  captureScrollAnchor,
  computeScrollAnchorTarget,
  getEdgeSnapTarget,
  isNearEdge,
  resolveScrollAdjustment,
  type ScrollAnchor,
  type ScrollAnchorInfo,
} from "./scroll-anchor.ts";
export { isSetEqual } from "./utils.ts";
export { ListLayout, type ListLayoutOptions, type LayoutNode } from "./list-layout.ts";
export { GridLayout, type GridLayoutOptions } from "./grid-layout.ts";
export { WaterfallLayout, type WaterfallLayoutOptions } from "./waterfall-layout.ts";
export { TableLayout, type TableLayoutProps } from "./table-layout.ts";
export { TableColumnLayout, calculateColumnSizes, type ColumnSize, type TableColumnLayoutOptions } from "./table-column-layout.ts";
export { createTableCollection, type GridNode, type TableCollection, type TableColumn } from "./table-collection.ts";
export {
  ListCollection,
  createCollection,
  buildNodes,
  loaderNode,
  getChildNodes,
  type Collection,
  type CollectionOptions,
  type Node,
} from "./collection.ts";
export {
  createScrollView,
  getRTLOffsetType,
  getScrollLeft,
  setScrollLeft,
  layoutInfoToStyle,
  getSize,
  isElementVisible,
  measureItem,
  type ScrollView,
  type ScrollViewOptions,
  type RTLOffsetType,
} from "./dom.ts";
export type {
  InvalidationContext,
  VirtualizerDelegate,
  VirtualizerRenderOptions,
  DropTarget,
  DropPosition,
  ItemDropTarget,
  RootDropTarget,
  DropTargetDelegate,
  LayoutDelegate,
  Orientation,
  Direction,
} from "./types.ts";
