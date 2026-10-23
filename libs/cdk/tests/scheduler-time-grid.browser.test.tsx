// Ported from @malva-ui/scheduler (src/lib/time-grid/scheduler-time-grid.spec.ts), MIT, © 2026 Malva UI — render,
// business shading, rendered-row percentages, bidi hour labels, clustered chip geometry, midnight split + window
// clipping, all-day / ≥ 24 h routing, day view + now-line, scroll offsets, `scrollToTime`, tab stop on an unaligned
// window, tab stop through a clock tick, week ↔ day re-scroll, and the "initial scroll" block (non-drag,
// non-keyboard cases; T6–T8 port pointer / keyboard / selection / chip focus).
// Changes: `<mlv-scheduler>` host → `<Scheduler>` with string dates (week of Mon 3 – Sun 9 March 2031, UTC);
// classes `.mlv-scheduler-time-grid__*` → `rv-SchedulerTimeGrid-*` + `data-*` state (`--outside-business` →
// `data-outside-business`, `--continues-*` → `data-continues-*`); `--mlv-scheduler-*` → `--rv-scheduler-*`;
// `data-day-index` / `data-minutes` / `data-event-id` → `data-rv-*`; jsdom `offsetHeight` / `clientHeight` mocks →
// real Chromium layout from a test stylesheet (40 px slot rows, 400 px scroller, 100 px sticky top band, hour labels
// without a box = malva's zero label height); the adapter clock spy → a faked `Date` (10:17 on Tue 4 March 2031);
// `ctx.scrollRequest.set(…)` → `schedulerScrollToTime(state, …)`; "never reads the context clock" is structural here
// (the scroll effect reads the zone clock itself, `time-grid-client.tsx`) and is covered by the centring cases.
// Rivet: the now-line is client-only (absent from server HTML, `scheduler-ssr.test.ts`) and its clock stops while the tab
// is hidden, `data-hour`, label-headroom case.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import {
  Scheduler,
  schedulerScrollToTime,
  schedulerSetView,
  scrollOffsetFor,
  type SchedulerEvent,
  type SchedulerState,
  type SchedulerView,
} from "../scheduler/index.tsx";
import { dateLabel } from "../scheduler/state.ts";
import { dayFromCivil } from "../scheduler/dates.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
  await sleep(30);
  await flush();
};
const label = (y: number, m: number, d: number) => dateLabel(dayFromCivil(y, m, d), "en-US");

const initialEvents = (): SchedulerEvent[] => [
  { id: "a", title: "A", start: "2031-03-04T09:00", end: "2031-03-04T11:00" },
  { id: "b", title: "B", start: "2031-03-04T10:00", end: "2031-03-04T12:00" },
  { id: "c", title: "C", start: "2031-03-04T22:00", end: "2031-03-05T02:00" }, // crosses midnight
  { id: "d", title: "D", start: "2031-03-03", end: "2031-03-06", allDay: true }, // all-day row, Mon–Wed
  { id: "e", title: "E", start: "2031-03-06T09:00", end: "2031-03-07T09:00" }, // 24 h timed → all-day row
];

let sheet: HTMLStyleElement | null = null;
const layoutCss = `
  .rv-SchedulerTimeGrid-scroller { height: 400px; }
  .rv-SchedulerTimeGrid-top { height: 100px; overflow: hidden; position: sticky; top: 0; }
  .rv-SchedulerTimeGrid-slot { height: 40px; }
  .rv-SchedulerTimeGrid-hour { display: none; }
`;

afterEach(() => {
  cleanup();
  sheet?.remove();
  sheet = null;
  vi.useRealTimers();
});

function setup(extra: { view?: SchedulerView; date?: string; layout?: boolean; scrollToNow?: boolean } = {}) {
  if (extra.layout !== false) {
    sheet = document.createElement("style");
    sheet.textContent = layoutCss;
    document.head.append(sheet);
  }
  const events = signal<readonly SchedulerEvent[]>(initialEvents());
  const view = signal<SchedulerView>(extra.view ?? "week");
  const date = signal<string>(extra.date ?? "2031-03-04");
  const minTime = signal("00:00");
  const maxTime = signal("24:00");
  const slotDuration = signal(30);
  const businessHours = signal<{ start: string; end: string } | null>({ start: "09:00", end: "17:00" });
  const showNow = signal(true);
  const scrollToNow = signal(extra.scrollToNow ?? false);
  const selectable = signal(true);
  const stateRef = signal<SchedulerState | null>(null);
  const { container } = render(() => (
    <Scheduler
      events={events}
      view={view}
      date={date}
      timeZone="UTC"
      locale="en-US"
      firstDayOfWeek="mon"
      minTime={minTime()}
      maxTime={maxTime()}
      slotDuration={slotDuration()}
      businessHours={businessHours()}
      showCurrentTime={showNow()}
      scrollToCurrentTime={scrollToNow()}
      allowsRangeSelection={selectable()}
      stateRef={stateRef}
    />
  ));
  const root = container as HTMLElement;
  const q = <E extends Element = HTMLElement>(selector: string): E => {
    const found = root.querySelector<E>(selector);
    if (!found) throw new Error(`nothing matches ${selector}`);
    return found;
  };
  const slot = (dayIndex: number, minutes: number) => q(`[data-rv-day-index="${dayIndex}"][data-rv-minutes="${minutes}"]`);
  const allDayCell = (dayIndex: number) => q(`[data-rv-day-index="${dayIndex}"][data-rv-minutes="all-day"]`);
  const chip = (id: string) => q(`[data-rv-event-id="${id}"]`);
  const scroller = () => q(".rv-SchedulerTimeGrid-scroller");
  const v = (el: HTMLElement, name: string) => el.style.getPropertyValue(name);
  const state = () => stateRef()!;
  return {
    root,
    events,
    view,
    date,
    minTime,
    maxTime,
    slotDuration,
    businessHours,
    showNow,
    scrollToNow,
    selectable,
    q,
    slot,
    allDayCell,
    chip,
    scroller,
    v,
    state,
  };
}

describe("SchedulerTimeGrid", () => {
  it("renders seven day columns of 48 slots with labels, hour gutter and business shading", () => {
    const { root, slot, q } = setup({ layout: false });
    // The sheet is a labelled group; the all-day band is the only real grid.
    expect(q(".rv-SchedulerTimeGrid-sheet").getAttribute("role")).toBe("group");
    expect(q(".rv-SchedulerTimeGrid-sheet").getAttribute("aria-label")).toBe(`Week view, ${label(2031, 3, 3)} – ${label(2031, 3, 9)}`);
    expect(root.querySelectorAll('[role="grid"]').length).toBe(1);
    expect(q('[role="grid"]').getAttribute("aria-label")).toBe("All day");
    expect(root.querySelectorAll(".rv-SchedulerTimeGrid-day-header").length).toBe(7);
    expect(root.querySelectorAll(".rv-SchedulerTimeGrid-column").length).toBe(7);
    expect(root.querySelectorAll(".rv-SchedulerTimeGrid-slot").length).toBe(7 * 48);
    expect(root.querySelectorAll(".rv-SchedulerTimeGrid-hour").length).toBe(24);
    expect(slot(1, 570).getAttribute("aria-label")).toBe(`${label(2031, 3, 4)}, 9:30 AM`);
    // Shading marks the hours OUTSIDE the window (09:00–17:00 Mon–Fri here).
    expect(slot(1, 570).hasAttribute("data-outside-business")).toBe(false);
    expect(slot(1, 480).getAttribute("data-outside-business")).toBe("true");
    expect(slot(6, 570).getAttribute("data-outside-business")).toBe("true"); // Sunday
    expect(slot(1, 540).getAttribute("data-hour")).toBe("true");
    expect(slot(1, 570).hasAttribute("data-hour")).toBe(false);
    // Day-major body: one multi-select listbox per day, the column itself is presentational.
    expect(q(".rv-SchedulerTimeGrid-column").getAttribute("role")).toBe("presentation");
    const listbox = q(".rv-SchedulerTimeGrid-slots");
    expect(listbox.getAttribute("role")).toBe("listbox");
    expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
    expect(listbox.getAttribute("aria-label")).toBe(label(2031, 3, 3));
    expect(slot(1, 570).getAttribute("role")).toBe("option");
    // The chip overlay is a presentational layer, not a contentless 49th cell.
    expect(q(".rv-SchedulerTimeGrid-events").getAttribute("role")).toBe("presentation");
    // Header cells: weekday + day number, decorative; the header carries the name.
    const header = q(".rv-SchedulerTimeGrid-day-header");
    expect(header.getAttribute("role")).toBe("columnheader");
    expect(header.getAttribute("aria-label")).toBe(label(2031, 3, 3));
    expect(header.querySelector(".rv-SchedulerTimeGrid-weekday")?.textContent).toBe("Mon");
    expect(header.querySelector(".rv-SchedulerTimeGrid-day-number")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shades nothing when businessHours is unset", async () => {
    const { root, businessHours } = setup({ layout: false });
    businessHours.set(null);
    await settle();
    expect(root.querySelectorAll("[data-outside-business]").length).toBe(0);
  });

  it("measures percentages against the RENDERED rows, not the named span", async () => {
    // 08:00–17:30 at 60-minute slots renders ceil(570 / 60) = 10 rows = 600 minutes.
    const { root, minTime, maxTime, slotDuration } = setup({ layout: false });
    minTime.set("08:00");
    maxTime.set("17:30");
    slotDuration.set(60);
    await settle();
    const hours = Array.from(root.querySelectorAll<HTMLElement>(".rv-SchedulerTimeGrid-hour"));
    expect(hours).toHaveLength(10);
    expect(hours[9]!.style.getPropertyValue("--rv-scheduler-offset")).toBe("90%"); // (1020 − 480) / 600
    expect(root.querySelectorAll(".rv-SchedulerTimeGrid-slot").length).toBe(7 * 10);
  });

  it("isolates the hour label from the surrounding bidi context", () => {
    const { root } = setup({ layout: false });
    expect(root.querySelector(".rv-SchedulerTimeGrid-hour > bdi")?.textContent).toBe("12 AM");
  });

  it("positions timed chips by minutes and clusters overlaps side by side", () => {
    const { chip, v } = setup({ layout: false });
    const a = chip("a");
    const b = chip("b");
    expect(v(a, "--rv-scheduler-event-top")).toBe("37.5%"); // 9:00 of 24 h
    expect(parseFloat(v(a, "--rv-scheduler-event-height"))).toBeCloseTo(8.3333, 3); // 2 h of 24 h
    expect(v(a, "--rv-scheduler-event-width")).toBe("50%");
    expect(v(a, "--rv-scheduler-event-start")).toBe("0%");
    expect(v(b, "--rv-scheduler-event-start")).toBe("50%");
    expect(a.closest(".rv-SchedulerTimeGrid-column")?.getAttribute("data-rv-day-index")).toBe("1");
    expect(a.getAttribute("data-timed")).toBe("true");
    expect(a.getAttribute("aria-label")).toBe("A, 9:00 AM to 11:00 AM");
  });

  it("splits a cross-midnight event into two clipped segments and clips to minTime / maxTime", async () => {
    const { root, chip, v, minTime, maxTime } = setup({ layout: false });
    const segments = root.querySelectorAll<HTMLElement>('[data-rv-event-id="c"]');
    expect(segments.length).toBe(2);
    expect(segments[0]!.getAttribute("data-continues-after")).toBe("true");
    expect(segments[1]!.getAttribute("data-continues-before")).toBe("true");
    for (const segment of segments) {
      expect(segment.getAttribute("aria-label")).toBe("C, Mar 4, 10:00 PM to Mar 5, 2:00 AM");
      expect(segment.querySelector(".rv-SchedulerEvent-time > bdi")).not.toBeNull();
    }
    minTime.set("08:00");
    maxTime.set("18:00");
    await settle();
    expect(root.querySelectorAll(".rv-SchedulerTimeGrid-slot").length).toBe(7 * 20);
    expect(root.querySelectorAll('[data-rv-event-id="c"]').length).toBe(0);
    expect(v(chip("a"), "--rv-scheduler-event-top")).toBe("10%"); // (9:00 − 8:00) / 10 h
  });

  it("throws the malva text on a window that is not ascending", () => {
    const run = () => render(() => <Scheduler defaultView="week" defaultDate="2031-03-04" timeZone="UTC" locale="en-US" minTime="18:00" maxTime="08:00" />);
    expect(run).toThrow('Invalid scheduler time window "18:00"–"08:00". minTime must be earlier than maxTime.');
  });

  it("routes all-day and ≥ 24 h events into the all-day row lanes", () => {
    const { root, allDayCell, q } = setup({ layout: false });
    const monday = allDayCell(0);
    const d = monday.querySelector<HTMLElement>('[data-rv-event-id="d"]');
    expect(d).not.toBeNull();
    expect(d!.style.getPropertyValue("--rv-scheduler-span")).toBe("3");
    expect(d!.getAttribute("data-spanning")).toBe("true");
    expect(allDayCell(3).querySelector('[data-rv-event-id="e"]')).not.toBeNull();
    expect(root.querySelector('.rv-SchedulerTimeGrid-column [data-rv-event-id="e"]')).toBeNull();
    expect(q(".rv-SchedulerTimeGrid-all-day-label").textContent?.trim()).toBe("All day");
    // Lanes never collapse: d and e share lane 1 (no overlap), the band reserves one row.
    expect(q(".rv-SchedulerTimeGrid").style.getPropertyValue("--rv-scheduler-all-day-lanes")).toBe("1");
  });

  it("grows the all-day band instead of collapsing lanes", async () => {
    const { q, events } = setup({ layout: false });
    events.set([
      ...initialEvents(),
      ...Array.from({ length: 5 }, (_, i): SchedulerEvent => ({ id: "x" + i, title: "X" + i, start: "2031-03-04", end: "2031-03-05", allDay: true })),
    ]);
    await settle();
    expect(q(".rv-SchedulerTimeGrid").style.getPropertyValue("--rv-scheduler-all-day-lanes")).toBe("6");
    expect(q(".rv-SchedulerTimeGrid").querySelectorAll('[data-rv-minutes="all-day"] [data-rv-event-id^="x"]').length).toBe(5);
  });

  it("renders the day view as a single column and shows the now-line only on today", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2031, 2, 4, 10, 17)));
    const { root, view, date, showNow, q } = setup({ layout: false, date: "2031-03-10" });
    view.set("day");
    await settle();
    expect(root.querySelectorAll(".rv-SchedulerTimeGrid-column").length).toBe(1);
    expect(q(".rv-SchedulerTimeGrid-sheet").getAttribute("aria-label")).toBe(`Day view, ${label(2031, 3, 10)}`);
    expect(root.querySelector(".rv-SchedulerTimeGrid-now")).toBeNull();
    date.set("2031-03-04");
    await settle();
    const line = q(".rv-SchedulerTimeGrid-now");
    expect(line.getAttribute("aria-hidden")).toBe("true");
    expect(parseFloat(line.style.getPropertyValue("--rv-scheduler-offset"))).toBeCloseTo((617 / 1440) * 100, 5);
    showNow.set(false);
    await settle();
    expect(root.querySelector(".rv-SchedulerTimeGrid-now")).toBeNull();
  });

  it("ticks the now-line on the minute, runs no clock while the tab is hidden and catches up on return", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    vi.setSystemTime(new Date(Date.UTC(2031, 2, 4, 10, 17)));
    const { q } = setup({ layout: false });
    await flush();
    const offset = () => parseFloat(q(".rv-SchedulerTimeGrid-now").style.getPropertyValue("--rv-scheduler-offset"));
    const at = (minutes: number) => (minutes / 1440) * 100;
    expect(offset()).toBeCloseTo(at(617), 5);
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(offset()).toBeCloseTo(at(618), 5);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    try {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(5 * 60_000);
      await flush();
      expect(offset()).toBeCloseTo(at(618), 5); // no tick while hidden
    } finally {
      delete (document as { hidden?: boolean }).hidden;
    }
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(offset()).toBeCloseTo(at(623), 5); // caught up at once
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(offset()).toBeCloseTo(at(624), 5);
  });

  it("moves today with the minute clock past midnight (header, data-today, now-line agree)", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    vi.setSystemTime(new Date(Date.UTC(2031, 2, 4, 23, 59)));
    const { root } = setup({ layout: false });
    await flush();
    const todayHeader = () => root.querySelector<HTMLElement>('.rv-SchedulerTimeGrid-day-header[data-today="true"]');
    const nowColumn = () => root.querySelector(".rv-SchedulerTimeGrid-now")?.closest("[data-rv-day-index]")?.getAttribute("data-rv-day-index");
    expect(todayHeader()?.textContent).toContain("4");
    expect(nowColumn()).toBe("1");
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(todayHeader()?.textContent).toContain("5");
    expect(root.querySelectorAll('.rv-SchedulerTimeGrid-day-header[data-today="true"]').length).toBe(1);
    expect(nowColumn()).toBe("2");
  });

  it("computes the scroll offset and writes it to the scroller on scrollToTime", async () => {
    expect(scrollOffsetFor(8 * 60, 0, 30, 40)).toBe(640);
    expect(scrollOffsetFor(8 * 60, 7 * 60, 30, 40)).toBe(80);
    expect(scrollOffsetFor(5 * 60, 7 * 60, 30, 40)).toBe(0);
    expect(scrollOffsetFor(8 * 60, 0, 30, 40, 10)).toBe(630);
    expect(scrollOffsetFor(0, 0, 30, 40, 10)).toBe(0);
    const { scroller, state } = setup();
    await settle();
    expect(scroller().scrollTop).toBe(720); // initial: 09:00 business start
    schedulerScrollToTime(state(), "10:00");
    await settle();
    expect(scroller().scrollTop).toBe(800);
    expect(state().scrollRequest()).toBeNull();
  });

  it("keeps half an hour label of headroom above a top-aligned target", async () => {
    const { scroller, state } = setup();
    sheet!.textContent += ".rv-SchedulerTimeGrid-hour { display: block; height: 20px; position: absolute; }";
    await settle();
    schedulerScrollToTime(state(), "10:00");
    await settle();
    expect(scroller().scrollTop).toBe(790); // 800 − 20 / 2
  });

  it("keeps scrollToTime top-aligned while scrollToCurrentTime is on", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2031, 2, 4, 10, 17)));
    const { scroller, state } = setup({ scrollToNow: true });
    await settle();
    schedulerScrollToTime(state(), "10:00");
    await settle();
    expect(scroller().scrollTop).toBe(800);
  });

  it("keeps a tab stop on a window whose span is not a whole number of slots", async () => {
    // 08:30–18:00 at 60 minutes renders 510, 570 … 1050.
    const { root, slot, minTime, maxTime, slotDuration } = setup({ layout: false, date: "2031-03-10" });
    minTime.set("08:30");
    maxTime.set("18:00");
    slotDuration.set(60);
    await settle();
    expect(slot(1, 1050)).not.toBeNull();
    expect(root.querySelectorAll('[tabindex="0"]').length).toBe(1);
    // Default stop: first day (today not visible), business start 09:00 snapped down to the 08:30 row.
    expect(slot(0, 510).getAttribute("tabindex")).toBe("0");
  });

  it("moves the roving tab stop with focus and keeps it through a clock tick", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2031, 2, 4, 10, 17)));
    const { root, slot, allDayCell } = setup({ layout: false });
    await settle();
    // Default: today (Tuesday, index 1) at the business start.
    expect(slot(1, 540).getAttribute("tabindex")).toBe("0");
    const cell = slot(4, 840);
    cell.focus();
    await settle();
    expect(cell.getAttribute("tabindex")).toBe("0");
    vi.setSystemTime(new Date(Date.UTC(2031, 2, 4, 10, 18)));
    await sleep(10);
    await settle();
    expect(cell.getAttribute("tabindex")).toBe("0");
    expect(root.querySelectorAll('[tabindex="0"]').length).toBe(1);
    allDayCell(2).focus();
    await settle();
    expect(allDayCell(2).getAttribute("tabindex")).toBe("0");
    expect(root.querySelectorAll('[tabindex="0"]').length).toBe(1);
  });

  it("re-applies the initial scroll on a week ↔ day switch", async () => {
    const { scroller, view } = setup({ date: "2031-03-10" });
    await settle();
    scroller().scrollTop = 0;
    view.set("day");
    await settle();
    // 09:00 (the business-hours start) at 40px per 30-minute row.
    expect(scroller().scrollTop).toBe(720);
  });

  it("keeps only the scheduler options in the state (no stateRef / handlers / DOM props)", () => {
    const { state } = setup({ layout: false });
    // As given by `setup` — never stateRef / events / view / date / class / handlers (state = options only).
    expect(Object.keys(state().options).sort()).toEqual(
      [
        "allowsRangeSelection",
        "businessHours",
        "firstDayOfWeek",
        "locale",
        "maxTime",
        "minTime",
        "scrollToCurrentTime",
        "showCurrentTime",
        "slotDuration",
        "timeZone",
      ].sort(),
    );
  });

  it("keeps panning native on both axes of the sheet", () => {
    const { q } = setup({ layout: false });
    expect(q(".rv-SchedulerTimeGrid-sheet").style.touchAction).toBe("pan-x pan-y pinch-zoom");
    expect(q(".rv-SchedulerTimeGrid-scroller").style.overflow).toBe("auto");
  });
});

describe("SchedulerTimeGrid initial scroll", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2031, 2, 4, 10, 17)));
  });
  const centred = (scroller: HTMLElement) => (617 / 30) * 40 - (scroller.clientHeight + 100) / 2;

  it("centres the exact current minute in the visible region when scrollToCurrentTime is on", async () => {
    const { scroller, scrollToNow } = setup();
    await settle();
    scrollToNow.set(true);
    await settle();
    // 10:17 = 617 minutes = 822.67 px down; half the region below the 100 px sticky band is given back.
    expect(scroller().clientHeight).toBe(400);
    expect(Math.abs(scroller().scrollTop - centred(scroller()))).toBeLessThanOrEqual(1);
  });

  it("falls back to the top-aligned default when now is outside the window", async () => {
    const { scroller, scrollToNow, maxTime, businessHours } = setup();
    businessHours.set(null);
    maxTime.set("09:00");
    await settle();
    scrollToNow.set(true);
    await settle();
    expect(scroller().scrollTop).toBe(640); // 08:00 top-aligned, not 09:00 centred
  });

  it("re-applies the fallback when maxTime narrows below the current time", async () => {
    const { scroller, maxTime, businessHours } = setup({ scrollToNow: true });
    businessHours.set(null);
    await settle();
    expect(Math.abs(scroller().scrollTop - centred(scroller()))).toBeLessThanOrEqual(1);
    maxTime.set("09:00");
    await settle();
    expect(scroller().scrollTop).toBe(640);
  });

  it("re-centres on a week to day switch", async () => {
    const { scroller, view } = setup({ scrollToNow: true });
    await settle();
    scroller().scrollTop = 0;
    view.set("day");
    await settle();
    expect(Math.abs(scroller().scrollTop - centred(scroller()))).toBeLessThanOrEqual(1);
  });

  it("lets a scrollToTime issued in the same tick win over the initial scroll", async () => {
    const { scroller, view, state } = setup({ scrollToNow: true });
    await settle();
    view.set("day");
    schedulerScrollToTime(state(), "14:00");
    await settle();
    expect(scroller().scrollTop).toBe(1120);
  });

  it("an imperative setView and same-tick scroll request override initial centering", async () => {
    const { scroller, state } = setup({ scrollToNow: true });
    await settle();
    schedulerSetView(state(), "day");
    schedulerScrollToTime(state(), "14:00");
    await settle();
    expect(state().view.value()).toBe("day");
    expect(scroller().scrollTop).toBe(1120);
    expect(state().scrollRequest()).toBeNull();
  });

  it("does not let a past scrollToTime win over a later axis change", async () => {
    const { scroller, slotDuration, state, businessHours } = setup();
    businessHours.set(null);
    await settle();
    schedulerScrollToTime(state(), "14:00");
    await settle();
    expect(scroller().scrollTop).toBe(1120);
    slotDuration.set(60);
    await settle();
    expect(scroller().scrollTop).toBe(320); // 08:00 at 60 min rows, not 560
  });

  it("still honours a scrollToTime issued after an axis change", async () => {
    const { scroller, slotDuration, state } = setup();
    await settle();
    schedulerScrollToTime(state(), "14:00");
    await settle();
    slotDuration.set(60);
    await settle();
    schedulerScrollToTime(state(), "14:00");
    await settle();
    expect(scroller().scrollTop).toBe(560);
  });

  it("drops a request the settled view still shows the month for", async () => {
    const { scroller, view, state } = setup({ view: "month" });
    await settle();
    schedulerScrollToTime(state(), "14:00");
    await settle();
    // Recorded at call time, dropped once the view settled on the month: a request left standing would beat the
    // next time grid's initial scroll with a time asked for in another view.
    expect(state().scrollRequest()).toBeNull();
    view.set("week");
    await settle();
    expect(scroller().scrollTop).toBe(720); // the documented 09:00 initial scroll, not the dropped 14:00
  });

  it("drops a request paired with a same-tick switch into the month view", async () => {
    const { scroller, view, state } = setup();
    await settle();
    view.set("month");
    schedulerScrollToTime(state(), "14:00");
    await settle();
    expect(state().scrollRequest()).toBeNull();
    view.set("week");
    await settle();
    expect(scroller().scrollTop).toBe(720);
  });

  it("drops a pending request on schedulerSetView(month)", async () => {
    const { view, state } = setup({ view: "month" });
    await settle();
    view.set("week");
    schedulerScrollToTime(state(), "14:00");
    schedulerSetView(state(), "month");
    expect(state().scrollRequest()).toBeNull();
  });

  it("applies a scrollToTime issued while the month view shows when the grid appears in the same tick, then consumes it", async () => {
    const { scroller, view, state } = setup({ view: "month" });
    await settle();
    view.set("week");
    schedulerScrollToTime(state(), "14:00");
    await settle();
    expect(scroller().scrollTop).toBe(1120); // not the 09:00 initial scroll (720)
    expect(state().scrollRequest()).toBeNull();
    schedulerScrollToTime(state(), "09:00");
    await settle();
    expect(scroller().scrollTop).toBe(720);
    expect(state().scrollRequest()).toBeNull();
  });
});
