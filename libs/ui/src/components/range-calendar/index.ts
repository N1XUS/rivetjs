// Ported from HeroUI v3.2.6 packages/react/src/components/range-calendar/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.

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
  RangeCalendarCell,
  RangeCalendarCellIndicator,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridHeader,
  RangeCalendarHeader,
  RangeCalendarHeaderCell,
  RangeCalendarHeading,
  RangeCalendarNavButton,
  RangeCalendarRoot,
} from "./range-calendar.tsx";
import type {
  RangeCalendarCellIndicatorProps,
  RangeCalendarCellProps,
  RangeCalendarGridBodyProps,
  RangeCalendarGridHeaderProps,
  RangeCalendarGridProps,
  RangeCalendarHeaderCellProps,
  RangeCalendarHeaderProps,
  RangeCalendarHeadingProps,
  RangeCalendarNavButtonProps,
  RangeCalendarRootProps,
} from "./range-calendar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
// A plain `export const X = Object.assign(Root, { … })`: the compiler's boundary facts resolve `<RangeCalendar>` / `<RangeCalendar.Part>`
// through it (a `const X = Compound as T` alias hid the compound: the demo above every RangeCalendar rendered as a static
// page and the root adopted standalone with `{}` props — cold clicks re-rendered the bare cdk Calendar).
export const RangeCalendar = Object.assign(RangeCalendarRoot, {
  Root: RangeCalendarRoot,
  Header: RangeCalendarHeader,
  Heading: RangeCalendarHeading,
  NavButton: RangeCalendarNavButton,
  Grid: RangeCalendarGrid,
  GridHeader: RangeCalendarGridHeader,
  GridBody: RangeCalendarGridBody,
  HeaderCell: RangeCalendarHeaderCell,
  Cell: RangeCalendarCell,
  CellIndicator: RangeCalendarCellIndicator,
  YearPickerTrigger: CalendarYearPickerTrigger,
  YearPickerTriggerHeading: CalendarYearPickerTriggerHeading,
  YearPickerTriggerIndicator: CalendarYearPickerTriggerIndicator,
  YearPickerGrid: CalendarYearPickerGrid,
  YearPickerGridBody: CalendarYearPickerGridBody,
  YearPickerCell: CalendarYearPickerCell,
});

export type RangeCalendar = {
  Props: RangeCalendarRootProps;
  RootProps: RangeCalendarRootProps;
  HeaderProps: RangeCalendarHeaderProps;
  HeadingProps: RangeCalendarHeadingProps;
  NavButtonProps: RangeCalendarNavButtonProps;
  GridProps: RangeCalendarGridProps;
  GridHeaderProps: RangeCalendarGridHeaderProps;
  GridBodyProps: RangeCalendarGridBodyProps;
  HeaderCellProps: RangeCalendarHeaderCellProps;
  CellProps: RangeCalendarCellProps;
  CellIndicatorProps: RangeCalendarCellIndicatorProps;
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
  RangeCalendarRoot,
  RangeCalendarHeader,
  RangeCalendarHeading,
  RangeCalendarNavButton,
  RangeCalendarGrid,
  RangeCalendarGridHeader,
  RangeCalendarGridBody,
  RangeCalendarHeaderCell,
  RangeCalendarCell,
  RangeCalendarCellIndicator,
};

export type {
  RangeCalendarRootProps,
  RangeCalendarRootProps as RangeCalendarProps,
  RangeCalendarHeaderProps,
  RangeCalendarHeadingProps,
  RangeCalendarNavButtonProps,
  RangeCalendarGridProps,
  RangeCalendarGridHeaderProps,
  RangeCalendarGridBodyProps,
  RangeCalendarHeaderCellProps,
  RangeCalendarCellProps,
  RangeCalendarCellIndicatorProps,
} from "./range-calendar.tsx";

/* -------------------------------------------------------------------------------------------------
 * YearPickerContext (re-exported from calendar-year-picker for convenience)
 * -----------------------------------------------------------------------------------------------*/
export { YearPickerContext, useYearPicker, useCalendarOrRangeState } from "../calendar-year-picker/index.ts";
export type { YearPickerContextValue } from "../calendar-year-picker/index.ts";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { rangeCalendarVariants } from "../../../styles/src/components/range-calendar/index.ts";

export type { RangeCalendarVariants } from "../../../styles/src/components/range-calendar/index.ts";
