// Ported from @malva-ui/scheduler (src/lib/month/scheduler-month.spec.ts), MIT, © 2026 Malva UI — rendering, lanes,
// spanning bars, `+N more` counts and names, panel open / toggle / Escape / live re-derivation, roving tab stop,
// today gate, hidden days, multiselectable (non-drag, non-keyboard cases; T7 / T8 port the rest).
// Changes: `<mlv-scheduler>` host → `<Scheduler>` with string dates (March 2031, `firstDayOfWeek="mon"`: malva's
// default Monday); classes `.mlv-scheduler-month__*` → `rv-SchedulerMonth-*` + `data-*` state (`--outside` →
// `data-outside`, `--today` → `data-today`, `--spanning` → `data-spanning`); `--mlv-scheduler-lane` →
// `--rv-scheduler-lane`; `moreClick` → `onMoreAction`; the lane budget is the `visibleLanes` prop (default 3 = malva's
// unmeasured fallback), so "re-measures the lane budget" / "subscribes the row-size observer once" are replaced by
// the live `visibleLanes` case. Panel focus hand-off cases (chip removed while focused) land with T8.
// Rivet: week numbers, `data-weekend`, `renderEvent`, live `visibleLanes`.
import { afterEach, describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Scheduler, type SchedulerEvent, type SchedulerMoreEvent } from "../scheduler/index.tsx";
import { dateLabel } from "../scheduler/state.ts";
import { dayFromCivil, todayDay } from "../scheduler/dates.ts";

afterEach(cleanup);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
  await sleep(50);
  await flush();
};
const key = (target: Element, k: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

const label = (y: number, m: number, d: number) => dateLabel(dayFromCivil(y, m, d), "en-US");
const initialEvents = (): SchedulerEvent[] => [
  { id: "span", title: "Offsite", start: "2031-03-03", end: "2031-03-06", allDay: true }, // Mon 3 – Wed 5
  { id: "t1", title: "A", start: "2031-03-04T09:00", end: "2031-03-04T10:00" },
  { id: "t2", title: "B", start: "2031-03-04T11:00", end: "2031-03-04T12:00" },
  { id: "t3", title: "C", start: "2031-03-04T13:00", end: "2031-03-04T14:00" },
  { id: "t4", title: "D", start: "2031-03-04T15:00", end: "2031-03-04T16:00" },
];

function setup(extra: { date?: string; hiddenDays?: number[]; showWeekNumbers?: boolean; renderEvent?: boolean } = {}) {
  const events = signal<readonly SchedulerEvent[]>(initialEvents());
  const date = signal<string>(extra.date ?? "2031-03-10");
  const hiddenDays = signal<number[]>(extra.hiddenDays ?? []);
  const selectable = signal(true);
  const showCurrentTime = signal(true);
  const visibleLanes = signal(3);
  const moreActions: SchedulerMoreEvent[] = [];
  const { container } = render(() => (
    <Scheduler
      events={events}
      defaultView="month"
      date={date}
      timeZone="UTC"
      locale="en-US"
      firstDayOfWeek="mon"
      hiddenDays={hiddenDays()}
      allowsRangeSelection={selectable()}
      showCurrentTime={showCurrentTime()}
      visibleLanes={visibleLanes()}
      showWeekNumbers={extra.showWeekNumbers}
      renderEvent={extra.renderEvent ? (event, s) => <b class="custom">{event.title + (s.allDay ? "/lane" : "")}</b> : undefined}
      onMoreAction={(e) => moreActions.push(e)}
    />
  ));
  const root = container as HTMLElement;
  const cell = (dayIndex: number) => {
    const found = root.querySelector<HTMLElement>(`[data-rv-day-index="${dayIndex}"][data-rv-minutes="all-day"]`);
    if (!found) throw new Error(`no cell ${dayIndex}`);
    return found;
  };
  const moreButton = (dayIndex: number) => {
    const found = cell(dayIndex).querySelector<HTMLButtonElement>(".rv-SchedulerMonth-more");
    if (!found) throw new Error(`day ${dayIndex} renders no "+N more" button`);
    return found;
  };
  const popover = () => document.querySelector<HTMLElement>(".rv-SchedulerMonth-popover");
  const tabbable = () => Array.from(root.querySelectorAll<HTMLElement>(".rv-SchedulerMonth-cell[tabindex='0']"));
  return { root, events, date, hiddenDays, selectable, showCurrentTime, visibleLanes, moreActions, cell, moreButton, popover, tabbable };
}

describe("SchedulerMonth", () => {
  it("renders weekday headers, six week rows and labelled cells; outside days are dimmed", () => {
    const { root, cell } = setup();
    const headers = root.querySelectorAll('[role="columnheader"]');
    expect(headers.length).toBe(7);
    expect(headers[0]!.textContent?.trim()).toBe("Mon");
    expect(root.querySelector('[role="grid"]')?.getAttribute("aria-label")).toBe("Month view, March 2031");
    expect(root.querySelectorAll(".rv-SchedulerMonth-row").length).toBe(6);
    expect(root.querySelectorAll(".rv-SchedulerMonth-cell").length).toBe(42);
    expect(cell(0).dataset["outside"]).toBe("true"); // Mon 24 Feb
    expect(cell(5).dataset["outside"]).toBeUndefined(); // Sat 1 Mar
    expect(cell(5).getAttribute("aria-label")).toBe(label(2031, 3, 1));
    expect(cell(5).querySelector(".rv-SchedulerMonth-day-number")?.textContent?.trim()).toBe("1");
  });

  it('places the spanning bar in its start cell and collapses overflow into "+N more"', () => {
    const { cell, moreButton } = setup();
    const monday = cell(7); // Mon 3 Mar
    const bar = monday.querySelector<HTMLElement>('[data-rv-event-id="span"]')!;
    expect(bar).not.toBeNull();
    expect(bar.style.getPropertyValue("--rv-scheduler-span")).toBe("3");
    expect(bar.style.getPropertyValue("--rv-scheduler-lane")).toBe("1");
    expect(bar.dataset["spanning"]).toBe("true");
    const tuesday = cell(8);
    expect(tuesday.querySelector('[data-rv-event-id="span"]')).toBeNull();
    expect(tuesday.querySelector<HTMLElement>('[data-rv-event-id="t1"]')?.style.getPropertyValue("--rv-scheduler-lane")).toBe("2");
    expect(tuesday.querySelector('[data-rv-event-id="t2"]')).toBeNull();
    const more = moreButton(8);
    expect(more.textContent?.trim()).toBe("+3 more");
    expect(more.style.getPropertyValue("--rv-scheduler-lane")).toBe("3");
  });

  it("opens the overflow popover listing every event of that day, emits moreClick and closes on Escape", async () => {
    const { moreButton, moreActions, popover } = setup();
    moreButton(8).click();
    await settle();
    expect(popover()!.querySelectorAll("[data-rv-event-id]").length).toBe(5);
    expect(moreActions.length).toBe(1);
    expect(moreActions[0]!.events.map((e) => e.id)).toEqual(["t2", "t3", "t4"]);
    expect(moreActions[0]!.date).toBe("2031-03-04");
    expect(popover()!.contains(document.activeElement)).toBe(true);
    key(document.activeElement!, "Escape");
    await settle();
    expect(popover()).toBeNull();
  });

  it("toggles the overflow popover closed from its own trigger", async () => {
    const { moreButton, moreActions, popover } = setup();
    const more = moreButton(8);
    more.click();
    await settle();
    expect(popover()).not.toBeNull();
    expect(moreActions).toHaveLength(1);
    more.click();
    await settle();
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(more);
    expect(moreActions).toHaveLength(1);
  });

  it("keeps one roving tab stop, starting on the first day of the month", () => {
    const { tabbable } = setup();
    expect(tabbable().map((c) => c.dataset["rvDayIndex"])).toEqual(["5"]);
  });

  it("moves the tab stop with focus and resets it when the range changes", async () => {
    const { tabbable, cell, date } = setup();
    cell(12).focus();
    await flush();
    expect(tabbable().map((c) => c.dataset["rvDayIndex"])).toEqual(["12"]);
    date.set("2031-05-10");
    await flush();
    // May 2031 (Mon-first): Apr 28 … the 1st (a Thursday) is index 3.
    expect(tabbable().map((c) => c.dataset["rvDayIndex"])).toEqual(["3"]);
  });

  it("gates the today highlight on showCurrentTime", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { root, showCurrentTime } = setup({ date: today });
    const highlighted = () => Array.from(root.querySelectorAll<HTMLElement>(".rv-SchedulerMonth-cell[data-today]"));
    const plain = dateLabel(todayDay("UTC"), "en-US");
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0]!.getAttribute("aria-label")).toBe(`${plain}, today`);
    showCurrentTime.set(false);
    await flush();
    expect(highlighted()).toHaveLength(0);
    expect(root.querySelector(`.rv-SchedulerMonth-cell[aria-label="${plain}"]`)).not.toBeNull();
  });

  it("drops hidden weekdays from every row", async () => {
    const { root, hiddenDays } = setup();
    hiddenDays.set([0, 6]);
    await flush();
    expect(root.querySelectorAll('[role="columnheader"]').length).toBe(5);
    expect(root.querySelectorAll(".rv-SchedulerMonth-row")[0]!.querySelectorAll(".rv-SchedulerMonth-cell").length).toBe(5);
    expect(root.querySelector('[data-rv-event-id="span"]')).not.toBeNull();
  });

  it("re-derives the open popover from the live events instead of a snapshot", async () => {
    const { moreButton, events } = setup();
    moreButton(8).click();
    await settle();
    const ids = () => Array.from(document.querySelectorAll<HTMLElement>(".rv-SchedulerMonth-popover [data-rv-event-id]")).map((el) => el.dataset["rvEventId"]);
    expect(ids()).toEqual(["span", "t1", "t2", "t3", "t4"]);
    events.set(events().filter((e) => e.id !== "t3"));
    await settle();
    expect(ids()).toEqual(["span", "t1", "t2", "t4"]);
  });

  it("closes the popover once removals leave nothing overflowing", async () => {
    const { moreButton, events, cell, popover } = setup();
    moreButton(8).click();
    await settle();
    events.set(events().filter((e) => e.id !== "t3" && e.id !== "t4"));
    await settle();
    expect(cell(8).querySelector(".rv-SchedulerMonth-more")).toBeNull();
    expect(popover()).toBeNull();
  });

  it("declares the grid multi-selectable exactly while selection is enabled", async () => {
    const { root, selectable } = setup();
    const grid = root.querySelector<HTMLElement>('[role="grid"]')!;
    expect(grid.getAttribute("aria-multiselectable")).toBe("true");
    selectable.set(false);
    await flush();
    expect(grid.getAttribute("aria-multiselectable")).toBeNull();
  });

  it('names the "+N more" button with its visible label first (WCAG 2.5.3)', () => {
    const { moreButton } = setup();
    const more = moreButton(8);
    const visible = more.textContent!.trim();
    expect(visible).toBe("+3 more");
    expect(more.getAttribute("aria-label")).toBe(`${visible}, 3 more events on ${label(2031, 3, 4)}`);
  });

  it('announces the "+N more" popup and its expanded state', async () => {
    const { moreButton, cell, popover } = setup();
    const more = moreButton(8);
    expect(more.getAttribute("aria-haspopup")).toBe("dialog");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(more.getAttribute("aria-controls")).toBeNull();
    more.click();
    await settle();
    const panel = popover()!;
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(more.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.id).toBeTruthy();
    expect(cell(7).querySelector(".rv-SchedulerMonth-more")?.getAttribute("aria-expanded") ?? "false").toBe("false");
  });
});

describe("SchedulerMonth (Rivet)", () => {
  it("live visibleLanes re-packs the rows (server-exact budget)", async () => {
    const { cell, visibleLanes } = setup();
    expect(cell(8).querySelector(".rv-SchedulerMonth-more")).not.toBeNull();
    visibleLanes.set(5);
    await flush();
    expect(cell(8).querySelector(".rv-SchedulerMonth-more")).toBeNull();
    expect(cell(8).querySelectorAll("[data-rv-event-id]").length).toBe(4);
    visibleLanes.set(1);
    await flush();
    expect(cell(8).querySelector(".rv-SchedulerMonth-more")?.textContent?.trim()).toBe("+5 more");
  });

  it("week numbers: ISO week row headers", () => {
    const { root } = setup({ showWeekNumbers: true });
    const headers = Array.from(root.querySelectorAll<HTMLElement>('[role="rowheader"]'));
    expect(headers.map((h) => h.textContent?.trim())).toEqual(["9", "10", "11", "12", "13", "14"]);
    expect(headers[0]!.getAttribute("aria-label")).toBe("Week 9");
  });

  it("weekend cells and headers carry data-weekend (locale weekend)", () => {
    const { root, cell } = setup();
    const headers = Array.from(root.querySelectorAll<HTMLElement>('[role="columnheader"]'));
    expect(headers.map((h) => h.dataset["weekend"] ?? "")).toEqual(["", "", "", "", "", "true", "true"]);
    expect(cell(5).dataset["weekend"]).toBe("true");
    expect(cell(7).dataset["weekend"]).toBeUndefined();
  });

  it("chips: default content, labels, renderEvent", () => {
    const { cell } = setup();
    const t1 = cell(8).querySelector<HTMLElement>('[data-rv-event-id="t1"]')!;
    expect(t1.getAttribute("role")).toBe("button");
    expect(t1.querySelector(".rv-SchedulerEvent-time")?.textContent).toBe("9:00 AM");
    expect(t1.querySelector(".rv-SchedulerEvent-title")?.textContent).toBe("A");
    expect(t1.getAttribute("aria-label")).toBe("A, 9:00 AM to 10:00 AM");
    const span = cell(7).querySelector<HTMLElement>('[data-rv-event-id="span"]')!;
    expect(span.getAttribute("aria-label")).toBe(`Offsite, all day, ${label(2031, 3, 3)} to ${label(2031, 3, 5)}`);
    expect(span.getAttribute("aria-describedby")).toBeTruthy();
    cleanup();
    const custom = setup({ renderEvent: true });
    expect(custom.cell(8).querySelector('[data-rv-event-id="t1"] .custom')?.textContent).toBe("A/lane");
  });
});
