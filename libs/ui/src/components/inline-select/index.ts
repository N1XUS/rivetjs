// Rivet addition (no HeroUI v3.2.6 counterpart): inline dropdown; feature set scoped from public docs of commercial UI kits,
// independent implementation (see `inline-select.tsx`).
import { InlineSelectIndicator, InlineSelectItem, InlineSelectPopover, InlineSelectRoot, InlineSelectTrigger, InlineSelectValue } from "./inline-select.tsx";
import type {
  InlineSelectIndicatorProps,
  InlineSelectItemProps,
  InlineSelectPopoverProps,
  InlineSelectRootProps,
  InlineSelectTriggerProps,
  InlineSelectValueProps,
} from "./inline-select.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const InlineSelect = Object.assign(InlineSelectRoot, {
  Root: InlineSelectRoot,
  Trigger: InlineSelectTrigger,
  Value: InlineSelectValue,
  Indicator: InlineSelectIndicator,
  Popover: InlineSelectPopover,
  Item: InlineSelectItem,
});

export type InlineSelect<M extends "single" | "multiple" = "single", T extends object = object> = {
  Props: InlineSelectRootProps<M, T>;
  RootProps: InlineSelectRootProps<M, T>;
  TriggerProps: InlineSelectTriggerProps;
  ValueProps: InlineSelectValueProps;
  IndicatorProps: InlineSelectIndicatorProps;
  PopoverProps: InlineSelectPopoverProps;
  ItemProps: InlineSelectItemProps<T>;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  InlineSelectRoot,
  InlineSelectTrigger,
  InlineSelectValue,
  InlineSelectIndicator,
  InlineSelectPopover,
  InlineSelectItem,
  InlineSelectContext,
} from "./inline-select.tsx";
export type {
  InlineSelectRootProps,
  InlineSelectRootProps as InlineSelectProps,
  InlineSelectTriggerProps,
  InlineSelectValueProps,
  InlineSelectIndicatorProps,
  InlineSelectPopoverProps,
  InlineSelectItemProps,
  InlineSelectValueRenderProps,
} from "./inline-select.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { inlineSelectVariants } from "../../../styles/src/components/inline-select/index.ts";

export type { InlineSelectVariants } from "../../../styles/src/components/inline-select/index.ts";
