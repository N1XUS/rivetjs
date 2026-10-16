// Regression: the picker hands the user's `isDateUnavailable` to the Calendar through CalendarContext as is
// (RA useDatePicker `calendarProps`). A wrapping arrow made in a ternary does not serialize, so on a resumed
// page the whole CalendarContext entry was dropped and the popover's calendar lost every picker option
// (firstDayOfWeek, min / max, unavailable dates, value / onChange): docs examples date-picker-calendar,
// date-picker-validation, date-range-picker-options.
import { installDom } from "./install-dom.ts";
installDom();
import { describe, expect, it } from "vitest";
import { createRoot } from "@rivetjs/reactivity";
import { isWeekend, type DateValue } from "../date/index.ts";
import { datePickerProps, dateRangePickerProps } from "../date-picker/behaviour.tsx";
import { createDatePickerState, createDateRangePickerState } from "../state/date-picker.ts";

/** Bags are built inside a component (an owner for their client effects). */
const owned = <T>(fn: () => T): T => createRoot(fn).value;

describe("date picker calendarProps", () => {
  it("passes isDateUnavailable through unchanged", () => {
    const isDateUnavailable = (day: DateValue) => isWeekend(day, "en-US");
    const single = owned(() => datePickerProps({ "aria-label": "Date", isDateUnavailable }, createDatePickerState({ locale: "en-US", isDateUnavailable })));
    expect(single.calendarProps.isDateUnavailable).toBe(isDateUnavailable);
    const range = owned(() =>
      dateRangePickerProps({ "aria-label": "Range", isDateUnavailable }, createDateRangePickerState({ locale: "en-US", isDateUnavailable })),
    );
    expect(range.calendarProps.isDateUnavailable).toBe(isDateUnavailable);
  });

  it("leaves it undefined without one", () => {
    expect(owned(() => datePickerProps({ "aria-label": "Date" }, createDatePickerState({ locale: "en-US" }))).calendarProps.isDateUnavailable).toBe(undefined);
  });
});
