// Rivet-authored (no HeroUI counterpart): TimeField + popover of iOS-style wheel drums (@rivetjs/cdk/time-wheels).
import { TimePickerPopover, TimePickerRoot, TimePickerTrigger, TimePickerTriggerIndicator, TimePickerWheels } from "./time-picker.tsx";
import type {
  TimePickerPopoverProps,
  TimePickerRootProps,
  TimePickerTriggerIndicatorProps,
  TimePickerTriggerProps,
  TimePickerWheelsProps,
} from "./time-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const TimePicker = Object.assign(TimePickerRoot, {
  Root: TimePickerRoot,
  Trigger: TimePickerTrigger,
  TriggerIndicator: TimePickerTriggerIndicator,
  Popover: TimePickerPopover,
  Wheels: TimePickerWheels,
});

export type TimePicker = {
  Props: TimePickerRootProps;
  RootProps: TimePickerRootProps;
  TriggerProps: TimePickerTriggerProps;
  TriggerIndicatorProps: TimePickerTriggerIndicatorProps;
  PopoverProps: TimePickerPopoverProps;
  WheelsProps: TimePickerWheelsProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { TimePickerContext, TimePickerRoot, TimePickerTrigger, TimePickerTriggerIndicator, TimePickerPopover, TimePickerWheels } from "./time-picker.tsx";

export type {
  TimePickerRootProps,
  TimePickerRootProps as TimePickerProps,
  TimePickerTriggerProps,
  TimePickerTriggerIndicatorProps,
  TimePickerPopoverProps,
  TimePickerWheelsProps,
} from "./time-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { timePickerVariants } from "../../../styles/src/components/time-picker/index.ts";

export type { TimePickerVariants } from "../../../styles/src/components/time-picker/index.ts";
