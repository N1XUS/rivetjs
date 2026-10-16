// Ported from react-resizable-panels (lib/global/mutable-state/types.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import type { Point } from "../../types.ts";
import type { HitRegion, Layout, RegisteredResizeAxis, RegisteredResizeItem, RegisteredSeparator } from "../types.ts";

export type InteractionInactive = {
  cursorFlags: 0;
  state: "inactive";
};

export type InteractionHover = {
  cursorFlags: 0;
  hitRegions: HitRegion[];
  state: "hover";
};

export type ResizePreview = {
  active: boolean;
  axis: RegisteredResizeAxis;
  key: string;
  offset: number;
  itemIndex: number;
  rect: DOMRect;
  separator?: RegisteredSeparator | undefined;
};

export type InteractionActive = {
  cursorFlags: number;
  didPointerMove: boolean;
  hitRegions: HitRegion[];
  initialLayoutMap: Map<RegisteredResizeAxis, Layout>;
  pointerDownAtPoint: Point;
  previewLayoutMap: Map<RegisteredResizeAxis, Layout>;
  previews: ResizePreview[];
  state: "active";
};

export type InteractionState = InteractionInactive | InteractionHover | InteractionActive;

export type SeparatorToItemsMap = Map<RegisteredSeparator, [primaryItem: RegisteredResizeItem, secondaryItem: RegisteredResizeItem]>;
