// Ported from HeroUI v3.2.6 packages/react/src/components/calendar-year-picker/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import {
  CalendarYearPickerCell,
  CalendarYearPickerGrid,
  CalendarYearPickerGridBody,
  CalendarYearPickerTrigger,
  CalendarYearPickerTriggerHeading,
  CalendarYearPickerTriggerIndicator,
} from "./calendar-year-picker.tsx";
import type {
  CalendarYearPickerCellProps,
  CalendarYearPickerGridBodyProps,
  CalendarYearPickerGridProps,
  CalendarYearPickerTriggerHeadingProps,
  CalendarYearPickerTriggerIndicatorProps,
  CalendarYearPickerTriggerProps,
} from "./calendar-year-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const CalendarYearPicker = {
  Trigger: CalendarYearPickerTrigger,
  TriggerHeading: CalendarYearPickerTriggerHeading,
  TriggerIndicator: CalendarYearPickerTriggerIndicator,
  Grid: CalendarYearPickerGrid,
  GridBody: CalendarYearPickerGridBody,
  Cell: CalendarYearPickerCell,
};

export type CalendarYearPicker = {
  TriggerProps: CalendarYearPickerTriggerProps;
  TriggerHeadingProps: CalendarYearPickerTriggerHeadingProps;
  TriggerIndicatorProps: CalendarYearPickerTriggerIndicatorProps;
  GridProps: CalendarYearPickerGridProps;
  GridBodyProps: CalendarYearPickerGridBodyProps;
  CellProps: CalendarYearPickerCellProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  CalendarYearPickerTrigger,
  CalendarYearPickerTriggerHeading,
  CalendarYearPickerTriggerIndicator,
  CalendarYearPickerGrid,
  CalendarYearPickerGridBody,
  CalendarYearPickerCell,
};

export type {
  CalendarYearPickerTriggerProps,
  CalendarYearPickerTriggerHeadingProps,
  CalendarYearPickerTriggerIndicatorProps,
  CalendarYearPickerTriggerRenderProps,
  CalendarYearPickerGridProps,
  CalendarYearPickerGridBodyProps,
  CalendarYearPickerCellProps,
  CalendarYearPickerCellRenderProps,
} from "./calendar-year-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * YearPickerContext
 * -----------------------------------------------------------------------------------------------*/
export { YearPickerContext, useYearPicker } from "./year-picker-context.ts";
export type { YearPickerContextValue } from "./year-picker-context.ts";
export { useCalendarOrRangeState } from "./use-calendar-state.ts";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { calendarYearPickerVariants } from "../../../styles/src/components/calendar-year-picker/index.ts";

export type { CalendarYearPickerVariants } from "../../../styles/src/components/calendar-year-picker/index.ts";
