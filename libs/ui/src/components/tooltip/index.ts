// Ported from HeroUI v3.2.6 packages/react/src/components/tooltip/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types (`TooltipTriggerDivProps` for the generic trigger); `@heroui/styles` →
// vendored `styles/`.
import { TooltipArrow, TooltipContent, TooltipRoot, TooltipTrigger } from "./tooltip.tsx";
import type { TooltipArrowProps, TooltipContentProps, TooltipRootProps, TooltipTriggerDivProps } from "./tooltip.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Tooltip = Object.assign(TooltipRoot, {
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
  Arrow: TooltipArrow,
});

export type Tooltip = {
  Props: TooltipRootProps;
  RootProps: TooltipRootProps;
  TriggerProps: TooltipTriggerDivProps;
  ContentProps: TooltipContentProps;
  ArrowProps: TooltipArrowProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { TooltipRoot, TooltipTrigger, TooltipContent, TooltipArrow };

export type { TooltipRootProps, TooltipRootProps as TooltipProps, TooltipArrowProps, TooltipContentProps, TooltipTriggerProps } from "./tooltip.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { tooltipVariants } from "../../../styles/src/components/tooltip/index.ts";

export type { TooltipVariants } from "../../../styles/src/components/tooltip/index.ts";
