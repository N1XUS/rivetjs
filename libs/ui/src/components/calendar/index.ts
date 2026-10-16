// Ported from HeroUI v3.2.6 packages/react/src/components/calendar/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`; `CalendarSelectionMode` from
// `@rivetjs/cdk/calendar`.
import type { DateValue } from "@rivetjs/cdk/date";
import type { CalendarSelectionMode } from "@rivetjs/cdk/calendar";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import {
  CalendarYearPickerCell,
  CalendarYearPickerGrid,
  CalendarYearPickerGridBody,
  CalendarYearPickerTrigger,
  CalendarYearPickerTriggerHeading,
  CalendarYearPickerTriggerIndicator,
} from "../calendar-year-picker/index.ts";
import type {
  CalendarYearPickerCellProps,
  CalendarYearPickerGridBodyProps,
  CalendarYearPickerGridProps,
  CalendarYearPickerTriggerHeadingProps,
  CalendarYearPickerTriggerIndicatorProps,
  CalendarYearPickerTriggerProps,
} from "../calendar-year-picker/index.ts";

import {
  CalendarCell,
  CalendarCellIndicator,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeader,
  CalendarHeaderCell,
  CalendarHeading,
  CalendarNavButton,
  CalendarRoot,
} from "./calendar.tsx";
import type {
  CalendarCellIndicatorProps,
  CalendarCellProps,
  CalendarGridBodyProps,
  CalendarGridHeaderProps,
  CalendarGridProps,
  CalendarHeaderCellProps,
  CalendarHeaderProps,
  CalendarHeadingProps,
  CalendarNavButtonProps,
  CalendarRootProps,
} from "./calendar.tsx";

type CalendarComponent = <T extends DateValue = DateValue, M extends CalendarSelectionMode = "single">(props: CalendarRootProps<T, M>) => JSX.Element;

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
const CalendarCompound = Object.assign(CalendarRoot, {
  Root: CalendarRoot,
  Header: CalendarHeader,
  Heading: CalendarHeading,
  NavButton: CalendarNavButton,
  Grid: CalendarGrid,
  GridHeader: CalendarGridHeader,
  GridBody: CalendarGridBody,
  HeaderCell: CalendarHeaderCell,
  Cell: CalendarCell,
  CellIndicator: CalendarCellIndicator,
  YearPickerTrigger: CalendarYearPickerTrigger,
  YearPickerTriggerHeading: CalendarYearPickerTriggerHeading,
  YearPickerTriggerIndicator: CalendarYearPickerTriggerIndicator,
  YearPickerGrid: CalendarYearPickerGrid,
  YearPickerGridBody: CalendarYearPickerGridBody,
  YearPickerCell: CalendarYearPickerCell,
});

export const Calendar = CalendarCompound as CalendarComponent & typeof CalendarCompound;

export type Calendar = {
  Props: CalendarRootProps;
  RootProps: CalendarRootProps;
  HeaderProps: CalendarHeaderProps;
  HeadingProps: CalendarHeadingProps;
  NavButtonProps: CalendarNavButtonProps;
  GridProps: CalendarGridProps;
  GridHeaderProps: CalendarGridHeaderProps;
  GridBodyProps: CalendarGridBodyProps;
  HeaderCellProps: CalendarHeaderCellProps;
  CellProps: CalendarCellProps;
  CellIndicatorProps: CalendarCellIndicatorProps;
  YearPickerTriggerProps: CalendarYearPickerTriggerProps;
  YearPickerTriggerHeadingProps: CalendarYearPickerTriggerHeadingProps;
  YearPickerTriggerIndicatorProps: CalendarYearPickerTriggerIndicatorProps;
  YearPickerGridProps: CalendarYearPickerGridProps;
  YearPickerGridBodyProps: CalendarYearPickerGridBodyProps;
  YearPickerCellProps: CalendarYearPickerCellProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  CalendarRoot,
  CalendarHeader,
  CalendarHeading,
  CalendarNavButton,
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarHeaderCell,
  CalendarCell,
  CalendarCellIndicator,
};

export type {
  CalendarRootProps,
  CalendarRootProps as CalendarProps,
  CalendarHeaderProps,
  CalendarHeadingProps,
  CalendarNavButtonProps,
  CalendarGridProps,
  CalendarGridHeaderProps,
  CalendarGridBodyProps,
  CalendarHeaderCellProps,
  CalendarCellProps,
  CalendarCellIndicatorProps,
} from "./calendar.tsx";

/* -------------------------------------------------------------------------------------------------
 * YearPickerContext (re-exported from calendar-year-picker for convenience)
 * -----------------------------------------------------------------------------------------------*/
export { YearPickerContext, useYearPicker, useCalendarOrRangeState } from "../calendar-year-picker/index.ts";
export type { YearPickerContextValue } from "../calendar-year-picker/index.ts";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { calendarVariants } from "../../../styles/src/components/calendar/index.ts";

export type { CalendarVariants } from "../../../styles/src/components/calendar/index.ts";

export type { CalendarSelectionMode } from "@rivetjs/cdk/calendar";
