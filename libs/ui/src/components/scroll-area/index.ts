// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no scroll area). Compound API in the HeroUI shape
// (`ScrollArea.Viewport`, `ScrollArea.Scrollbar`, …) mapping 1:1 to the Radix UI ScrollArea parts (@radix-ui/react-scroll-area
// 1.3.0, MIT, © 2022 WorkOS) of `@rivetjs/cdk/scroll-area`.
import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "./scroll-area.tsx";
import type { ScrollAreaCornerProps, ScrollAreaRootProps, ScrollAreaScrollbarProps, ScrollAreaThumbProps, ScrollAreaViewportProps } from "./scroll-area.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ScrollArea = Object.assign(ScrollAreaRoot, {
  Root: ScrollAreaRoot,
  Viewport: ScrollAreaViewport,
  Scrollbar: ScrollAreaScrollbar,
  Thumb: ScrollAreaThumb,
  Corner: ScrollAreaCorner,
});

export type ScrollArea = {
  Props: ScrollAreaRootProps;
  RootProps: ScrollAreaRootProps;
  ViewportProps: ScrollAreaViewportProps;
  ScrollbarProps: ScrollAreaScrollbarProps;
  ThumbProps: ScrollAreaThumbProps;
  CornerProps: ScrollAreaCornerProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Components
 * -----------------------------------------------------------------------------------------------*/
export { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport };

export type {
  ScrollAreaCornerProps,
  ScrollAreaRootProps,
  ScrollAreaRootProps as ScrollAreaProps,
  ScrollAreaScrollbarProps,
  ScrollAreaShadow,
  ScrollAreaThumbProps,
  ScrollAreaViewportProps,
} from "./scroll-area.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { scrollAreaVariants } from "../../../styles/src/components/scroll-area/index.ts";

export type { ScrollAreaVariants } from "../../../styles/src/components/scroll-area/index.ts";
