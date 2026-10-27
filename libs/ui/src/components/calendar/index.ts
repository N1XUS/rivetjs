// Ported from HeroUI v3.2.6 packages/react/src/components/calendar/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`; `CalendarSelectionMode` from
// `@rivetjs/cdk/calendar`.

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

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
// A plain `export const X = Object.assign(Root, { … })`: the compiler's boundary facts resolve `<Calendar>` / `<Calendar.Part>`
// through it (a `const X = Compound as T` alias hid the compound: the demo above every Calendar rendered as a static
// page and the root adopted standalone with `{}` props — cold clicks re-rendered the bare cdk Calendar).
export const Calendar = Object.assign(CalendarRoot, {
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
