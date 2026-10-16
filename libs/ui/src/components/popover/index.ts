// Ported from HeroUI v3.2.6 packages/react/src/components/popover/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types (`PopoverTriggerDivProps` for the generic trigger); `@heroui/styles` →
// vendored `styles/`.
import { PopoverArrow, PopoverContent, PopoverDialog, PopoverHeading, PopoverRoot, PopoverTrigger } from "./popover.tsx";
import type { PopoverArrowProps, PopoverContentProps, PopoverDialogProps, PopoverHeadingProps, PopoverRootProps, PopoverTriggerDivProps } from "./popover.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Popover = Object.assign(PopoverRoot, {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Dialog: PopoverDialog,
  Arrow: PopoverArrow,
  Content: PopoverContent,
  Heading: PopoverHeading,
});

export type Popover = {
  Props: PopoverRootProps;
  RootProps: PopoverRootProps;
  TriggerProps: PopoverTriggerDivProps;
  DialogProps: PopoverDialogProps;
  ArrowProps: PopoverArrowProps;
  ContentProps: PopoverContentProps;
  HeadingProps: PopoverHeadingProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { PopoverArrow, PopoverContent, PopoverDialog, PopoverHeading, PopoverRoot, PopoverTrigger };

export type {
  PopoverRootProps,
  PopoverRootProps as PopoverProps,
  PopoverTriggerProps,
  PopoverDialogProps,
  PopoverArrowProps,
  PopoverContentProps,
  PopoverHeadingProps,
} from "./popover.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { popoverVariants } from "../../../styles/src/components/popover/index.ts";

export type { PopoverVariants } from "../../../styles/src/components/popover/index.ts";
