// Ported from HeroUI v3.2.6 packages/react/src/components/select/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import { SelectClearButton, SelectIndicator, SelectItem, SelectPopover, SelectRoot, SelectTrigger, SelectValue } from "./select.tsx";
import type {
  SelectClearButtonSpanProps,
  SelectIndicatorSpanProps,
  SelectItemProps,
  SelectPopoverProps,
  SelectRootProps,
  SelectTriggerProps,
  SelectValueProps,
} from "./select.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Select = Object.assign(SelectRoot, {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Indicator: SelectIndicator,
  ClearButton: SelectClearButton,
  Popover: SelectPopover,
  Item: SelectItem,
});

export type Select<M extends "single" | "multiple" = "single"> = {
  Props: SelectRootProps<M>;
  RootProps: SelectRootProps<M>;
  TriggerProps: SelectTriggerProps;
  ValueProps: SelectValueProps;
  IndicatorProps: SelectIndicatorSpanProps;
  ClearButtonProps: SelectClearButtonSpanProps;
  PopoverProps: SelectPopoverProps;
  ItemProps: SelectItemProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SelectClearButton, SelectIndicator, SelectItem, SelectPopover, SelectRoot, SelectTrigger, SelectValue };

export type {
  SelectRootProps,
  SelectRootProps as SelectProps,
  SelectTriggerProps,
  SelectValueProps,
  SelectIndicatorProps,
  SelectIndicatorSpanProps,
  SelectClearButtonProps,
  SelectClearButtonSpanProps,
  SelectPopoverProps,
  SelectItemProps,
} from "./select.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { selectVariants } from "../../../styles/src/components/select/index.ts";

export type { SelectVariants } from "../../../styles/src/components/select/index.ts";
