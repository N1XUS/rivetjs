// Ported from react-stately test/calendar/useCalendarState.test.ts (react-spectrum, Apache-2.0,
// © Adobe), plus state-level cases of the react-aria useCalendar / RAC Calendar suites that need no
// DOM (focus movement, paging, min / max, range anchoring). `renderHook` + `act` → a plain state
// object and direct calls; `result.current.x` → accessor functions.
import { describe, it, expect } from "@rivetjs/testing/jest";
import { CalendarDate, CalendarDateTime, toCalendar, createCalendar, type DateValue } from "@rivetjs/cdk/date";
import {
  calendarValue,
  createCalendarState,
  createRangeCalendarState,
  focusedDate,
  focusNextDay,
  focusNextPage,
  focusNextRow,
  focusNextSection,
  focusPreviousPage,
  focusPreviousSection,
  focusSectionEnd,
  focusSectionStart,
  getDatesInWeek,
  getWeeksInMonth,
  highlightedRange,
  isCellDisabled,
  isNextVisibleRangeInvalid,
  isPreviousVisibleRangeInvalid,
  isSelected,
  isValueInvalid,
  rangeDateValue,
  selectDate,
  selectFocusedDate,
  setFocusedDate,
  visibleRange,
} from "../state/calendar.ts";

const value = (state: Parameters<typeof calendarValue>[0]) => calendarValue(state) as CalendarDate | null;

describe("useCalendarState", () => {
  describe("selectDate", () => {
    // https://github.com/adobe/react-spectrum/issues/7779
    const selectedDate = new CalendarDate(2026, 4, 15);

    it("selects a date before the visible range when isDateUnavailable is provided", () => {
      const state = createCalendarState({ locale: "en-US", isDateUnavailable: () => false, defaultFocusedValue: selectedDate });
      // Navigate to the next month so the selected date is before the visible range.
      focusNextPage(state);
      expect(visibleRange(state).start.compare(selectedDate)).toBeGreaterThan(0);
      // Selecting a date before the visible range should still work.
      selectDate(state, selectedDate);
      expect(value(state)).not.toBe(null);
      expect(value(state)!.compare(selectedDate)).toBe(0);
    });

    it("selects a date after the visible range when isDateUnavailable is provided", () => {
      const state = createCalendarState({ locale: "en-US", isDateUnavailable: () => false, defaultFocusedValue: selectedDate });
      focusPreviousPage(state);
      expect(visibleRange(state).end.compare(selectedDate)).toBeLessThan(0);
      selectDate(state, selectedDate);
      expect(value(state)).not.toBe(null);
      expect(value(state)!.compare(selectedDate)).toBe(0);
    });

    it("selects the nearest earlier available date when the selected date is unavailable", () => {
      const state = createCalendarState({ locale: "en-US", isDateUnavailable: (date) => date.day === 15, defaultFocusedValue: new CalendarDate(2026, 4, 20) });
      selectDate(state, new CalendarDate(2026, 4, 15));
      expect(value(state)).not.toBe(null);
      expect(value(state)!.compare(new CalendarDate(2026, 4, 14))).toBe(0);
    });

    it("returns null when there is no available date between the selected date and the start of the visible range", () => {
      const state = createCalendarState({ locale: "en-US", isDateUnavailable: (date) => date.day <= 15, defaultFocusedValue: new CalendarDate(2026, 4, 20) });
      selectDate(state, new CalendarDate(2026, 4, 15));
      expect(value(state)).toBe(null);
    });
  });

  describe("focus movement", () => {
    it("moves by day, week, section and page; the visible range follows focus", () => {
      const state = createCalendarState({ locale: "en-US", defaultValue: new CalendarDate(2019, 6, 5) });
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 6, 5));
      expect(visibleRange(state)).toEqual({ start: new CalendarDate(2019, 6, 1), end: new CalendarDate(2019, 6, 30) });
      focusNextDay(state);
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 6, 6));
      focusNextRow(state);
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 6, 13));
      focusSectionEnd(state);
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 6, 30));
      focusNextDay(state);
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 7, 1));
      expect(visibleRange(state).start).toEqual(new CalendarDate(2019, 7, 1));
      focusSectionStart(state);
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 7, 1));
      focusNextSection(state);
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 8, 1));
      focusNextSection(state, true);
      expect(focusedDate(state)).toEqual(new CalendarDate(2020, 8, 1));
      focusPreviousSection(state, true);
      focusPreviousSection(state);
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 7, 1));
      focusNextPage(state);
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 8, 1));
      expect(visibleRange(state).start).toEqual(new CalendarDate(2019, 8, 1));
    });

    it("pages by the visible duration, or one unit with pageBehavior=single", () => {
      const visible = createCalendarState({ locale: "en-US", visibleDuration: { months: 3 }, defaultValue: new CalendarDate(2019, 6, 5) });
      expect(visibleRange(visible)).toEqual({ start: new CalendarDate(2019, 5, 1), end: new CalendarDate(2019, 7, 31) });
      focusNextPage(visible);
      expect(visibleRange(visible).start).toEqual(new CalendarDate(2019, 8, 1));
      const single = createCalendarState({
        locale: "en-US",
        visibleDuration: { months: 3 },
        pageBehavior: "single",
        defaultValue: new CalendarDate(2019, 6, 5),
      });
      focusNextPage(single);
      expect(visibleRange(single).start).toEqual(new CalendarDate(2019, 6, 1));
      expect(focusedDate(single)).toEqual(new CalendarDate(2019, 7, 5));
    });

    it("constrains focus to min / max and flags the visible-range edges", () => {
      const state = createCalendarState({
        locale: "en-US",
        defaultValue: new CalendarDate(2019, 2, 10),
        minValue: new CalendarDate(2019, 2, 3),
        maxValue: new CalendarDate(2019, 2, 20),
      });
      expect(isPreviousVisibleRangeInvalid(state)).toBe(true);
      expect(isNextVisibleRangeInvalid(state)).toBe(true);
      setFocusedDate(state, new CalendarDate(2019, 1, 1));
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 2, 3));
      focusNextPage(state);
      expect(focusedDate(state)).toEqual(new CalendarDate(2019, 2, 20));
      expect(isCellDisabled(state, new CalendarDate(2019, 2, 2))).toBe(true);
      expect(isCellDisabled(state, new CalendarDate(2019, 2, 21))).toBe(true);
      expect(isCellDisabled(state, new CalendarDate(2019, 2, 12))).toBe(false);
    });

    it("weeks of the visible month follow the locale's first day of week", () => {
      const us = createCalendarState({ locale: "en-US", defaultValue: new CalendarDate(2019, 6, 5) });
      expect(getWeeksInMonth(us)).toBe(6);
      expect(getDatesInWeek(us, 0)[0]).toEqual(new CalendarDate(2019, 5, 26));
      const de = createCalendarState({ locale: "de-DE", defaultValue: new CalendarDate(2019, 6, 5) });
      expect(getWeeksInMonth(de)).toBe(5);
      expect(getDatesInWeek(de, 0)[0]).toEqual(new CalendarDate(2019, 5, 27));
      const fw = createCalendarState({ locale: "en-US", firstDayOfWeek: "mon", defaultValue: new CalendarDate(2019, 6, 5) });
      expect(getDatesInWeek(fw, 0)[0]).toEqual(new CalendarDate(2019, 5, 27));
    });
  });

  describe("value", () => {
    it("keeps the calendar and time of the original value", () => {
      const state = createCalendarState({ locale: "en-US", defaultValue: new CalendarDateTime(2019, 6, 5, 8, 30) });
      let emitted: DateValue | null = null;
      const withChange = createCalendarState({ locale: "en-US", defaultValue: new CalendarDateTime(2019, 6, 5, 8, 30), onChange: (v) => (emitted = v) });
      selectDate(withChange, new CalendarDate(2019, 6, 10));
      expect(emitted).toEqual(new CalendarDateTime(2019, 6, 10, 8, 30));
      expect(value(state)).toEqual(new CalendarDate(2019, 6, 5));
      const japanese = toCalendar(new CalendarDate(2019, 6, 5), createCalendar("japanese"));
      const jp = createCalendarState({ locale: "en-US", defaultValue: japanese, onChange: (v) => (emitted = v) });
      selectDate(jp, new CalendarDate(2019, 6, 10));
      expect((emitted as unknown as CalendarDate).calendar.identifier).toBe("japanese");
    });

    it("displays the locale's calendar system", () => {
      const state = createCalendarState({ locale: "th-TH", defaultValue: new CalendarDate(2019, 6, 5) });
      expect(focusedDate(state).calendar.identifier).toBe("buddhist");
      expect(focusedDate(state).year).toBe(2562);
      let emitted: CalendarDate | null = null;
      const withChange = createCalendarState({ locale: "th-TH", defaultValue: new CalendarDate(2019, 6, 5), onChange: (v) => (emitted = v) });
      selectFocusedDate(withChange);
      expect(emitted!.calendar.identifier).toBe("gregory");
    });

    it("multiple selection toggles dates", () => {
      const seen: DateValue[][] = [];
      const state = createCalendarState({
        locale: "en-US",
        selectionMode: "multiple",
        defaultFocusedValue: new CalendarDate(2019, 6, 5),
        onChange: (v) => seen.push(v),
      });
      selectDate(state, new CalendarDate(2019, 6, 5));
      selectDate(state, new CalendarDate(2019, 6, 7));
      expect(calendarValue(state)).toEqual([new CalendarDate(2019, 6, 5), new CalendarDate(2019, 6, 7)]);
      selectDate(state, new CalendarDate(2019, 6, 5));
      expect(calendarValue(state)).toEqual([new CalendarDate(2019, 6, 7)]);
      expect(seen.length).toBe(3);
    });

    it("read only and disabled ignore selection; unavailable values are invalid", () => {
      const ro = createCalendarState({ locale: "en-US", isReadOnly: true, defaultFocusedValue: new CalendarDate(2019, 6, 5) });
      selectFocusedDate(ro);
      expect(value(ro)).toBe(null);
      const unavailable = createCalendarState({ locale: "en-US", defaultValue: new CalendarDate(2019, 6, 5), isDateUnavailable: (d) => d.day === 5 });
      expect(isValueInvalid(unavailable)).toBe(true);
      const outside = createCalendarState({ locale: "en-US", defaultValue: new CalendarDate(2019, 6, 5), maxValue: new CalendarDate(2019, 6, 1) });
      expect(isValueInvalid(outside)).toBe(true);
    });
  });
});

describe("useRangeCalendarState", () => {
  it("anchors on the first selection and completes on the second (ordered)", () => {
    let emitted: unknown = null;
    const state = createRangeCalendarState({ locale: "en-US", defaultFocusedValue: new CalendarDate(2019, 6, 10), onChange: (v) => (emitted = v) });
    selectDate(state, new CalendarDate(2019, 6, 10));
    setFocusedDate(state, new CalendarDate(2019, 6, 4));
    expect(highlightedRange(state)).toEqual({ start: new CalendarDate(2019, 6, 4), end: new CalendarDate(2019, 6, 10) });
    expect(isSelected(state, new CalendarDate(2019, 6, 7))).toBe(true);
    selectFocusedDate(state);
    expect(emitted).toEqual({ start: new CalendarDate(2019, 6, 4), end: new CalendarDate(2019, 6, 10) });
    expect(rangeDateValue(state)).toEqual({ start: new CalendarDate(2019, 6, 4), end: new CalendarDate(2019, 6, 10) });
  });

  it("contiguous ranges stop at unavailable dates around the anchor", () => {
    const state = createRangeCalendarState({
      locale: "en-US",
      defaultFocusedValue: new CalendarDate(2019, 6, 10),
      isDateUnavailable: (date) => date.day === 14 || date.day === 6,
    });
    selectDate(state, new CalendarDate(2019, 6, 10));
    setFocusedDate(state, new CalendarDate(2019, 6, 20));
    expect(focusedDate(state)).toEqual(new CalendarDate(2019, 6, 13));
    setFocusedDate(state, new CalendarDate(2019, 6, 1));
    expect(focusedDate(state)).toEqual(new CalendarDate(2019, 6, 7));
    expect(isCellDisabled(state, new CalendarDate(2019, 6, 16))).toBe(true);
  });

  it("aligns the visible range to the start when the value is longer than the visible duration", () => {
    const state = createRangeCalendarState({ locale: "en-US", defaultValue: { start: new CalendarDate(2019, 6, 10), end: new CalendarDate(2019, 8, 2) } });
    expect(visibleRange(state).start).toEqual(new CalendarDate(2019, 6, 1));
  });
});

// Ported from react-aria-components test/Calendar.test.js `selectDate` (state-level: the story
// buttons call `state.selectDate`; Next / Previous = `focusNextPage` / `focusPreviousPage`).
describe("Calendar selectDate (RAC)", () => {
  const focused = new CalendarDate(2026, 4, 15);
  const valueText = (state: ReturnType<typeof createCalendarState>) => {
    const value = calendarValue(state);
    return value ? value.toString() : "none";
  };

  it("selects a date before the visible range when isDateUnavailable is provided", () => {
    const state = createCalendarState({ locale: "en-US", defaultFocusedValue: focused, isDateUnavailable: () => false });
    focusNextPage(state);
    selectDate(state, focused);
    expect(valueText(state)).toBe(focused.toString());
    selectDate(state, focused.subtract({ months: 1 }));
    expect(valueText(state)).toBe(focused.subtract({ months: 1 }).toString());
  });

  it("selects a date after the visible range when isDateUnavailable is provided", () => {
    const state = createCalendarState({ locale: "en-US", defaultFocusedValue: focused, isDateUnavailable: () => false });
    focusPreviousPage(state);
    selectDate(state, focused);
    expect(valueText(state)).toBe(focused.toString());
    selectDate(state, focused.add({ months: 1 }));
    expect(valueText(state)).toBe(focused.add({ months: 1 }).toString());
  });

  it("selects the nearest earlier available date when the focused date is unavailable", () => {
    const state = createCalendarState({ locale: "en-US", defaultFocusedValue: focused, isDateUnavailable: (d) => d.day === focused.day });
    selectDate(state, focused);
    expect(valueText(state)).toBe(focused.subtract({ days: 1 }).toString());
  });

  it("does not select anything when the focused date is unavailable and no earlier date in the visible range is available", () => {
    const state = createCalendarState({ locale: "en-US", defaultFocusedValue: focused, isDateUnavailable: (d) => d.day <= focused.day });
    selectDate(state, focused);
    expect(valueText(state)).toBe("none");
  });
});
