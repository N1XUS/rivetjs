// Ported from react-aria-components test/Calendar.test.js and RangeCalendar.test.tsx
// (react-spectrum, Apache-2.0, © Adobe): the cases that check labels, headings, picker items, cell
// states and grid shape. RAC renders them through React; here the same values come from the
// @rivetjs/cdk/calendar behaviour functions the component renders (Chromium-level cases live in
// dates-calendar.test.ts). Expected values are the original ones.
import { describe, it, expect } from "@rivetjs/testing/jest";
import { CalendarDate, getLocalTimeZone, startOfMonth, startOfWeek, today, stringifyDateValue } from "@rivetjs/cdk/date";
import { Custom454Calendar } from "../tests/date/customCalendarImpl.ts";
import { signal } from "@rivetjs/reactivity";
import { createCalendarState, createRangeCalendarState, getWeeksInMonth, getDatesInWeek, visibleRange, focusedDate } from "../state/calendar.ts";
import {
  calendarCellProps,
  calendarHeadingProps,
  calendarMonthPickerProps,
  calendarYearPickerProps,
  cellKey,
  gridAriaLabel,
  gridStartDate,
  gridWeeks as gridWeeksOf,
  isOutsideMonthOf,
  weekDays,
  type CalendarHeadingProps,
  type CalendarMonthPickerProps,
  type CalendarPickerAria,
  type CalendarYearPickerProps,
} from "../calendar/behaviour.tsx";
import { readDate } from "../state/calendar.ts";
import type { DateDuration } from "@rivetjs/cdk/date";

// Rivet names (cdk naming convention: `xProps(options, state)`, accessor values); the upstream expectations
// read snapshots of the bags.
type AnyState = Parameters<typeof gridWeeksOf>[0];
const gridWeeks = (state: AnyState, offset = 0) => gridWeeksOf(state, offset ? ({ months: offset } as DateDuration) : undefined);
const calendarHeading = (state: AnyState, options: CalendarHeadingProps = {}) => calendarHeadingProps(options, state);
const snapshot = (picker: CalendarPickerAria) => ({
  "aria-label": picker["aria-label"],
  value: picker.value(),
  items: picker.items(),
  onChange: picker.onChange,
});
const calendarMonthPicker = (state: AnyState, options: CalendarMonthPickerProps = {}) => snapshot(calendarMonthPickerProps(options, state));
const calendarYearPicker = (state: AnyState, options: CalendarYearPickerProps = {}) => snapshot(calendarYearPickerProps(options, state));
const resolve = (bag: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(bag).map(([k, v]) => [k, typeof v === "function" && !k.startsWith("on") ? (v as () => unknown)() : v]));
const cellProps = (state: AnyState, key: string, month: string) =>
  calendarCellProps({ date: key, isOutsideMonth: isOutsideMonthOf(state, readDate(state, key), readDate(state, month)) }, state);
const cellButtonAttributes = (state: AnyState, key: string, month: string) => resolve(cellProps(state, key, month).buttonProps);
const gridCellAttributes = (state: AnyState, key: string, month: string) => resolve(cellProps(state, key, month).cellProps);

const base = { locale: "en-US" };
// toHaveTextContent normalizes whitespace (Intl range formats use thin spaces).
const ws = (text: string) => text.replace(/\s+/g, " ");
const grid = (state: Parameters<typeof gridWeeks>[0], offset = 0) => gridWeeks(state, offset);
const cells = (state: Parameters<typeof gridWeeks>[0], offset = 0) =>
  grid(state, offset)
    .weeks.flat()
    .filter((k): k is string => k != null);
const buttons = (state: Parameters<typeof gridWeeks>[0]) => {
  const { month } = grid(state);
  return cells(state).map((key) => cellButtonAttributes(state, key, month));
};

describe("Calendar (RAC)", () => {
  it("should support multi-month calendars", () => {
    const state = createCalendarState({ ...base, defaultFocusedValue: new CalendarDate(2026, 4, 1), visibleDuration: { months: 2 } });
    const formatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
    const firstMonth = new CalendarDate(2026, 4, 1);
    const tz = getLocalTimeZone();
    expect(gridAriaLabel(state, gridStartDate(state), "Appointment date")).toBe("Appointment date, " + formatter.format(firstMonth.toDate(tz)));
    expect(gridAriaLabel(state, gridStartDate(state, { months: 1 }), "Appointment date")).toBe(
      "Appointment date, " + formatter.format(firstMonth.add({ months: 1 }).toDate(tz)),
    );
    expect(calendarHeading(state)).toBe("April 2026");
    expect(calendarHeading(state, { offset: { months: 1 } })).toBe("May 2026");
  });

  it.each([
    { name: "at the start", alignment: "start", expected: ["February 2020", "March 2020", "April 2020"] },
    { name: "in the center", alignment: "center", expected: ["January 2020", "February 2020", "March 2020"] },
    { name: "at the end", alignment: "end", expected: ["December 2019", "January 2020", "February 2020"] },
  ] as const)("should align the initial value $name", ({ alignment, expected }) => {
    const state = createCalendarState({ ...base, visibleDuration: { months: 3 }, defaultValue: new CalendarDate(2020, 2, 3), selectionAlignment: alignment });
    expect([0, 1, 2].map((i) => gridAriaLabel(state, gridStartDate(state, i ? { months: i } : undefined)))).toEqual(expected);
  });

  it("should support selected state", () => {
    const state = createCalendarState({ ...base, defaultValue: new CalendarDate(2026, 4, 8) });
    const index = cells(state).indexOf("2026-04-08");
    expect(buttons(state)[index]!["data-selected"]).toBe("true");
    expect(buttons(state)[index]!["aria-label"]).toContain("selected");
  });

  it("should support unavailable state", () => {
    const state = createCalendarState({ ...base, isDateUnavailable: () => true });
    expect(buttons(state)[7]!["data-unavailable"]).toBe("true");
    expect(buttons(state)[7]!["aria-disabled"]).toBe("true");
  });

  it("should support disabled state", () => {
    const state = createCalendarState({ ...base, isDisabled: true });
    expect(buttons(state)[7]!["data-disabled"]).toBe("true");
    expect(buttons(state)[7]!.tabIndex).toBe(undefined);
  });

  it("should support invalid state", () => {
    const value = startOfWeek(startOfMonth(today(getLocalTimeZone())), "en-US").add({ days: 7 });
    const state = createCalendarState({ ...base, isInvalid: true, value: signal<string | null>(stringifyDateValue(value)) });
    const { month } = grid(state);
    const key = cells(state)[7]!;
    expect(cellButtonAttributes(state, key, month)["aria-invalid"]).toBe("true");
    expect(cellButtonAttributes(state, key, month)["data-invalid"]).toBe("true");
    expect(gridCellAttributes(state, key, month)["aria-invalid"]).toBe("true");
  });

  it("should support weekdayStyle", () => {
    const state = createCalendarState(base);
    expect(weekDays(state, "short")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("should support month and year dropdowns", () => {
    const state = createCalendarState({ ...base, defaultFocusedValue: new CalendarDate(2026, 4, 1) });
    let month = calendarMonthPicker(state);
    expect(month["aria-label"]).toBe("month");
    expect(gridAriaLabel(state, gridStartDate(state), "Appointment date")).toBe("Appointment date, April 2026");
    expect(month.value).toBe(4);
    expect(month.items.map((o) => o.formatted)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
    month.onChange("6");
    month = calendarMonthPicker(state);
    expect(month.value).toBe(6);
    expect(gridAriaLabel(state, gridStartDate(state), "Appointment date")).toBe("Appointment date, June 2026");

    let year = calendarYearPicker(state);
    expect(year["aria-label"]).toBe("year");
    expect(year.value).toBe(10);
    expect(year.items.map((o) => o.formatted)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 2016)));
    year.onChange(String(year.items.findIndex((o) => o.formatted === "2030")));
    year = calendarYearPicker(state);
    expect(year.value).toBe(10);
    expect(year.items.map((o) => o.formatted)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 2020)));
    expect(gridAriaLabel(state, gridStartDate(state), "Appointment date")).toBe("Appointment date, June 2030");
  });

  it("should support weeksInMonth prop", () => {
    const state = createCalendarState({ ...base, weeksInMonth: 6, defaultFocusedValue: new CalendarDate(2026, 4, 1) });
    expect(grid(state).weeks).toHaveLength(6);
  });

  it("should support week view", () => {
    const state = createCalendarState({ ...base, visibleDuration: { weeks: 1 }, defaultFocusedValue: new CalendarDate(2026, 4, 1) });
    expect(grid(state).weeks).toHaveLength(1);
    expect(ws(calendarHeading(state))).toBe("March 29 – April 4, 2026");
  });

  it("should support day view", () => {
    const state = createCalendarState({ ...base, visibleDuration: { days: 2 }, defaultFocusedValue: new CalendarDate(2026, 4, 1) });
    expect(grid(state).weeks).toHaveLength(1);
    expect(cells(state)).toHaveLength(2);
    expect(ws(calendarHeading(state))).toBe("April 1 – 2, 2026");
  });

  it("should handle changing the visible duration", () => {
    // Rivet: props are fixed per render; a different visibleDuration is a new state.
    expect(ws(calendarHeading(createCalendarState({ ...base, visibleDuration: { weeks: 1 }, defaultFocusedValue: new CalendarDate(2026, 4, 7) })))).toBe(
      "April 5 – 11, 2026",
    );
    expect(calendarHeading(createCalendarState({ ...base, visibleDuration: { months: 1 }, defaultFocusedValue: new CalendarDate(2026, 4, 7) }))).toBe(
      "April 2026",
    );
  });

  it("should use getFormattableMonth for CalendarHeading with a custom calendar", () => {
    const state = createCalendarState({ ...base, defaultFocusedValue: new CalendarDate(2022, 2, 3), createCalendar: () => new Custom454Calendar() });
    expect(calendarHeading(state)).toBe("February 2022");
  });

  it("should use getFormattableMonth for CalendarMonthPicker with a custom calendar", () => {
    const state = createCalendarState({ ...base, defaultFocusedValue: new CalendarDate(2022, 1, 30), createCalendar: () => new Custom454Calendar() });
    const month = calendarMonthPicker(state);
    expect(month.items[month.value - 1]!.formatted).toBe("Feb");
    expect(month.items.map((o) => o.formatted)).toEqual(["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"]);
  });

  it("supports minValue and maxValue", () => {
    const years = (options: Parameters<typeof createCalendarState>[0], visibleYears?: number) =>
      calendarYearPicker(createCalendarState({ ...base, ...options }), { visibleYears });
    expect(years({ maxValue: new CalendarDate(2026, 6, 30) }).items.map((o) => o.formatted)).toEqual(
      Array.from({ length: 20 }, (_, i) => String(2026 - i)).reverse(),
    );
    expect(years({ minValue: new CalendarDate(2020, 6, 30) }).items.map((o) => o.formatted)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 2020)));
    expect(years({ minValue: new CalendarDate(2020, 6, 30), maxValue: new CalendarDate(2026, 6, 30) }).items.map((o) => o.formatted)).toEqual(
      Array.from({ length: 7 }, (_, i) => String(i + 2020)),
    );
    const cross = years({ minValue: new CalendarDate(2024, 8, 3), maxValue: new CalendarDate(2025, 2, 3), focusedValue: signal("2025-02-01") });
    expect(cross.items.map((o) => o.formatted)).toEqual(["2024", "2025"]);
    expect(cross.value).toBe(1);
    expect(cross.items[1]!.date.toString()).toBe("2025-02-03");
    expect(years({ defaultFocusedValue: new CalendarDate(2026, 6, 30) }, 1).items.map((o) => o.formatted)).toEqual(["2026"]);
  });

  it("first day of week follows the locale", () => {
    expect(weekDays(createCalendarState({ locale: "en-US" }), "short")[0]).toBe("Sun");
    expect(weekDays(createCalendarState({ locale: "fr-FR" }), "short")[0]).toBe("lun.");
    expect(weekDays(createCalendarState({ locale: "en-US", firstDayOfWeek: "mon" }), "short")[0]).toBe("Mon");
  });
});

describe("RangeCalendar (RAC)", () => {
  it("should support multi-month calendars", () => {
    const state = createRangeCalendarState({ ...base, defaultFocusedValue: new CalendarDate(2026, 4, 1), visibleDuration: { months: 2 } });
    expect(gridAriaLabel(state, gridStartDate(state), "Trip dates")).toBe("Trip dates, April 2026");
    expect(gridAriaLabel(state, gridStartDate(state, { months: 1 }), "Trip dates")).toBe("Trip dates, May 2026");
  });

  it("should support selected range states", () => {
    const state = createRangeCalendarState({ ...base, defaultValue: { start: new CalendarDate(2026, 4, 8), end: new CalendarDate(2026, 4, 11) } });
    const { month } = grid(state);
    const at = (key: string) => cellButtonAttributes(state, key, month);
    expect(at("2026-04-07")["data-selected"]).toBe(undefined);
    expect(at("2026-04-08")["data-selected"]).toBe("true");
    expect(at("2026-04-08")["data-selection-start"]).toBe("true");
    expect(at("2026-04-09")["data-selection-start"]).toBe(undefined);
    expect(at("2026-04-11")["data-selection-end"]).toBe("true");
    expect(String(at("2026-04-08")["aria-label"])).toContain("Selected Range: Wednesday, April 8 to Saturday, April 11, 2026");
  });

  it("should support unavailable state", () => {
    const state = createRangeCalendarState({ ...base, isDateUnavailable: () => true });
    expect(buttons(state)[7]!["data-unavailable"]).toBe("true");
  });

  it("should support week and day views", () => {
    const week = createRangeCalendarState({ ...base, visibleDuration: { weeks: 1 }, defaultFocusedValue: new CalendarDate(2026, 4, 1) });
    expect(grid(week).weeks).toHaveLength(1);
    const day = createRangeCalendarState({ ...base, visibleDuration: { days: 2 }, defaultFocusedValue: new CalendarDate(2026, 4, 1) });
    expect(cells(day)).toHaveLength(2);
  });
});

describe("cell keys", () => {
  it("are Gregorian ISO dates in any display calendar", () => {
    const state = createCalendarState({ locale: "th-TH-u-ca-buddhist", defaultValue: "2026-10-14" });
    expect(focusedDate(state).calendar.identifier).toBe("buddhist");
    expect(cellKey(focusedDate(state))).toBe("2026-10-14");
    expect(cells(state)).toContain("2026-10-14");
    expect(getWeeksInMonth(state, visibleRange(state).start)).toBe(grid(state).weeks.length);
    expect(getDatesInWeek(state, 0, visibleRange(state).start)).toHaveLength(7);
  });
});
