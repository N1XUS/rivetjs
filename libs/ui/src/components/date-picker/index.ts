// Ported from HeroUI v3.2.6 packages/react/src/components/date-picker/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`; `DatePickerContext` exported (resumable
// token for parts outside the root).
import { DatePickerPopover, DatePickerRoot, DatePickerTrigger, DatePickerTriggerIndicator } from "./date-picker.tsx";
import type { DatePickerPopoverProps, DatePickerRootProps, DatePickerTriggerIndicatorProps, DatePickerTriggerProps } from "./date-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const DatePicker = Object.assign(DatePickerRoot, {
  Root: DatePickerRoot,
  Trigger: DatePickerTrigger,
  TriggerIndicator: DatePickerTriggerIndicator,
  Popover: DatePickerPopover,
});

export type DatePicker = {
  Props: DatePickerRootProps;
  RootProps: DatePickerRootProps;
  TriggerProps: DatePickerTriggerProps;
  TriggerIndicatorProps: DatePickerTriggerIndicatorProps;
  PopoverProps: DatePickerPopoverProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { DatePickerContext, DatePickerRoot, DatePickerTrigger, DatePickerTriggerIndicator, DatePickerPopover } from "./date-picker.tsx";

export type {
  DatePickerRootProps,
  DatePickerRootProps as DatePickerProps,
  DatePickerTriggerProps,
  DatePickerTriggerIndicatorProps,
  DatePickerPopoverProps,
} from "./date-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { datePickerVariants } from "../../../styles/src/components/date-picker/index.ts";

export type { DatePickerVariants } from "../../../styles/src/components/date-picker/index.ts";
