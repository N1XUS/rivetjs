// `@rivetjs/cdk/scheduler` state + intl (`scheduler/state.ts`, `scheduler/intl.ts`; port of the @malva-ui/scheduler
// `MlvScheduler` models / computeds / public methods and the malva i18n `scheduler` sections, MIT, © 2026 Malva UI):
// controllable values, derived functions, navigation, `onVisibleRangeChange` on bound changes only, `commitChange`
// (new array, veto, announcements, write-back form), resume-table round trip, 14-locale tables + plural selection.
import { describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { CalendarDateTime } from "../date/CalendarDate.ts";
import { dayFromCivil } from "../scheduler/dates.ts";
import { schedulerMessages, schedulerString, schedulerStrings } from "../scheduler/intl.ts";
import type { SchedulerEvent, SchedulerVisibleRange } from "../scheduler/layout.ts";
import {
  commitChange,
  commitSelection,
  isCellSelected,
  schedulerDaysKey,
  schedulerSelectionBounds,
  consumeScrollRequest,
  createSchedulerState,
  isoWeekNumber,
  schedulerAnnounce,
  schedulerDayRange,
  schedulerDays,
  schedulerFirstDay,
  schedulerGoTo,
  schedulerMonthLayout,
  schedulerNext,
  schedulerNormalizedEvents,
  schedulerPrevious,
  schedulerScrollToTime,
  schedulerSetView,
  schedulerTimeGridLayout,
  schedulerTimeWindow,
  schedulerTimeZone,
  schedulerTitle,
  schedulerToday,
  schedulerVisibleRange,
  schedulerWeekendDays,
  schedulerWithPreview,
  GHOST_SUFFIX,
} from "../scheduler/state.ts";
import { jsonRoundTrip } from "./state-json.ts";

const day = (y: number, m: number, d: number) => dayFromCivil(y, m, d);
const events = (): SchedulerEvent[] => [
  { id: "a", title: "Standup", start: "2026-09-08T09:00", end: "2026-09-08T09:30" },
  { id: "b", title: "Offsite", start: "2026-09-09", end: "2026-09-11", allDay: true },
  { id: "c", title: "Review", start: new CalendarDateTime(2026, 9, 8, 9, 15), end: new CalendarDateTime(2026, 9, 8, 10, 0) },
];

describe("scheduler state: values", () => {
  it("defaults: month view, today as a date string, empty events", () => {
    const state = createSchedulerState({ timeZone: "UTC" });
    expect(state.view.value()).toBe("month");
    expect(state.date.value()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.events.value()).toEqual([]);
  });

  it("uncontrolled defaults update in place; onChange handlers fire", () => {
    const onViewChange = vi.fn();
    const onDateChange = vi.fn();
    const state = createSchedulerState({ timeZone: "UTC", defaultView: "week", defaultDate: "2026-09-08", onViewChange, onDateChange });
    schedulerSetView(state, "day");
    schedulerNext(state);
    expect(state.view.value()).toBe("day");
    expect(state.date.value()).toBe("2026-09-09");
    expect(onViewChange).toHaveBeenCalledWith("day");
    expect(onDateChange).toHaveBeenCalledWith("2026-09-09");
  });

  it("two-way Signals are written", () => {
    const view = signal<"month" | "week" | "day">("week");
    const date = signal<string>("2026-09-08");
    const state = createSchedulerState({ timeZone: "UTC", view, date });
    schedulerNext(state);
    expect(date()).toBe("2026-09-15");
    schedulerSetView(state, "month");
    expect(view()).toBe("month");
  });

  it("accessor values stay controlled (only onChange)", () => {
    const current = signal("2026-09-08");
    const onDateChange = vi.fn();
    const state = createSchedulerState({ timeZone: "UTC", view: "day", date: () => current(), onDateChange });
    schedulerNext(state);
    expect(onDateChange).toHaveBeenCalledWith("2026-09-09");
    expect(state.date.value()).toBe("2026-09-08");
    current.set("2026-09-20");
    expect(schedulerDayRange(state).start).toBe(day(2026, 9, 20));
  });

  it("options are live (accessors read where used)", () => {
    const locale = signal("en-US");
    const hidden = signal<number[]>([]);
    const state = createSchedulerState({ timeZone: "UTC", defaultDate: "2026-09-08", locale: () => locale(), hiddenDays: () => hidden() });
    expect(schedulerFirstDay(state)).toBe(0);
    locale.set("de-DE");
    expect(schedulerFirstDay(state)).toBe(1);
    expect(schedulerDays(state)).toHaveLength(35);
    hidden.set([0, 6]);
    expect(schedulerDays(state)).toHaveLength(25);
  });

  it("first day / weekend from the locale or the options", () => {
    expect(schedulerFirstDay(createSchedulerState({ locale: "en-US" }))).toBe(0);
    expect(schedulerFirstDay(createSchedulerState({ locale: "fr-FR" }))).toBe(1);
    expect(schedulerFirstDay(createSchedulerState({ locale: "en-US", firstDayOfWeek: "wed" }))).toBe(3);
    expect(schedulerWeekendDays(createSchedulerState({ locale: "en-US" }))).toEqual([0, 6]);
    expect(schedulerWeekendDays(createSchedulerState({ locale: "he-IL" }))).toEqual([5, 6]);
    expect(schedulerWeekendDays(createSchedulerState({ weekendDays: [5] }))).toEqual([5]);
  });

  it("serializes: every signal value survives a resume-table round trip", () => {
    const state = createSchedulerState({ timeZone: "UTC", defaultDate: "2026-09-08", defaultEvents: [events()[0]!, events()[1]!], locale: "en-US" });
    state.selection.set({ anchor: { dayIndex: 1, minutes: 540 }, head: { dayIndex: 2, minutes: 600 }, key: "7:20000" });
    state.dragPreview.set({ id: "a", start: 100, end: 160, allDay: false });
    schedulerScrollToTime(state, "08:00");
    state.pendingFocus.set({ eventId: "a", day: 20_000, minutes: null });
    schedulerAnnounce(state, "hello");
    const copy = jsonRoundTrip(state);
    for (const key of ["selection", "dragPreview", "dragging", "scrollRequest", "pendingFocus", "popoverDay", "announcement"] as const)
      expect(copy[key]()).toEqual(JSON.parse(JSON.stringify(state[key]())));
    expect(copy.date.value()).toBe("2026-09-08");
    expect(copy.view.value()).toBe("month");
    expect(copy.events.value()).toEqual(state.events.value());
    expect(copy.zone).toBe("UTC");
  });

  it("keeps the zone resolved at creation as region state (server: UTC); a timeZone option wins", () => {
    // Node = the server: no `timeZone` lays out in UTC and the resumed page keeps that zone (`state.zone`), instead of
    // re-reading the browser's local zone on its first recompute.
    const state = createSchedulerState({ defaultEvents: [events()[0]!] });
    expect(state.zone).toBe("UTC");
    expect(jsonRoundTrip(state).zone).toBe("UTC");
    const zone = signal<string | undefined>(undefined);
    const live = createSchedulerState({ timeZone: () => zone() });
    expect(schedulerTimeZone(live)).toBe("UTC");
    zone.set("Asia/Tokyo");
    expect(schedulerTimeZone(live)).toBe("Asia/Tokyo");
    zone.set(undefined);
    expect(schedulerTimeZone(live)).toBe(live.zone);
  });
});

describe("scheduler state: derived", () => {
  it("visible range: month = whole weeks, week, day; dates in the anchor's form", () => {
    const state = createSchedulerState({ timeZone: "UTC", locale: "en-US", defaultDate: "2026-09-08" });
    expect(schedulerVisibleRange(state)).toEqual({ view: "month", start: "2026-08-30", end: "2026-10-04" });
    schedulerSetView(state, "week");
    expect(schedulerVisibleRange(state)).toEqual({ view: "week", start: "2026-09-06", end: "2026-09-13" });
    schedulerSetView(state, "day");
    expect(schedulerVisibleRange(state)).toEqual({ view: "day", start: "2026-09-08", end: "2026-09-09" });
    const instance = createSchedulerState({ timeZone: "UTC", defaultView: "day", defaultDate: new CalendarDateTime(2026, 9, 8, 10, 0) });
    expect(String(schedulerVisibleRange(instance).start)).toBe("2026-09-08T00:00:00");
  });

  it("day view on a hidden weekday still renders the anchor", () => {
    const state = createSchedulerState({ timeZone: "UTC", defaultView: "day", defaultDate: "2026-09-12", hiddenDays: [0, 6] });
    expect(schedulerDays(state)).toEqual([day(2026, 9, 12)]);
  });

  it("titles per view", () => {
    const state = createSchedulerState({ timeZone: "UTC", locale: "en-US", defaultDate: "2026-09-08" });
    expect(schedulerTitle(state)).toBe("September 2026");
    schedulerSetView(state, "week");
    expect(schedulerTitle(state)).toBe("Sep 6 – Sep 12, 2026");
    schedulerSetView(state, "day");
    expect(schedulerTitle(state)).toBe("Tuesday, September 8, 2026");
  });

  it("time window: defaults, validation (malva throw text)", () => {
    expect(schedulerTimeWindow(createSchedulerState())).toEqual({ min: 0, max: 1440 });
    expect(schedulerTimeWindow(createSchedulerState({ minTime: "08:00", maxTime: "18:30" }))).toEqual({ min: 480, max: 1110 });
    expect(() => schedulerTimeWindow(createSchedulerState({ minTime: "18:00", maxTime: "08:00" }))).toThrow(
      'Invalid scheduler time window "18:00"–"08:00". minTime must be earlier than maxTime.',
    );
  });

  it("month layout: lanes per row, overflow beyond visibleLanes", () => {
    const list: SchedulerEvent[] = [];
    for (let i = 0; i < 5; i++) list.push({ id: "e" + i, title: "E" + i, start: "2026-09-08T0" + i + ":00", end: "2026-09-08T0" + i + ":30" });
    const state = createSchedulerState({ timeZone: "UTC", defaultDate: "2026-09-08", defaultEvents: list, locale: "en-US" });
    const rows = schedulerMonthLayout(schedulerNormalizedEvents(state), schedulerDays(state), 7, 3);
    expect(rows).toHaveLength(5);
    const row = rows[1]!;
    expect(row.startIndex).toBe(7);
    expect(row.segments).toHaveLength(5);
    expect(row.layout.visible.length).toBeLessThanOrEqual(3);
    expect(row.layout.laneCount).toBe(5);
    expect(row.layout.hiddenByDay.get(9)?.length).toBeGreaterThan(0);
  });

  it("time-grid layout: all-day band + clustered columns", () => {
    const state = createSchedulerState({ timeZone: "UTC", defaultView: "week", defaultDate: "2026-09-08", defaultEvents: events(), locale: "en-US" });
    const layout = schedulerTimeGridLayout(schedulerNormalizedEvents(state), schedulerDays(state), schedulerTimeWindow(state), 3);
    expect(layout.allDaySegments.map((s) => s.normalized.event.id)).toEqual(["b"]);
    const tuesday = layout.columns[2]!;
    expect(tuesday.map((s) => s.normalized.event.id).sort()).toEqual(["a", "c"]);
    expect(new Set(tuesday.map((s) => s.column)).size).toBe(2);
  });

  it("drag preview adds a ghost copy", () => {
    const state = createSchedulerState({ timeZone: "UTC", defaultEvents: events() });
    const normalized = schedulerNormalizedEvents(state);
    expect(schedulerWithPreview(state, normalized)).toBe(normalized);
    state.dragPreview.set({ id: "a", start: 10, end: 20, allDay: false });
    const withGhost = schedulerWithPreview(state, normalized);
    expect(withGhost).toHaveLength(4);
    expect(withGhost[3]).toMatchObject({ ghost: true, start: 10, end: 20, event: { id: "a" + GHOST_SUFFIX } });
  });

  it("ISO week numbers", () => {
    expect(isoWeekNumber(day(2026, 1, 1))).toBe(1);
    expect(isoWeekNumber(day(2027, 1, 1))).toBe(53);
    expect(isoWeekNumber(day(2026, 9, 8))).toBe(37);
  });
});

describe("scheduler state: navigation", () => {
  it("month steps keep the day, clamped to the month length", () => {
    const state = createSchedulerState({ timeZone: "UTC", defaultDate: "2026-01-31" });
    schedulerNext(state);
    expect(state.date.value()).toBe("2026-02-28");
    schedulerPrevious(state);
    expect(state.date.value()).toBe("2026-01-28");
    schedulerGoTo(state, "2026-12-15");
    schedulerNext(state);
    expect(state.date.value()).toBe("2027-01-15");
  });

  it("day view skips hidden weekdays", () => {
    const state = createSchedulerState({ timeZone: "UTC", defaultView: "day", defaultDate: "2026-09-11", hiddenDays: [0, 6] });
    schedulerNext(state);
    expect(state.date.value()).toBe("2026-09-14");
    schedulerPrevious(state);
    expect(state.date.value()).toBe("2026-09-11");
  });

  it("instances keep their class (and time) on navigation", () => {
    const state = createSchedulerState({ timeZone: "UTC", defaultView: "week", defaultDate: new CalendarDateTime(2026, 9, 8, 10, 30) });
    schedulerNext(state);
    const value = state.date.value();
    expect(value).toBeInstanceOf(CalendarDateTime);
    expect(String(value)).toBe("2026-09-15T10:30:00");
  });

  it("today jumps to the current day", () => {
    const state = createSchedulerState({ timeZone: "UTC", defaultDate: "2000-01-01" });
    schedulerToday(state);
    expect(state.date.value()).toBe(new Date().toISOString().slice(0, 10));
  });

  it("onVisibleRangeChange: only when the bounds move, not on init; announced", () => {
    const ranges: SchedulerVisibleRange[] = [];
    const state = createSchedulerState({
      timeZone: "UTC",
      locale: "en-US",
      defaultDate: "2026-09-08",
      onVisibleRangeChange: (range) => ranges.push(range),
    });
    expect(ranges).toEqual([]);
    schedulerGoTo(state, "2026-09-20");
    expect(ranges).toEqual([]);
    schedulerNext(state);
    expect(ranges).toEqual([{ view: "month", start: "2026-09-27", end: "2026-11-01" }]);
    expect(state.announcement().join("")).toBe("Showing October 2026");
    schedulerSetView(state, "week");
    expect(ranges.at(-1)).toEqual({ view: "week", start: "2026-10-18", end: "2026-10-25" });
    schedulerSetView(state, "week");
    expect(ranges).toHaveLength(2);
  });

  it("scroll requests carry a sequence; consuming an old one keeps a newer request", () => {
    const state = createSchedulerState();
    schedulerScrollToTime(state, "08:00");
    const first = state.scrollRequest()!;
    schedulerScrollToTime(state, "09:00");
    consumeScrollRequest(state, first.sequence);
    expect(state.scrollRequest()).toEqual({ time: "09:00", sequence: first.sequence + 1 });
    consumeScrollRequest(state, first.sequence + 1);
    expect(state.scrollRequest()).toBeNull();
  });

  it("the settled month view drops a scroll request; a same-task switch to week keeps it; setView(month) drops it", async () => {
    const view = signal<"month" | "week" | "day">("month");
    const state = createSchedulerState({ view });
    schedulerScrollToTime(state, "14:00");
    expect(state.scrollRequest()?.time).toBe("14:00"); // recorded at call time
    await Promise.resolve();
    expect(state.scrollRequest()).toBeNull(); // the month is the settled view
    schedulerScrollToTime(state, "14:00");
    view.set("week"); // same task: the time grid that appears applies it
    await Promise.resolve();
    expect(state.scrollRequest()?.time).toBe("14:00");
    schedulerSetView(state, "month");
    expect(state.scrollRequest()).toBeNull();
  });

  it("announcements alternate between the two regions", async () => {
    const state = createSchedulerState();
    schedulerAnnounce(state, "one");
    expect(state.announcement()).toEqual(["one", ""]);
    await Promise.resolve();
    schedulerAnnounce(state, "one");
    expect(state.announcement()).toEqual(["", "one"]);
    await Promise.resolve();
    schedulerAnnounce(state, "two");
    expect(state.announcement()).toEqual(["two", ""]);
  });

  it("keeps both messages announced in one task (malva `_liveBatch`)", async () => {
    const state = createSchedulerState();
    schedulerAnnounce(state, "moved");
    schedulerAnnounce(state, "Showing next week");
    expect(state.announcement()).toEqual(["moved", "Showing next week"]);
    await Promise.resolve();
    schedulerAnnounce(state, "again");
    expect(state.announcement()).toEqual(["again", ""]);
  });
});

describe("scheduler state: commitChange", () => {
  const normalized = (state: ReturnType<typeof createSchedulerState>, id: string) => schedulerNormalizedEvents(state).find((n) => n.event.id === id)!;
  const wall = (y: number, m: number, d: number, h = 0, min = 0) => day(y, m, d) * 1440 + h * 60 + min;

  it("move: new array, form kept, onEventsChange + onEventMove, announcement", () => {
    const initial = events();
    const onEventsChange = vi.fn();
    const onEventMove = vi.fn();
    const state = createSchedulerState({ timeZone: "UTC", locale: "en-US", defaultEvents: initial, onEventsChange, onEventMove });
    const ok = commitChange(state, {
      kind: "move",
      normalized: normalized(state, "a"),
      next: { start: wall(2026, 9, 9, 14), end: wall(2026, 9, 9, 14, 30), allDay: false },
      source: "pointer",
    });
    expect(ok).toBe(true);
    const next = state.events.value();
    expect(next).not.toBe(initial);
    expect(next[0]).toMatchObject({ id: "a", start: "2026-09-09T14:00:00", end: "2026-09-09T14:30:00", allDay: false });
    expect(next[1]).toBe(initial[1]);
    expect(onEventsChange).toHaveBeenCalledWith(next);
    expect(onEventMove.mock.calls[0]![0]).toMatchObject({
      event: { id: "a" },
      previous: { start: "2026-09-08T09:00", end: "2026-09-08T09:30" },
      source: "pointer",
    });
    expect(state.announcement().join("")).toBe("Standup moved to Sep 9, 2:00 PM");
  });

  it("resize of an instance event keeps the class; all-day announcement uses the last day", async () => {
    const onEventResize = vi.fn();
    const state = createSchedulerState({ timeZone: "UTC", locale: "en-US", defaultEvents: events(), onEventResize });
    commitChange(state, {
      kind: "resize",
      normalized: normalized(state, "c"),
      next: { start: wall(2026, 9, 8, 9, 15), end: wall(2026, 9, 8, 11), allDay: false },
      source: "keyboard",
    });
    const c = state.events.value()[2]!;
    expect(c.end).toBeInstanceOf(CalendarDateTime);
    expect(String(c.end)).toBe("2026-09-08T11:00:00");
    expect(onEventResize).toHaveBeenCalledOnce();
    await Promise.resolve(); // a later task: the new message empties the other region
    commitChange(state, {
      kind: "resize",
      normalized: normalized(state, "b"),
      next: { start: wall(2026, 9, 9), end: wall(2026, 9, 12), allDay: true },
      source: "pointer",
    });
    expect(state.events.value()[1]).toMatchObject({ start: "2026-09-09", end: "2026-09-12" });
    expect(state.announcement().join("")).toBe("Offsite now ends at Friday, September 11, 2026");
  });

  it("veto: nothing written, moveRejected announced", () => {
    const initial = events();
    const canMove = vi.fn((_event: SchedulerEvent, _range: unknown) => false);
    const state = createSchedulerState({ timeZone: "UTC", locale: "en-US", defaultEvents: initial, canMove });
    const ok = commitChange(state, {
      kind: "move",
      normalized: normalized(state, "a"),
      next: { start: wall(2026, 9, 10, 8), end: wall(2026, 9, 10, 8, 30), allDay: false },
      source: "pointer",
    });
    expect(ok).toBe(false);
    expect(state.events.value()).toBe(initial);
    expect(canMove.mock.calls[0]![1]).toEqual({ start: "2026-09-10T08:00:00", end: "2026-09-10T08:30:00", allDay: false });
    expect(state.announcement().join("")).toBe("Standup cannot be placed there");
  });

  it("controlled plain events: only onEventsChange", () => {
    const list = events();
    const onEventsChange = vi.fn();
    const state = createSchedulerState({ timeZone: "UTC", events: list, onEventsChange });
    commitChange(state, {
      kind: "move",
      normalized: normalized(state, "a"),
      next: { start: wall(2026, 9, 9, 9), end: wall(2026, 9, 9, 9, 30), allDay: false },
      source: "pointer",
    });
    expect(state.events.value()).toBe(list);
    expect(onEventsChange).toHaveBeenCalledOnce();
  });
});

describe("scheduler state: range selection (malva `_selectedBounds` / `_isSelected` / `_selectionRange`)", () => {
  const week = () => {
    const ranges: unknown[] = [];
    const state = createSchedulerState({
      timeZone: "UTC",
      defaultView: "week",
      defaultDate: "2031-03-04",
      firstDayOfWeek: "mon",
      locale: "en-US",
      onRangeSelect: (range) => ranges.push(range),
    });
    const key = schedulerDaysKey(schedulerDays(state));
    return { state, ranges, key };
  };

  it("orders a backwards multi-day drag by (day, minute), not per component", () => {
    const { state, ranges, key } = week();
    state.selection.set({ anchor: { dayIndex: 1, minutes: 840 }, head: { dayIndex: 2, minutes: 540 }, key });
    expect(schedulerSelectionBounds(state.selection(), schedulerDays(state))).toEqual({ allDay: false, dayFrom: 1, dayTo: 2, from: 840, to: 540 });
    commitSelection(state, "pointer");
    expect(ranges).toEqual([{ start: "2031-03-04T14:00:00", end: "2031-03-05T09:30:00", allDay: false, source: "pointer" }]);
    expect(state.selection()).toBeNull();
  });

  it("still normalizes a same-day upward drag", () => {
    const { state, ranges, key } = week();
    state.selection.set({ anchor: { dayIndex: 1, minutes: 840 }, head: { dayIndex: 1, minutes: 540 }, key });
    commitSelection(state, "pointer");
    expect(ranges).toEqual([{ start: "2031-03-04T09:00:00", end: "2031-03-04T14:30:00", allDay: false, source: "pointer" }]);
  });

  it("paints continuously across days, and all-day selections only on all-day cells", () => {
    const bounds = { allDay: false, dayFrom: 0, dayTo: 2, from: 540, to: 600 };
    expect(isCellSelected(bounds, 0, 510)).toBe(false);
    expect(isCellSelected(bounds, 0, 1410)).toBe(true);
    expect(isCellSelected(bounds, 1, 0)).toBe(true);
    expect(isCellSelected(bounds, 2, 600)).toBe(true);
    expect(isCellSelected(bounds, 2, 630)).toBe(false);
    expect(isCellSelected(bounds, 1, null)).toBe(false);
    const allDay = { allDay: true, dayFrom: 1, dayTo: 3, from: 0, to: 0 };
    expect(isCellSelected(allDay, 2, null)).toBe(true);
    expect(isCellSelected(allDay, 2, 600)).toBe(false);
  });

  it("all-day: midnight of the first day → midnight after the last; the last slot ends at the next midnight", () => {
    const { state, ranges, key } = week();
    state.selection.set({ anchor: { dayIndex: 3, minutes: null }, head: { dayIndex: 1, minutes: null }, key });
    commitSelection(state, "keyboard");
    state.selection.set({ anchor: { dayIndex: 4, minutes: 1410 }, head: { dayIndex: 4, minutes: 1410 }, key });
    commitSelection(state, "pointer");
    expect(ranges).toEqual([
      { start: "2031-03-04", end: "2031-03-07", allDay: true, source: "keyboard" },
      { start: "2031-03-07T23:30:00", end: "2031-03-08T00:00:00", allDay: false, source: "pointer" },
    ]);
  });

  it("a selection of other rendered days is stale (resets when the range changes)", () => {
    const { state, ranges, key } = week();
    state.selection.set({ anchor: { dayIndex: 1, minutes: 540 }, head: { dayIndex: 1, minutes: 600 }, key });
    schedulerNext(state);
    expect(schedulerSelectionBounds(state.selection(), schedulerDays(state))).toBeNull();
    commitSelection(state, "pointer");
    expect(ranges).toEqual([]);
  });
});

describe("scheduler intl", () => {
  it("14 locale tables with the same keys", () => {
    const locales = Object.keys(schedulerMessages);
    expect(locales).toHaveLength(14);
    const base = Object.keys(schedulerMessages["en-US"]!)
      .filter((k) => !/\.(one|two|few|many|zero)$/.test(k))
      .sort();
    for (const locale of locales) {
      const keys = Object.keys(schedulerMessages[locale]!);
      for (const key of base) expect(keys, `${locale} ${key}`).toContain(key);
    }
  });

  it("locale lookup falls back by language, then en-US; overrides on top", () => {
    expect(schedulerStrings("de-AT").today).toBe("Heute");
    expect(schedulerStrings("xx-YY").today).toBe("Today");
    expect(schedulerStrings("en-US", { today: "Now" }).today).toBe("Now");
  });

  it("plural variants via Intl.PluralRules (fallback .other)", () => {
    const en = schedulerStrings("en-US");
    expect(schedulerString(en, "moreEventsLabel", { count: 1, date: "Sep 8" }, "en-US")).toBe("1 more event on Sep 8");
    expect(schedulerString(en, "moreEventsLabel", { count: 3, date: "Sep 8" }, "en-US")).toBe("3 more events on Sep 8");
    const pl = schedulerStrings("pl-PL");
    const few = schedulerString(pl, "moreEventsLabel", { count: 3, date: "x" }, "pl-PL");
    const many = schedulerString(pl, "moreEventsLabel", { count: 5, date: "x" }, "pl-PL");
    expect(few).not.toBe(many);
    expect(schedulerString(schedulerStrings("ja-JP"), "moreEvents", { count: 2 }, "ja-JP")).toContain("2");
  });

  it("flat keys interpolate {name}", () => {
    expect(schedulerString(schedulerStrings("en-US"), "rangeChanged", { period: "May" }, "en-US")).toBe("Showing May");
    expect(schedulerString(schedulerStrings("de-DE"), "next.week", undefined, "de-DE")).toBe(schedulerMessages["de-DE"]!["next.week"]);
  });
});
