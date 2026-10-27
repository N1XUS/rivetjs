// Direct convenience adapters for calendar and date-range state, using fixed dates only.
import { test } from "vitest";
import assert from "node:assert/strict";
import { CalendarDate, CalendarDateTime, Time } from "@rivetjs/cdk/date";
import { createCalendarState, isCellFocused, isEqualDuration } from "@rivetjs/cdk/state/calendar";
import { createDateRangePickerState, pickerRangeValue, setDate, setTime, setTimeRange, setDateTime, getDateFormatter } from "@rivetjs/cdk/state/date-picker";

test("calendar cell focus requires both grid focus and the same date", () => {
  const date = new CalendarDate(2024, 7, 1);
  const state = createCalendarState({ locale: "en-US", defaultFocusedValue: date });
  assert.equal(isCellFocused(state, date), false);
  state.isFocused.set(true);
  assert.equal(isCellFocused(state, date.copy()), true);
  assert.equal(isCellFocused(state, date.add({ days: 1 })), false);
  assert.equal(isEqualDuration({ months: 2 }, { months: 2 }), true);
  assert.equal(isEqualDuration({ days: 7 }, { weeks: 1 }), false);
  assert.equal(isEqualDuration({ years: 1 }, { years: 2 }), false);
});

test("range date and time setters preserve the other endpoint and the untouched portion", () => {
  const state = createDateRangePickerState({
    locale: "en-US",
    granularity: "minute",
    defaultValue: { start: new CalendarDateTime(2024, 7, 1, 9), end: new CalendarDateTime(2024, 7, 3, 17) },
  });
  setDate(state, "start", new CalendarDate(2024, 7, 2));
  assert.equal(pickerRangeValue(state).start!.toString(), "2024-07-02T09:00:00");
  setTime(state, "end", new Time(18, 30));
  assert.equal(pickerRangeValue(state).end!.toString(), "2024-07-03T18:30:00");
  setTimeRange(state, { start: new Time(10, 15), end: new Time(19, 45) });
  assert.equal(pickerRangeValue(state).start!.toString(), "2024-07-02T10:15:00");
  assert.equal(pickerRangeValue(state).end!.toString(), "2024-07-03T19:45:00");
  setDateTime(state, "end", new CalendarDateTime(2024, 7, 4, 20));
  assert.equal(pickerRangeValue(state).start!.toString(), "2024-07-02T10:15:00");
  assert.equal(pickerRangeValue(state).end!.toString(), "2024-07-04T20:00:00");
  const formatted = getDateFormatter(state, "en-US", { granularity: "day", shouldForceLeadingZeros: true }).format(new Date("2024-07-04T12:00:00Z"));
  assert.equal(formatted, "07/04/2024");
});
