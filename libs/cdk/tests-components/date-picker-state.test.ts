// Ported from react-aria test/datepicker/useDatePicker.test.tsx (react-spectrum, Apache-2.0, © Adobe),
// plus state-level cases of the RAC DatePicker / DateRangePicker suites and of react-stately's
// useDateFieldState / useDatePickerState / useDateRangePickerState behaviour (react-stately ships no
// datepicker state tests) that need no DOM. `renderHook` + `act` → plain state objects and direct
// calls; `result.current.x` → accessor functions. Fixed dates only.
import { describe, it, expect } from "@rivetjs/testing/jest";
import { CalendarDate, CalendarDateTime, parseDate, parseZonedDateTime, toCalendar, createCalendar } from "@rivetjs/cdk/date";
import {
  clearSegment,
  confirmPlaceholder,
  createDateFieldState,
  createPickerFieldState,
  decrement,
  fieldValueString,
  increment,
  incrementPage,
  isFieldInvalid,
  segments,
  setSegment,
  setValue as setFieldValue,
  syncBuiltin,
} from "../state/date-field.ts";
import {
  commitOnClose,
  createDatePickerState,
  createDateRangePickerState,
  dateRange,
  dateValue,
  formatValue,
  granularity,
  hasTime,
  isInvalid,
  pickerDisplayValidation,
  setDateRange,
  setDateValue,
  setOpen,
  setTimeValue,
  setValue,
} from "../state/date-picker.ts";
import { commitValidation } from "../state/form-validation.ts";

const text = (state: Parameters<typeof segments>[0]) =>
  segments(state)
    .map((s) => s.text)
    .join("")
    .replace(/[⁦-⁩]/g, "");

describe("useDatePicker", () => {
  it("should commit programmatically setValue when field is empty", () => {
    const state = createDatePickerState({ locale: "en-US" });
    const field = createPickerFieldState({ owner: state }, { id: "f", locale: "en-US", defaultValue: null });
    expect(text(field)).toBe("mm/dd/yyyy");
    setValue(state, parseDate("2020-01-01"));
    expect(text(field)).toContain("2020");
    expect(text(field)).toBe("1/1/2020");
  });
});

describe("useDateFieldState", () => {
  it("renders placeholders and fills segment by segment, committing a complete value", () => {
    const changes: unknown[] = [];
    const state = createDateFieldState({ locale: "en-US", placeholderValue: new CalendarDate(2019, 6, 15), onChange: (v) => changes.push(v?.toString()) });
    expect(text(state)).toBe("mm/dd/yyyy");
    expect(
      segments(state)
        .filter((s) => s.isEditable)
        .map((s) => s.type),
    ).toEqual(["month", "day", "year"]);
    setSegment(state, "month", 3);
    expect(text(state)).toBe("3/dd/yyyy");
    expect(fieldValueString(state)).toBe(null);
    setSegment(state, "day", 4);
    expect(changes).toEqual([]);
    setSegment(state, "year", 2021);
    expect(text(state)).toBe("3/4/2021");
    expect(changes).toEqual(["2021-03-04"]);
    expect(fieldValueString(state)).toBe("2021-03-04");
  });

  it("increments and wraps segments, placeholder segments start from the placeholder", () => {
    const state = createDateFieldState({ locale: "en-US", defaultValue: new CalendarDate(2020, 12, 31) });
    increment(state, "month");
    expect(fieldValueString(state)).toBe("2020-01-31");
    decrement(state, "day");
    expect(fieldValueString(state)).toBe("2020-01-30");
    incrementPage(state, "year");
    expect(fieldValueString(state)).toBe("2025-01-30");
    const empty = createDateFieldState({ locale: "en-US", placeholderValue: new CalendarDate(2019, 6, 15) });
    increment(empty, "month");
    // The placeholder month is shown as the first value (no increment from an empty segment).
    expect(text(empty)).toBe("6/dd/yyyy");
  });

  it("clears a segment (display override) and commits when the field is complete again", () => {
    const changes: unknown[] = [];
    const state = createDateFieldState({ locale: "en-US", defaultValue: new CalendarDate(2020, 2, 3), onChange: (v) => changes.push(v?.toString() ?? null) });
    clearSegment(state, "day");
    expect(text(state)).toBe("2/dd/2020");
    // The value is kept (display override) until the field is complete again.
    expect(changes).toEqual([]);
    expect(fieldValueString(state)).toBe("2020-02-03");
    setSegment(state, "day", 9);
    expect(changes).toEqual(["2020-02-09"]);
  });

  it("confirmPlaceholder fills the remaining segments from the placeholder on blur", () => {
    const state = createDateFieldState({ locale: "en-US", placeholderValue: new CalendarDate(2019, 6, 15) });
    setSegment(state, "month", 2);
    setSegment(state, "day", 30);
    confirmPlaceholder(state);
    // Incomplete fields are left for the user unless every segment is filled.
    expect(fieldValueString(state)).toBe(null);
    setSegment(state, "year", 2021);
    // February 30th is constrained when the field is complete.
    confirmPlaceholder(state);
    expect(fieldValueString(state)).toBe("2021-02-28");
  });

  it("formats time segments, hour cycle and time zone", () => {
    const state = createDateFieldState({ locale: "en-US", defaultValue: new CalendarDateTime(2020, 2, 3, 14, 5) });
    expect(text(state)).toBe("2/3/2020, 2:05 PM");
    const h24 = createDateFieldState({ locale: "en-US", hourCycle: 24, defaultValue: new CalendarDateTime(2020, 2, 3, 14, 5) });
    expect(text(h24)).toBe("2/3/2020, 14:05");
    const zoned = createDateFieldState({ locale: "en-US", defaultValue: parseZonedDateTime("2020-02-03T14:05[America/Los_Angeles]") });
    expect(text(zoned)).toBe("2/3/2020, 2:05 PM PST");
    const hidden = createDateFieldState({ locale: "en-US", hideTimeZone: true, defaultValue: parseZonedDateTime("2020-02-03T14:05[America/Los_Angeles]") });
    expect(text(hidden)).toBe("2/3/2020, 2:05 PM");
  });

  it("emits values in the calendar of the original value (display calendar from the locale)", () => {
    const changes: string[] = [];
    const state = createDateFieldState({
      locale: "th-TH-u-ca-buddhist",
      createCalendar,
      defaultValue: new CalendarDate(2020, 2, 3),
      onChange: (v) => changes.push(v!.calendar.identifier + ":" + v!.toString()),
    });
    increment(state, "day");
    expect(changes).toEqual(["gregory:2020-02-04"]);
    const buddhist = toCalendar(new CalendarDate(2020, 2, 3), createCalendar("buddhist"));
    expect(text(createDateFieldState({ locale: "th-TH-u-ca-buddhist", createCalendar, defaultValue: buddhist }))).toBe("3/2/2563");
  });

  it("built-in validation: min / max / unavailable (aria behaviour: realtime)", () => {
    const state = createDateFieldState({
      locale: "en-US",
      defaultValue: new CalendarDate(2020, 2, 3),
      minValue: new CalendarDate(2020, 2, 1),
      maxValue: new CalendarDate(2020, 2, 10),
      isDateUnavailable: (d) => d.day === 5,
    });
    expect(isFieldInvalid(state)).toBe(false);
    increment(state, "day");
    increment(state, "day");
    expect(fieldValueString(state)).toBe("2020-02-05");
    expect(isFieldInvalid(state)).toBe(true);
    increment(state, "day");
    expect(isFieldInvalid(state)).toBe(false);
    setFieldValue(state, new CalendarDate(2020, 3, 1));
    expect(isFieldInvalid(state)).toBe(true);
  });

  it("native validation behaviour displays errors only after commit", () => {
    const state = createDateFieldState({
      locale: "en-US",
      validationBehavior: "native",
      defaultValue: new CalendarDate(2020, 2, 3),
      maxValue: new CalendarDate(2020, 2, 4),
    });
    increment(state, "day");
    increment(state, "day");
    syncBuiltin(state);
    expect(isFieldInvalid(state)).toBe(false);
    commitValidation(state.validation);
    expect(isFieldInvalid(state)).toBe(true);
  });

  it("is read only / disabled", () => {
    const state = createDateFieldState({ locale: "en-US", isReadOnly: true, defaultValue: new CalendarDate(2020, 2, 3) });
    increment(state, "day");
    expect(fieldValueString(state)).toBe("2020-02-03");
  });
});

describe("useDatePickerState", () => {
  it("setDateValue closes the popover (shouldCloseOnSelect) and commits", () => {
    const changes: string[] = [];
    const state = createDatePickerState({ locale: "en-US", defaultValue: new CalendarDate(2019, 2, 3), onChange: (v) => changes.push(v!.toString()) });
    setOpen(state, true);
    expect(state.isOpen()).toBe(true);
    setDateValue(state, new CalendarDate(2019, 2, 4));
    expect(state.isOpen()).toBe(false);
    expect(changes).toEqual(["2019-02-04"]);
  });

  it("shouldCloseOnSelect = false keeps it open", () => {
    const state = createDatePickerState({ locale: "en-US", defaultValue: new CalendarDate(2019, 2, 3), shouldCloseOnSelect: false });
    setOpen(state, true);
    setDateValue(state, new CalendarDate(2019, 2, 4));
    expect(state.isOpen()).toBe(true);
    expect(dateValue(state)?.toString()).toBe("2019-02-04");
  });

  it("time granularity: a selected date waits for a time, closing commits the placeholder time", () => {
    const changes: string[] = [];
    const state = createDatePickerState({ locale: "en-US", granularity: "minute", shouldCloseOnSelect: false, onChange: (v) => changes.push(v!.toString()) });
    expect(granularity(state)).toBe("minute");
    expect(hasTime(state)).toBe(true);
    setOpen(state, true);
    setDateValue(state, new CalendarDate(2019, 2, 4));
    expect(changes).toEqual([]);
    expect(dateValue(state)?.toString()).toBe("2019-02-04");
    setOpen(state, false);
    expect(changes).toEqual(["2019-02-04T00:00:00"]);
  });

  it("time granularity: date + time commit together; closing by Escape / outside commits too", () => {
    const changes: string[] = [];
    const state = createDatePickerState({ locale: "en-US", granularity: "minute", shouldCloseOnSelect: false, onChange: (v) => changes.push(v!.toString()) });
    setTimeValue(state, new CalendarDateTime(2000, 1, 1, 9, 30));
    expect(changes).toEqual([]);
    setDateValue(state, new CalendarDate(2019, 2, 4));
    expect(changes).toEqual(["2019-02-04T09:30:00"]);
    const other = createDatePickerState({ locale: "en-US", granularity: "minute", shouldCloseOnSelect: false, onChange: (v) => changes.push(v!.toString()) });
    setDateValue(other, new CalendarDate(2019, 3, 5));
    commitOnClose(other);
    expect(changes).toEqual(["2019-02-04T09:30:00", "2019-03-05T00:00:00"]);
  });

  it("validation: min / max with native behaviour after commit", () => {
    const state = createDatePickerState({ locale: "en-US", minValue: new CalendarDate(2023, 1, 1), defaultValue: new CalendarDate(2020, 2, 3) });
    // aria (state default): realtime
    expect(isInvalid(state)).toBe(true);
    expect(pickerDisplayValidation(state).validationErrors).toEqual(["Value must be 1/1/2023 or later."]);
    setValue(state, new CalendarDate(2023, 2, 3));
    expect(isInvalid(state)).toBe(false);
  });

  it("formats the value", () => {
    const state = createDatePickerState({ locale: "en-US", defaultValue: new CalendarDate(2019, 2, 3) });
    expect(formatValue(state, "en-US", { month: "long" })).toBe("February 3, 2019");
    const field = createPickerFieldState({ owner: state }, { id: "f", locale: "en-US", defaultValue: state.defaultValue });
    increment(field, "day");
    expect(state.value()).toBe("2019-02-04");
  });
});

describe("useDateRangePickerState", () => {
  it("setDateRange commits and closes", () => {
    const changes: string[] = [];
    const state = createDateRangePickerState({ locale: "en-US", onChange: (v) => changes.push(v ? v.start + ".." + v.end : "null") });
    setOpen(state, true);
    setDateRange(state, { start: new CalendarDate(2019, 2, 3), end: new CalendarDate(2019, 2, 10) });
    expect(state.isOpen()).toBe(false);
    expect(changes).toEqual(["2019-02-03..2019-02-10"]);
    expect(formatValue(state, "en-US", { month: "long" })).toEqual({ start: "February 3", end: "10, 2019" });
  });

  it("fields edit one end; the range commits once both are complete", () => {
    const changes: string[] = [];
    const state = createDateRangePickerState({ locale: "en-US", onChange: (v) => changes.push(v ? v.start + ".." + v.end : "null") });
    const start = createPickerFieldState({ owner: state, part: "start" }, { id: "s", locale: "en-US", defaultValue: null });
    const end = createPickerFieldState({ owner: state, part: "end" }, { id: "e", locale: "en-US", defaultValue: null });
    setFieldValue(start, new CalendarDate(2019, 2, 3));
    expect(changes).toEqual([]);
    expect(text(start)).toBe("2/3/2019");
    expect(text(end)).toBe("mm/dd/yyyy");
    setFieldValue(end, new CalendarDate(2019, 2, 10));
    expect(changes).toEqual(["2019-02-03..2019-02-10"]);
    expect(dateRange(state)?.end?.toString()).toBe("2019-02-10");
  });

  it("validation: reversed range, min / max", () => {
    const state = createDateRangePickerState({
      locale: "en-US",
      defaultValue: { start: new CalendarDate(2019, 2, 10), end: new CalendarDate(2019, 2, 3) },
    });
    expect(isInvalid(state)).toBe(true);
    expect(pickerDisplayValidation(state).validationErrors).toEqual(["Start date must be before end date."]);
    setValue(state, { start: new CalendarDate(2019, 2, 3), end: new CalendarDate(2019, 2, 10) });
    expect(isInvalid(state)).toBe(false);
  });

  it("time granularity: closing commits the selected range with placeholder times", () => {
    const changes: string[] = [];
    const state = createDateRangePickerState({
      locale: "en-US",
      granularity: "minute",
      shouldCloseOnSelect: false,
      onChange: (v) => changes.push(v ? v.start + ".." + v.end : "null"),
    });
    setOpen(state, true);
    setDateRange(state, { start: new CalendarDate(2019, 2, 3), end: new CalendarDate(2019, 2, 10) });
    expect(changes).toEqual([]);
    setOpen(state, false);
    expect(changes).toEqual(["2019-02-03T00:00:00..2019-02-10T00:00:00"]);
  });
});
