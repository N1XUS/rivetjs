// Ported from HeroUI v3.2.6 packages/react/src/components/date-range-picker/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`; `DateRangePickerContext` exported (resumable
// token for parts outside the root).
import {
  DateRangePickerPopover,
  DateRangePickerRangeSeparator,
  DateRangePickerRoot,
  DateRangePickerTrigger,
  DateRangePickerTriggerIndicator,
} from "./date-range-picker.tsx";
import type {
  DateRangePickerPopoverProps,
  DateRangePickerRangeSeparatorProps,
  DateRangePickerRootProps,
  DateRangePickerTriggerIndicatorProps,
  DateRangePickerTriggerProps,
} from "./date-range-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const DateRangePicker = Object.assign(DateRangePickerRoot, {
  Root: DateRangePickerRoot,
  Trigger: DateRangePickerTrigger,
  TriggerIndicator: DateRangePickerTriggerIndicator,
  RangeSeparator: DateRangePickerRangeSeparator,
  Popover: DateRangePickerPopover,
});

export type DateRangePicker = {
  Props: DateRangePickerRootProps;
  RootProps: DateRangePickerRootProps;
  TriggerProps: DateRangePickerTriggerProps;
  TriggerIndicatorProps: DateRangePickerTriggerIndicatorProps;
  RangeSeparatorProps: DateRangePickerRangeSeparatorProps;
  PopoverProps: DateRangePickerPopoverProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  DateRangePickerContext,
  DateRangePickerRoot,
  DateRangePickerTrigger,
  DateRangePickerTriggerIndicator,
  DateRangePickerRangeSeparator,
  DateRangePickerPopover,
} from "./date-range-picker.tsx";

export type {
  DateRangePickerRootProps,
  DateRangePickerRootProps as DateRangePickerProps,
  DateRangePickerTriggerProps,
  DateRangePickerTriggerIndicatorProps,
  DateRangePickerRangeSeparatorProps,
  DateRangePickerPopoverProps,
} from "./date-range-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { dateRangePickerVariants } from "../../../styles/src/components/date-range-picker/index.ts";

export type { DateRangePickerVariants } from "../../../styles/src/components/date-range-picker/index.ts";
