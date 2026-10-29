// Rivet addition (no HeroUI v3.2.6 counterpart): segmented control; feature set scoped from public docs of commercial UI kits, independent
// implementation (see `segment.tsx`).
import { SegmentItem, SegmentRoot, SegmentSeparator } from "./segment.tsx";
import type { SegmentItemProps, SegmentRootProps, SegmentSeparatorSpanProps } from "./segment.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Segment = Object.assign(SegmentRoot, {
  Root: SegmentRoot,
  Item: SegmentItem,
  Separator: SegmentSeparator,
});

export type Segment = {
  Props: SegmentRootProps;
  RootProps: SegmentRootProps;
  ItemProps: SegmentItemProps;
  SeparatorProps: SegmentSeparatorSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SegmentRoot, SegmentItem, SegmentSeparator, SegmentContext } from "./segment.tsx";
export type {
  SegmentRootProps,
  SegmentRootProps as SegmentProps,
  SegmentItemProps,
  SegmentItemRenderProps,
  SegmentSeparatorProps,
  SegmentSeparatorSpanProps,
} from "./segment.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { segmentVariants } from "../../../styles/src/components/segment/index.ts";

export type { SegmentVariants } from "../../../styles/src/components/segment/index.ts";
