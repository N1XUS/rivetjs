// Ported from @malva-ui/scheduler (src/lib/layout/scheduler-layout.spec.ts), MIT, © 2026 Malva UI.
// Rivet: titles unchanged; `MlvNativeDateAdapter` + `Date` literals → `CalendarDateTime` fixtures read as layout
// integers (`w()` wall minutes, `dn()` day numbers). The daylight-saving case uses real America/New_York transitions
// (zoned strings) instead of malva's `ClockShiftAdapter`: the layout reads wall clocks, which is what it asserts.
import { describe, expect, it, beforeEach } from "vitest";
import {
  assignLanes,
  clusterColumns,
  computeVisibleRange,
  dayIndexOf,
  isLaneEvent,
  lastDayOf,
  layoutRow,
  resolveMove,
  resolveResize,
  rowLength,
  sliceColumns,
  sliceRows,
  spansMultipleDays,
  startOfWeek,
  visibleDays,
  type SchedulerEvent,
} from "../scheduler/layout.ts";
import { d, date, dn, ev, n, range, w } from "./scheduler-fixtures.ts";

describe("scheduler-layout: range and days", () => {
  it("finds the start of the week for Monday- and Sunday-first weeks", () => {
    expect(startOfWeek(dn(d(2)), 1)).toBe(dn(date(2026, 7, 31))); // Wed 2 Sep → Mon 31 Aug
    expect(startOfWeek(dn(d(2)), 0)).toBe(dn(date(2026, 7, 30)));
    expect(startOfWeek(dn(date(2026, 7, 31)), 1)).toBe(dn(date(2026, 7, 31)));
  });

  it("computes month / week / day ranges", () => {
    const month = computeVisibleRange("month", dn(d(15)), 1);
    expect(month.start).toBe(dn(date(2026, 7, 31))); // Sep 2026 starts on a Tuesday
    expect(month.end).toBe(dn(date(2026, 9, 5))); // Sep 30 is a Wednesday → week ends Sun Oct 4, exclusive Mon Oct 5
    const week = computeVisibleRange("week", dn(d(2, 13)), 1);
    expect(week.start).toBe(dn(date(2026, 7, 31)));
    expect(week.end).toBe(dn(d(7)));
    const day = computeVisibleRange("day", dn(d(2, 13)), 1);
    expect(day.start).toBe(dn(d(2)));
    expect(day.end).toBe(dn(d(3)));
    expect(day.view).toBe("day");
  });

  it("lists visible days, skipping hidden weekdays", () => {
    const week = computeVisibleRange("week", dn(d(2)), 1);
    expect(visibleDays(week, []).length).toBe(7);
    const working = visibleDays(week, [0, 6]);
    expect(working.length).toBe(5);
    expect(working[0]).toBe(dn(date(2026, 7, 31)));
    expect(working[4]).toBe(dn(d(4)));
    expect(rowLength([0, 6])).toBe(5);
    expect(rowLength([])).toBe(7);
    expect(rowLength([0, 0, 9])).toBe(6);
    expect(dayIndexOf(working, dn(d(2, 15)))).toBe(2);
    expect(dayIndexOf(working, dn(d(5)))).toBe(-1);
  });

  it("ignores a hiddenDays set covering every weekday", () => {
    // Hiding all seven would render nothing and make `rowLength` 0, which never terminates a
    // `row * rowLength < days.length` loop.
    const week = computeVisibleRange("week", dn(d(2)), 1);
    const all = [0, 1, 2, 3, 4, 5, 6];
    expect(visibleDays(week, all).length).toBe(7);
    expect(rowLength(all)).toBe(7);
  });

  it("drops hidden values that can never name a weekday", () => {
    // `dayOfWeek` only returns integers 0–6, so the two helpers must agree on which entries count.
    const week = computeVisibleRange("week", dn(d(2)), 1);
    expect(visibleDays(week, [2.5, 7, -1]).length).toBe(7);
    expect(rowLength([2.5, 7, -1])).toBe(7);
  });
});

describe("scheduler-layout: normalization", () => {
  it("repairs end <= start", () => {
    const timed = n(ev("a", d(2, 9), d(2, 9)), 60);
    expect(timed.end).toBe(w(d(2, 10)));
    const allDay = n(ev("b", d(2, 9), d(1), { allDay: true }), 60);
    expect(allDay.start).toBe(w(d(2)));
    expect(allDay.end).toBe(w(d(3)));
    expect(allDay.allDay).toBe(true);
  });

  it("classifies lane events and multi-day events", () => {
    expect(isLaneEvent(n(ev("a", d(2, 9), d(2, 10)), 60))).toBe(false);
    expect(isLaneEvent(n(ev("b", d(2, 9), d(3, 9)), 60))).toBe(true); // 24h timed
    expect(isLaneEvent(n(ev("c", d(2), d(3), { allDay: true }), 60))).toBe(true);
    expect(spansMultipleDays(n(ev("d", d(2, 22), d(3, 2)), 60))).toBe(true);
    expect(spansMultipleDays(n(ev("e", d(2, 22), d(3, 0)), 60))).toBe(false); // ends at midnight
    expect(spansMultipleDays(n(ev("f", d(2), d(3), { allDay: true }), 60))).toBe(false);
  });
});

describe("scheduler-layout: daylight saving", () => {
  it("classifies lane events by the wall clock, not by elapsed minutes", () => {
    const zone = "America/New_York";
    // 23-hour day (spring forward 8 Mar 2026): 1380 elapsed minutes still cover the whole day.
    const midnightToMidnight = n(ev("a", "2026-03-08T00:00:00-05:00[America/New_York]", "2026-03-09T00:00:00-04:00[America/New_York]"), 60, zone);
    expect(isLaneEvent(midnightToMidnight)).toBe(true);
    // 25-hour day (fall back 1 Nov 2026): 1440 elapsed minutes cover only 23 wall-clock hours.
    const almostADay = n(ev("b", "2026-11-01T00:00:00-04:00[America/New_York]", "2026-11-01T23:00:00-05:00[America/New_York]"), 60, zone);
    expect(isLaneEvent(almostADay)).toBe(false);
  });
});

describe("scheduler-layout: slicing", () => {
  let week: readonly number[];
  beforeEach(() => {
    week = visibleDays(computeVisibleRange("week", dn(d(2)), 1), []); // Mon 31 Aug … Sun 6 Sep
  });

  it("slices all-day and multi-day events into row segments with continuation flags", () => {
    const events = [
      n(ev("a", d(1), d(4), { allDay: true }), 60), // Tue–Thu
      n(ev("b", date(2026, 7, 29), d(2), { allDay: true }), 60), // Sat 29 Aug – Tue 1 Sep
      n(ev("c", d(5, 23), d(7, 1)), 60), // timed Sat 23:00 → Mon 01:00 (lane event, 26h)
      n(ev("d", d(2, 9), d(2, 10)), 60), // timed single-day
    ];
    const rows = sliceRows(events, week, 7, "all");
    const byId = Object.fromEntries(rows.map((s) => [s.normalized.event.id, s]));
    expect(byId["a"]).toMatchObject({ startIndex: 1, endIndex: 3, continuesBefore: false, continuesAfter: false });
    expect(byId["b"]).toMatchObject({ startIndex: 0, endIndex: 1, continuesBefore: true, continuesAfter: false });
    expect(byId["c"]).toMatchObject({ startIndex: 5, endIndex: 6, continuesBefore: false, continuesAfter: true });
    expect(byId["d"]).toMatchObject({ startIndex: 2, endIndex: 2 });
    expect(sliceRows(events, week, 7, "lane").map((s) => s.normalized.event.id)).toEqual(["a", "b", "c"]);
  });

  it("splits row segments at row boundaries for a month grid", () => {
    const month = visibleDays(computeVisibleRange("month", dn(d(15)), 1), []);
    const events = [n(ev("a", d(5), d(9), { allDay: true }), 60)]; // Sat 5 → Tue 8 inclusive
    const rows = sliceRows(events, month, 7, "all");
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({ startIndex: 5, endIndex: 6, continuesBefore: false, continuesAfter: true });
    expect(rows[1]).toMatchObject({ startIndex: 7, endIndex: 8, continuesBefore: true, continuesAfter: false });
    expect(rows[0]!.key).not.toBe(rows[1]!.key);
  });

  it("collapses hidden weekdays inside a segment", () => {
    const working = visibleDays(computeVisibleRange("week", dn(d(2)), 1), [0, 6]);
    const events = [n(ev("a", d(4), d(8), { allDay: true }), 60)]; // Fri 4 → Mon 7 (Sat/Sun hidden)
    const rows = sliceRows(events, working, 5, "all");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ startIndex: 4, endIndex: 4, continuesAfter: true });
  });

  it("slices timed events into per-day column segments, clipped to the visible hours", () => {
    const events = [
      n(ev("a", d(2, 9), d(2, 10, 30)), 60),
      n(ev("b", d(2, 22), d(3, 2)), 60), // crosses midnight
      n(ev("c", d(2, 6), d(2, 9)), 60), // starts before 08:00
      n(ev("d", d(2, 5), d(2, 7)), 60), // fully outside 08:00–18:00
      n(ev("e", d(2), d(4), { allDay: true }), 60), // lane event: skipped
      n(ev("f", d(1, 23), d(2, 0)), 60), // ends exactly at midnight: no Wednesday segment
    ];
    const cols = sliceColumns(events, week, 8 * 60, 18 * 60);
    const of = (id: string) => cols.filter((s) => s.normalized.event.id === id);
    expect(of("a")).toEqual([expect.objectContaining({ dayIndex: 2, startMinutes: 540, endMinutes: 630, continuesBefore: false, continuesAfter: false })]);
    expect(of("b")).toEqual([]); // 22:00–02:00 lies outside 08:00–18:00 on both days
    expect(of("c")).toEqual([expect.objectContaining({ dayIndex: 2, startMinutes: 480, endMinutes: 540, continuesBefore: true })]);
    expect(of("d")).toEqual([]);
    expect(of("e")).toEqual([]);
    expect(of("f")).toEqual([]);
    expect(cols.every((s) => s.key === `${s.normalized.event.id}:c${s.dayIndex}`)).toBe(true);
  });

  it("keys row segments by event id and first day, and reports the last day touched", () => {
    const bar = n(ev("a", d(1), d(4), { allDay: true }), 60);
    const [segment] = sliceRows([bar], week, 7, "all");
    expect(segment!.key).toBe("a:r1");
    // Exclusive end: the bar's last day is Thursday, not Friday.
    expect(lastDayOf(bar)).toBe(dn(d(3)));
    expect(lastDayOf(n(ev("b", d(2, 22), d(3)), 60))).toBe(dn(d(2))); // timed, exclusive midnight end
  });

  it("flags both ends of an event covering the whole visible range", () => {
    const events = [n(ev("a", date(2026, 7, 24), d(14), { allDay: true }), 60)];
    expect(sliceRows(events, week, 7, "all")).toEqual([expect.objectContaining({ startIndex: 0, endIndex: 6, continuesBefore: true, continuesAfter: true })]);
  });

  it("produces nothing for an event outside the visible range", () => {
    const events = [n(ev("a", date(2026, 7, 10), date(2026, 7, 12), { allDay: true }), 60), n(ev("b", date(2026, 7, 10, 9), date(2026, 7, 10, 10)), 60)];
    expect(sliceRows(events, week, 7, "all")).toEqual([]);
    expect(sliceColumns(events, week, 0, 1440)).toEqual([]);
  });

  it("does not flag a continuation for a timed event ending exactly at midnight", () => {
    // The next day produces no segment, so nothing may point at one — and the row slicer already reports this event
    // as single-day.
    const events = [n(ev("a", d(2, 22), d(3, 0)), 60)];
    const cols = sliceColumns(events, week, 0, 1440);
    expect(cols.map((s) => [s.dayIndex, s.startMinutes, s.endMinutes, s.continuesAfter])).toEqual([[2, 1320, 1440, false]]);
    // …while a clipped window still flags the part that is cut off.
    expect(sliceColumns(events, week, 0, 23 * 60)[0]!.continuesAfter).toBe(true);
  });

  it("gives a cross-midnight event a clipped segment on each day", () => {
    const events = [n(ev("b", d(2, 22), d(3, 2)), 60)];
    const cols = sliceColumns(events, week, 0, 1440);
    expect(cols.map((s) => [s.dayIndex, s.startMinutes, s.endMinutes, s.continuesBefore, s.continuesAfter])).toEqual([
      [2, 1320, 1440, false, true],
      [3, 0, 120, true, false],
    ]);
    const clipped = sliceColumns(events, week, 8 * 60, 18 * 60);
    expect(clipped).toEqual([]); // 22:00–02:00 lies entirely outside 08:00–18:00 on both days
  });
});

describe("scheduler-layout: lanes and overflow", () => {
  let week: readonly number[];
  beforeEach(() => {
    week = visibleDays(computeVisibleRange("week", dn(d(2)), 1), []);
  });

  const rows = (...events: SchedulerEvent[]) =>
    sliceRows(
      events.map((e) => n(e, 60)),
      week,
      7,
      "all",
    );

  it("puts the longest all-day span first and packs first-fit", () => {
    const lanes = assignLanes(
      rows(ev("short", d(1, 9), d(1, 10)), ev("long", d(1), d(4), { allDay: true }), ev("mid", d(2), d(4), { allDay: true }), ev("later", d(4, 9), d(4, 10))),
    );
    const laneOf = (id: string) => lanes.find((s) => s.normalized.event.id === id)?.lane;
    // Sort: long (Tue, span 2) → short (Tue, span 0) → mid (Wed, span 1) → later (Fri).
    expect(laneOf("long")).toBe(0); // [1,3]
    expect(laneOf("short")).toBe(1); // [1,1] collides with lane 0
    expect(laneOf("mid")).toBe(1); // [2,3] does not collide with [1,1]
    expect(laneOf("later")).toBe(0); // [4,4] is free in lane 0
  });

  it("is deterministic for equal spans: earlier start time, then id", () => {
    const lanes = assignLanes(rows(ev("b", d(1, 10), d(1, 11)), ev("a", d(1, 10), d(1, 11)), ev("c", d(1, 9), d(1, 11))));
    expect(lanes.map((s) => [s.normalized.event.id, s.lane])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("hides lanes beyond the visible count and counts hidden events per day", () => {
    const lanes = assignLanes(
      rows(
        ev("span", d(1), d(4), { allDay: true }), // Tue–Thu lane 0
        ev("t1", d(2, 9), d(2, 10)), // Wed lane 1
        ev("t2", d(2, 11), d(2, 12)), // Wed lane 2
        ev("t3", d(2, 13), d(2, 14)), // Wed lane 3
        ev("f1", d(4, 9), d(4, 10)), // Fri lane 0
      ),
    );
    const layout = layoutRow(lanes, 3);
    expect(layout.laneCount).toBe(4);
    expect(layout.visible.map((s) => s.normalized.event.id).sort()).toEqual(["f1", "span", "t1"]);
    expect(layout.hiddenByDay.get(2)?.map((s) => s.normalized.event.id)).toEqual(["t2", "t3"]);
    expect(layout.hiddenByDay.has(4)).toBe(false);
    const fits = layoutRow(lanes, 4);
    expect(fits.visible.length).toBe(5);
    expect(fits.hiddenByDay.size).toBe(0);
    const none = layoutRow(lanes, 1);
    expect(none.visible).toEqual([]);
    expect(none.hiddenByDay.get(1)?.length).toBe(1);
    const unbounded = layoutRow(lanes, Number.POSITIVE_INFINITY);
    expect(unbounded.visible.length).toBe(5);
    expect(unbounded.hiddenByDay.size).toBe(0);
  });

  it("handles an empty row and leaves its input untouched", () => {
    expect(assignLanes([])).toEqual([]);
    const empty = layoutRow([], 3);
    expect(empty).toEqual({ visible: [], hiddenByDay: new Map(), laneCount: 0 });

    const segments = rows(ev("b", d(2, 9), d(2, 10)), ev("a", d(1), d(4), { allDay: true }));
    const before = segments.map((s) => s.normalized.event.id);
    assignLanes(segments);
    expect(segments.map((s) => s.normalized.event.id)).toEqual(before);
    expect(segments.every((s) => !("lane" in s))).toBe(true);
  });
});

describe("scheduler-layout: clusters", () => {
  let week: readonly number[];
  beforeEach(() => {
    week = visibleDays(computeVisibleRange("week", dn(d(2)), 1), []);
  });

  const cols = (...events: SchedulerEvent[]) =>
    sliceColumns(
      events.map((e) => n(e, 60)),
      week,
      0,
      1440,
    );

  it("lays overlapping events side by side and keeps separate clusters full width", () => {
    const laid = clusterColumns(
      cols(ev("a", d(2, 9), d(2, 11)), ev("b", d(2, 10), d(2, 12)), ev("c", d(2, 10, 30), d(2, 11)), ev("d", d(2, 14), d(2, 15)), ev("e", d(3, 9), d(3, 10))),
    );
    const of = (id: string) => {
      const found = laid.find((s) => s.normalized.event.id === id);
      if (!found) throw new Error(`no clustered segment for "${id}"`);
      return found;
    };
    expect([of("a").column, of("a").columns]).toEqual([0, 3]);
    expect([of("b").column, of("b").columns]).toEqual([1, 3]);
    expect([of("c").column, of("c").columns]).toEqual([2, 3]);
    expect([of("d").column, of("d").columns]).toEqual([0, 1]);
    expect([of("e").column, of("e").columns]).toEqual([0, 1]);
  });

  it("keeps a drag-preview ghost full width and leaves its neighbours untouched", () => {
    // While a chip is dragged a short distance the ghost still overlaps the event it previews. Packed as a real
    // column both would go half width — the preview lying about the drop, the faded source jumping sideways.
    const laid = clusterColumns(
      cols(ev("source", d(2, 12), d(2, 13)), ev("neighbour", d(2, 12), d(2, 13)), ev("source__rv-ghost", d(2, 11, 30), d(2, 12, 30))).map((segment) =>
        segment.normalized.event.id.endsWith("__rv-ghost") ? { ...segment, normalized: { ...segment.normalized, ghost: true } } : segment,
      ),
    );
    const of = (id: string) => {
      const found = laid.find((s) => s.normalized.event.id === id);
      if (!found) throw new Error(`no clustered segment for "${id}"`);
      return found;
    };
    expect([of("source__rv-ghost").column, of("source__rv-ghost").columns]).toEqual([0, 1]);
    // The two real events pack exactly as they would with no drag in flight (ties break on id, so "neighbour" takes
    // column 0).
    expect([of("neighbour").column, of("neighbour").columns]).toEqual([0, 2]);
    expect([of("source").column, of("source").columns]).toEqual([1, 2]);
  });

  it("treats touching events as non-overlapping and reuses freed columns", () => {
    const laid = clusterColumns(cols(ev("a", d(2, 9), d(2, 10)), ev("b", d(2, 10), d(2, 11)), ev("c", d(2, 9, 30), d(2, 12))));
    const of = (id: string) => {
      const found = laid.find((s) => s.normalized.event.id === id);
      if (!found) throw new Error(`no clustered segment for "${id}"`);
      return found;
    };
    expect([of("a").column, of("b").column, of("c").column]).toEqual([0, 0, 1]);
    expect(laid.every((s) => s.columns === 2)).toBe(true);
  });
});

describe("scheduler-layout: move and resize resolution", () => {
  let week: readonly number[];
  beforeEach(() => {
    week = visibleDays(computeVisibleRange("week", dn(d(2)), 1), []);
  });

  it("moves a timed event to another day keeping time and duration", () => {
    const next = resolveMove(n(ev("a", d(2, 9), d(2, 10, 30))), { dayIndex: 4, minutes: null, allDay: null }, week, 60);
    expect(next).toEqual(range(d(4, 9), d(4, 10, 30), false));
  });

  it("moves a timed event to a slot keeping duration", () => {
    const next = resolveMove(n(ev("a", d(2, 9), d(2, 10, 30))), { dayIndex: 2, minutes: 14 * 60 + 15, allDay: false }, week, 60);
    expect(next).toEqual(range(d(2, 14, 15), d(2, 15, 45), false));
  });

  it("converts between all-day and timed", () => {
    const toAllDay = resolveMove(n(ev("a", d(2, 9), d(2, 10))), { dayIndex: 3, minutes: null, allDay: true }, week, 60);
    expect(toAllDay).toEqual(range(d(3), d(4), true));
    const toTimed = resolveMove(n(ev("b", d(2), d(4), { allDay: true })), { dayIndex: 1, minutes: 600, allDay: false }, week, 45);
    expect(toTimed).toEqual(range(d(1, 10), d(1, 10, 45), false));
  });

  it("shifts a multi-day all-day event keeping its span and clamps the day index", () => {
    const next = resolveMove(n(ev("a", d(2), d(5), { allDay: true })), { dayIndex: 9, minutes: null, allDay: null }, week, 60);
    expect(next).toEqual(range(d(6), d(9), true));
    const first = resolveMove(n(ev("a", d(2), d(5), { allDay: true })), { dayIndex: -3, minutes: null, allDay: null }, week, 60);
    expect(first.start).toBe(w(date(2026, 7, 31)));
  });

  it("resizes the end on the time axis with a minimum of one snap", () => {
    const grown = resolveResize(n(ev("a", d(2, 9), d(2, 10))), { dayIndex: 2, minutes: 12 * 60 + 30 }, week, 15);
    expect(grown).toEqual(range(d(2, 9), d(2, 12, 30), false));
    const collapsed = resolveResize(n(ev("a", d(2, 9), d(2, 10))), { dayIndex: 2, minutes: 8 * 60 }, week, 15);
    expect(collapsed.end).toBe(w(d(2, 9, 15)));
    const midnight = resolveResize(n(ev("a", d(2, 22), d(2, 23))), { dayIndex: 2, minutes: 1440 }, week, 15);
    expect(midnight.end).toBe(w(d(3)));
  });

  it("resizes lane events by day", () => {
    const allDay = resolveResize(n(ev("a", d(2), d(3), { allDay: true })), { dayIndex: 5, minutes: null }, week, 15);
    expect(allDay).toEqual(range(d(2), d(6), true));
    const tooShort = resolveResize(n(ev("a", d(2), d(4), { allDay: true })), { dayIndex: 0, minutes: null }, week, 15);
    expect(tooShort.end).toBe(w(d(3)));
    const timedLane = resolveResize(n(ev("b", d(1, 9), d(2, 17))), { dayIndex: 4, minutes: null }, week, 15);
    expect(timedLane).toEqual(range(d(1, 9), d(4, 17), false));
    const midnightEnd = resolveResize(n(ev("c", d(1, 9), d(3, 0))), { dayIndex: 4, minutes: null }, week, 15);
    expect(midnightEnd.end).toBe(w(d(5)));
  });

  it("resizes the start edge, pinning the end and keeping one snap step", () => {
    const earlier = resolveResize(n(ev("a", d(2, 9), d(2, 10))), { dayIndex: 2, minutes: 8 * 60 }, week, 15, "start");
    expect(earlier).toEqual(range(d(2, 8), d(2, 10), false));
    // Past the end: clamped to `end - snap`, never inverted.
    const clamped = resolveResize(n(ev("a", d(2, 9), d(2, 10))), { dayIndex: 2, minutes: 14 * 60 }, week, 15, "start");
    expect(clamped.start).toBe(w(d(2, 9, 45)));
    expect(clamped.end).toBe(w(d(2, 10)));
  });

  it("resizes the start edge of lane events by day", () => {
    const allDay = resolveResize(n(ev("a", d(2), d(5), { allDay: true })), { dayIndex: 0, minutes: null }, week, 15, "start");
    expect(allDay).toEqual(range(date(2026, 7, 31), d(5), true));
    // A one-day minimum: the start can never reach the exclusive end.
    const clamped = resolveResize(n(ev("a", d(2), d(4), { allDay: true })), { dayIndex: 5, minutes: null }, week, 15, "start");
    expect(clamped.start).toBe(w(d(3)));
    // A timed lane bar keeps its start time-of-day and only changes the date.
    const timedLane = resolveResize(n(ev("b", d(2, 9), d(4, 17))), { dayIndex: 0, minutes: null }, week, 15, "start");
    expect(timedLane).toEqual(range(date(2026, 7, 31, 9), d(4, 17), false));
  });
});
