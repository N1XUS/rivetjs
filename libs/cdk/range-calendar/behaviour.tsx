// Ported from react-aria (react-spectrum) src/calendar/useRangeCalendar.ts, Apache-2.0, © Adobe.
// Rivet: useRangeCalendar shares useCalendarBase with useCalendar (`../calendar/behaviour.tsx`):
// `rangeCalendarProps(props, state)` + `rangeCalendarFocusOut` (commit on blur) and the grid's range
// press / drag handlers live there; this entry re-exports them.
export {
  rangeCalendarProps,
  rangeCalendarFocusOut,
  calendarGridProps,
  calendarCellProps,
  calendarHeadingProps,
  calendarMonthPickerProps,
  calendarYearPickerProps,
  calendarPreviousPress,
  calendarNextPress,
  calendarGridKeyDown,
  calendarGridFocusIn,
  calendarGridFocusOut,
  calendarGridMouseDown,
  calendarGridPointerDown,
  calendarGridPointerUp,
  calendarGridPointerOver,
  calendarGridPointerOut,
  calendarGridClick,
  calendarGridContextMenu,
  selectedDateDescription,
  visibleRangeDescription,
} from "../calendar/behaviour.tsx";
export type {
  AriaCalendarLabelProps,
  CalendarAria,
  AriaCalendarCellProps,
  CalendarCellAria,
  AriaCalendarGridProps,
  CalendarGridAria,
} from "../calendar/behaviour.tsx";
