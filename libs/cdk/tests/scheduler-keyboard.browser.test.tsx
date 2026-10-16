// Ported from @malva-ui/scheduler, MIT, © 2026 Malva UI — the keyboard / focus / interaction cases of
// src/lib/month/scheduler-month.spec.ts (roving focus, Home / End / Page keys, navigation past the range, hidden-day
// paging, slot / chip interactions, Enter into chips, `+N more` ring, popover focus hand-off, keyboard range
// selection), src/lib/time-grid/scheduler-time-grid.spec.ts (slot roving, all-day row, week navigation, slot clicks,
// keyboard range selection, Enter / Escape / Tab of timed chips), src/lib/event/scheduler-event.spec.ts (click /
// dblclick / contextmenu, Enter / Space, keyboard move / resize + clamps, Delete / Backspace, focus on removal,
// projected controls) and src/lib/scheduler/scheduler.spec.ts ("keyboard focus restore across segments", "delete
// keys").
// Changes:
// - `<mlv-scheduler>` / test contexts → `<Scheduler>` with string dates (March 2031, `firstDayOfWeek="mon"`, UTC);
//   `data-day-index` / `data-minutes` / `data-event-id` → `data-rv-*`; outputs → `on*` callbacks (`slotClick` →
//   `onSlotAction`, `eventClick` → `onEventAction`, `eventDelete` → `onEventDelete`, `rangeSelect` → `onRangeSelect`).
// - `MlvRtlService.setDirection('rtl')` → a `dir="rtl"` wrapper (keys read the grid's computed direction).
// - malva's fake chip host + spied context (`ctx.commits`, `ctx.context.pendingFocus()`) → the real root: commits are
//   read from `onEventMove` / `onEventResize`, focus requests from where focus lands after the render settles (the
//   request is resolved imperatively by its producer, not by a view effect: `keys.ts`). "asks the view to …" cases
//   assert the focused cell; "never overwrites a standing request" is staged with `requestFocus`.
// - "clears a focus request no rendered cell can satisfy" / "drops a focus request whose target never renders" call
//   `requestFocus` (the only producer) instead of writing the context signal.
// - "swallows a post-drag click once" lives in `scheduler-drag.browser.test.tsx` (`pointer.ts` swallow); the
//   built-in menus (`defaultPrevented` after a def opened one) are in `scheduler-menu.browser.test.tsx`.
// - Removal hand-off is checked in every browser path: Chromium's blur-before-detach `focusout` and the removal watch.
import { afterEach, describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import {
  Scheduler,
  type SchedulerEvent,
  type SchedulerEventChange,
  type SchedulerEventInteraction,
  type SchedulerRangeSelectEvent,
  type SchedulerSlotEvent,
  type SchedulerState,
  type SchedulerView,
} from "../scheduler/index.tsx";
import { requestFocus } from "../scheduler/keys.ts";
import { dateLabel } from "../scheduler/state.ts";
import { dayFromCivil } from "../scheduler/dates.ts";

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
const mouse = (target: Element, type: string) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};
const focused = () => document.activeElement as HTMLElement;
const label = (y: number, m: number, d: number) => dateLabel(dayFromCivil(y, m, d), "en-US");

afterEach(async () => {
  cleanup();
  document.body.click();
  await flush();
});

interface Options {
  view?: SchedulerView;
  date?: string;
  events?: SchedulerEvent[];
  dir?: "rtl";
  hiddenDays?: number[];
  minTime?: string;
  maxTime?: string;
  selectable?: boolean;
}

async function mount(options: Options = {}) {
  const events = signal<readonly SchedulerEvent[]>(options.events ?? []);
  const view = signal<SchedulerView>(options.view ?? "month");
  const date = signal<string>(options.date ?? "2031-03-10");
  const hiddenDays = signal<number[]>(options.hiddenDays ?? []);
  const readOnly = signal(false);
  const minTime = signal(options.minTime ?? "00:00");
  const maxTime = signal(options.maxTime ?? "24:00");
  const stateRef = signal<SchedulerState | null>(null);
  const log = {
    slotClicks: [] as SchedulerSlotEvent[],
    slotDoubleClicks: [] as SchedulerSlotEvent[],
    slotContextMenus: [] as SchedulerSlotEvent[],
    eventClicks: [] as SchedulerEventInteraction[],
    eventDoubleClicks: [] as SchedulerEventInteraction[],
    eventContextMenus: [] as SchedulerEventInteraction[],
    deletes: [] as SchedulerEventInteraction[],
    ranges: [] as SchedulerRangeSelectEvent[],
    moves: [] as SchedulerEventChange[],
    resizes: [] as SchedulerEventChange[],
  };
  const { container } = render(() => (
    <div dir={options.dir}>
      <Scheduler
        events={events}
        view={view}
        date={date}
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        hiddenDays={hiddenDays()}
        businessHours={null}
        minTime={minTime()}
        maxTime={maxTime()}
        isReadOnly={readOnly()}
        allowsRangeSelection={options.selectable ?? true}
        showCurrentTime={false}
        stateRef={stateRef}
        onSlotAction={(e) => log.slotClicks.push(e)}
        onSlotDoubleClick={(e) => log.slotDoubleClicks.push(e)}
        onSlotContextMenu={(e) => log.slotContextMenus.push(e)}
        onEventAction={(e) => log.eventClicks.push(e)}
        onEventDoubleClick={(e) => log.eventDoubleClicks.push(e)}
        onEventContextMenu={(e) => log.eventContextMenus.push(e)}
        onEventDelete={(e) => log.deletes.push(e)}
        onRangeSelect={(e) => log.ranges.push(e)}
        onEventMove={(e) => log.moves.push(e)}
        onEventResize={(e) => log.resizes.push(e)}
      />
    </div>
  ));
  await settle();
  const root = container.querySelector<HTMLElement>("[data-rv-scheduler]")!;
  const q = (selector: string, from: ParentNode = root) => {
    const found = from.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`nothing matches ${selector}`);
    return found;
  };
  const cell = (dayIndex: number) => q(`[data-rv-day-index="${dayIndex}"][data-rv-minutes="all-day"]`);
  const slot = (dayIndex: number, minutes: number) => q(`[data-rv-day-index="${dayIndex}"][data-rv-minutes="${minutes}"]`);
  const chip = (id: string, from: ParentNode = root) => q(`[data-rv-event-id="${id}"]:not([data-ghost])`, from);
  const chipsOf = (id: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-rv-event-id="${id}"]:not([data-ghost])`));
  const moreButton = (dayIndex: number) => q("[data-rv-more]", cell(dayIndex));
  const popover = () => document.querySelector<HTMLElement>(".rv-SchedulerMonth-popover");
  const tabbable = () => Array.from(root.querySelectorAll<HTMLElement>(".rv-SchedulerMonth-cell[tabindex='0']")).map((c) => c.dataset["rvDayIndex"]);
  const selected = (selector = "") => root.querySelectorAll(`${selector}[aria-selected="true"]`).length;
  const liveText = () =>
    Array.from(root.querySelectorAll('[role="status"]'))
      .map((node) => node.textContent ?? "")
      .join("");
  const dayIndexOf = (element: Element | null) => element?.closest("[data-rv-day-index]")?.getAttribute("data-rv-day-index");
  return {
    root,
    events,
    view,
    date,
    hiddenDays,
    readOnly,
    minTime,
    maxTime,
    state: () => stateRef()!,
    log,
    q,
    cell,
    slot,
    chip,
    chipsOf,
    moreButton,
    popover,
    tabbable,
    selected,
    liveText,
    dayIndexOf,
  };
}

// March 2031 month grid (Mon 24 Feb … Sun 6 Apr): 0 = Mon 24 Feb, 5 = Sat 1 Mar, 7 = Mon 3, 8 = Tue 4, 10 = Thu 6.
const monthEvents = (): SchedulerEvent[] => [
  { id: "span", title: "Offsite", start: "2031-03-03", end: "2031-03-06", allDay: true }, // Mon 3 – Wed 5
  { id: "t1", title: "A", start: "2031-03-04T09:00", end: "2031-03-04T10:00" },
  { id: "t2", title: "B", start: "2031-03-04T11:00", end: "2031-03-04T12:00" },
  { id: "t3", title: "C", start: "2031-03-04T13:00", end: "2031-03-04T14:00" },
  { id: "t4", title: "D", start: "2031-03-04T15:00", end: "2031-03-04T16:00" },
];

describe("Scheduler month keyboard", () => {
  it("keeps one roving tab stop, starting on the first day of the month", async () => {
    const { cell, tabbable } = await mount({ events: monthEvents() });
    expect(tabbable()).toEqual(["5"]);
    cell(5).focus();
    key(cell(5), "ArrowRight");
    await flush();
    expect(tabbable()).toEqual(["6"]);
    expect(focused()).toBe(cell(6));
    key(cell(6), "ArrowDown");
    expect(focused()).toBe(cell(13));
    key(cell(13), "Home");
    expect(focused()).toBe(cell(7));
    key(cell(7), "End");
    expect(focused()).toBe(cell(13));
    key(cell(13), "Home", { ctrlKey: true });
    expect(focused()).toBe(cell(0));
    key(cell(0), "End", { ctrlKey: true });
    expect(focused()).toBe(cell(41));
    await flush();
    expect(tabbable()).toEqual(["41"]);
  });

  it("mirrors horizontal arrows in RTL and keeps vertical ones", async () => {
    const { cell } = await mount({ dir: "rtl" });
    cell(6).focus();
    key(cell(6), "ArrowLeft");
    expect(focused()).toBe(cell(7));
    key(cell(7), "ArrowUp");
    expect(focused()).toBe(cell(0));
  });

  it("navigates when an arrow leaves the visible range and focuses the target date", async () => {
    const { cell, date } = await mount();
    cell(0).focus();
    key(cell(0), "ArrowLeft"); // Mon 24 Feb → Sun 23 Feb: February 2031
    await settle();
    expect(date()).toBe("2031-02-23");
    expect(focused().getAttribute("aria-label")).toBe(label(2031, 2, 23));
    key(focused(), "PageDown"); // same day of month: 23 Mar
    await settle();
    expect(date()).toBe("2031-03-23");
    expect(focused().getAttribute("aria-label")).toBe(label(2031, 3, 23));
  });

  it("pages onto a rendered weekday when the same day of month is hidden", async () => {
    const { root, date } = await mount({ hiddenDays: [0, 6], date: "2031-04-03" });
    const thursday = root.querySelector<HTMLElement>(`[aria-label="${label(2031, 4, 3)}"]`)!;
    thursday.focus();
    key(thursday, "PageDown"); // 3 May 2031 is a Saturday — not rendered
    await settle();
    expect(date()).toBe("2031-05-05"); // Mon 5 May
    expect(focused().getAttribute("aria-label")).toBe(label(2031, 5, 5));
    key(focused(), "PageUp"); // 5 Apr is a Saturday
    await settle();
    expect(date()).toBe("2031-04-04"); // Fri 4 Apr
    expect(focused().getAttribute("aria-label")).toBe(label(2031, 4, 4));
  });

  it("clears a focus request no rendered cell can satisfy", async () => {
    const { root, cell, state } = await mount();
    cell(8).focus();
    const s = state();
    // A day outside the rendered range (September 2031): nothing can place it.
    const ctx = { state: s, days: () => [dayFromCivil(2031, 3, 1)], axis: () => ({ min: 0, max: 1440, slot: 30, snap: 30, last: 1410 }) };
    requestFocus(ctx as never, root, { eventId: null, day: dayFromCivil(2031, 9, 1), minutes: null });
    expect(s.pendingFocus()).not.toBeNull();
    await settle();
    expect(s.pendingFocus()).toBeNull();
    expect(focused()).toBe(cell(8));
  });

  it("emits slotClick on Space / click / Enter on an empty cell, and Enter focuses the first chip of a busy cell", async () => {
    const { cell, chip, log } = await mount({ events: monthEvents() });
    const empty = cell(10); // Thu 6 Mar
    key(empty, " ");
    empty.click();
    key(empty, "Enter");
    expect(log.slotClicks.length).toBe(3);
    expect(log.slotClicks[0]).toMatchObject({ date: "2031-03-06", allDay: true, element: empty });
    expect(log.slotClicks[0]!.nativeEvent).toBeInstanceOf(KeyboardEvent);
    expect(log.slotClicks[1]!.nativeEvent).toBeInstanceOf(MouseEvent);
    const busy = cell(8);
    busy.focus();
    key(busy, "Enter");
    expect(focused()).toBe(chip("t1", busy));
    expect(log.slotClicks.length).toBe(3);
  });

  it("Enter focuses the chip in the pressed cell, not the first bar of a multi-row event", async () => {
    const { cell, chipsOf } = await mount({ events: [{ id: "cross", title: "Trip", start: "2031-03-01", end: "2031-03-05", allDay: true }] });
    const bars = chipsOf("cross");
    expect(bars).toHaveLength(2);
    expect(bars[0]!.closest("[data-rv-day-index]")).toBe(cell(5)); // Sat 1 Mar
    const monday = cell(7);
    monday.focus();
    key(monday, "Enter");
    expect(focused()).toBe(bars[1]);
    expect(focused().closest("[data-rv-day-index]")).toBe(monday);
  });

  it("leaves keys that originate on a chip to the chip", async () => {
    const { cell, chip, tabbable } = await mount({ events: monthEvents() });
    const owner = cell(8);
    owner.focus();
    const chipEl = chip("t1", owner);
    chipEl.focus();
    key(chipEl, "ArrowRight");
    await flush();
    expect(focused()).toBe(chipEl);
    expect(tabbable()).toEqual(["8"]);
  });

  it("emits slotDoubleClick and slotContextMenu from empty cell space only", async () => {
    const { cell, chip, log } = await mount({ events: monthEvents() });
    const empty = cell(10);
    mouse(empty, "dblclick");
    const menu = mouse(empty, "contextmenu");
    expect(menu.defaultPrevented).toBe(false); // no menu def: the native menu is untouched
    expect(log.slotDoubleClicks.map((e) => e.date)).toEqual(["2031-03-06"]);
    expect(log.slotContextMenus.map((e) => e.date)).toEqual(["2031-03-06"]);
    mouse(chip("t1", cell(8)), "dblclick");
    expect(log.slotDoubleClicks).toHaveLength(1);
    expect(log.eventDoubleClicks.map((e) => e.event.id)).toEqual(["t1"]);
  });

  it("does not emit slotClick for a click that landed on a chip", async () => {
    const { cell, chip, log } = await mount({ events: monthEvents() });
    chip("t1", cell(8)).click();
    expect(log.eventClicks.length).toBe(1);
    expect(log.slotClicks.length).toBe(0);
  });

  it("emits the slot context menu from the ContextMenu key and Shift+F10 (claimed, once per press)", async () => {
    const { cell, log } = await mount();
    const target = cell(10);
    target.focus();
    expect(key(target, "ContextMenu").defaultPrevented).toBe(true);
    // The browser's synthesised keyup → contextmenu of the same press is claimed by the keyup guard.
    const up = new KeyboardEvent("keyup", { key: "ContextMenu", bubbles: true, cancelable: true });
    target.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(true);
    expect(key(target, "F10", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(key(target, "ContextMenu", { repeat: true }).defaultPrevented).toBe(true);
    expect(log.slotContextMenus.map((e) => [e.date, e.nativeEvent instanceof KeyboardEvent])).toEqual([
      ["2031-03-06", true],
      ["2031-03-06", true],
    ]);
  });

  it("takes focus back onto the popover group when its focused chip leaves the model", async () => {
    const { moreButton, popover, chip, events } = await mount({ events: monthEvents() });
    moreButton(8).click();
    await settle();
    const panel = popover()!;
    chip("t3", panel).focus();
    expect(focused()).toBe(chip("t3", panel));
    events.set(events().filter((e) => e.id !== "t3"));
    await settle();
    expect(panel.querySelector('[data-rv-event-id="t3"]')).toBeNull();
    expect(panel.isConnected).toBe(true);
    expect(focused()).toBe(panel);
  });

  it("closes the popover and focuses the day cell once removals leave nothing overflowing", async () => {
    const { moreButton, popover, chip, cell, events } = await mount({ events: monthEvents() });
    moreButton(8).click();
    await settle();
    chip("t4", popover()!).focus();
    // Day 8 holds five segments over three lanes; two removals leave three.
    events.set(events().filter((e) => e.id !== "t3" && e.id !== "t4"));
    await settle();
    await settle();
    expect(cell(8).querySelector("[data-rv-more]")).toBeNull();
    expect(popover()).toBeNull();
    expect(focused()).toBe(cell(8));
    expect(cell(8).tabIndex).toBe(0);
  });

  it("leaves focus alone when a popover chip leaves the model without holding it", async () => {
    const { moreButton, popover, chip, events } = await mount({ events: monthEvents() });
    moreButton(8).click();
    await settle();
    const panel = popover()!;
    chip("t2", panel).focus();
    events.set(events().filter((e) => e.id !== "t3"));
    await settle();
    expect(focused()).toBe(chip("t2", panel));
  });

  it('focuses "+N more" with Enter when spanning bars leave the cell no chip', async () => {
    const { cell, moreButton, log } = await mount({
      events: [
        { id: "span1", title: "Offsite", start: "2031-03-03", end: "2031-03-06", allDay: true },
        { id: "span2", title: "Retreat", start: "2031-03-03", end: "2031-03-06", allDay: true },
        { id: "span3", title: "Summit", start: "2031-03-03", end: "2031-03-06", allDay: true },
        { id: "t1", title: "A", start: "2031-03-04T09:00", end: "2031-03-04T10:00" },
        { id: "t2", title: "B", start: "2031-03-04T11:00", end: "2031-03-04T12:00" },
      ],
    });
    const tuesday = cell(8);
    expect(tuesday.querySelectorAll("[data-rv-event-id]")).toHaveLength(0);
    const more = moreButton(8);
    tuesday.focus();
    const enter = key(tuesday, "Enter");
    expect(enter.defaultPrevented).toBe(true);
    expect(focused()).toBe(more);
    expect(log.slotClicks).toHaveLength(0);
  });

  it('reaches "+N more" through the intra-cell Tab ring and round-trips focus through the popover', async () => {
    const { cell, chip, moreButton, popover } = await mount({ events: monthEvents() });
    const owner = cell(8); // Tue 4 Mar: one visible chip plus the overflow button
    const chipEl = chip("t1", owner);
    const more = moreButton(8);
    chipEl.focus();
    const tab = key(chipEl, "Tab");
    expect(tab.defaultPrevented).toBe(true);
    expect(focused()).toBe(more);
    // Shift+Tab on the button steps back to the cell's last chip; Escape returns to the cell.
    expect(key(more, "Tab", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(focused()).toBe(chipEl);
    more.focus();
    expect(key(more, "Escape").defaultPrevented).toBe(true);
    expect(focused()).toBe(owner);

    more.click();
    await settle();
    const panel = popover()!;
    expect(focused()).toBe(panel.querySelector("[data-rv-event-id]"));
    // Escape on the panel chip: no owning grid cell (the panel is an overlay), so the popover's own dismissal runs.
    key(focused(), "Escape");
    await settle();
    expect(popover()).toBeNull();
    expect(focused()).toBe(more);
  });

  describe("keyboard range selection", () => {
    it("Shift+Arrow selects days, Enter emits an all-day range with source keyboard", async () => {
      const { cell, selected, log, liveText } = await mount();
      const c = cell(7); // 3 Mar 2031
      c.focus();
      key(c, "ArrowRight", { shiftKey: true });
      await flush(); // a separate keydown task: its hint replaces the first one
      key(c, "ArrowDown", { shiftKey: true });
      await flush();
      expect(selected(".rv-SchedulerMonth-cell")).toBe(9); // 3 → 11 Mar
      expect(liveText()).toBe(`${label(2031, 3, 3)} to ${label(2031, 3, 11)} selected. Press Enter to confirm`);
      key(focused(), "Enter");
      expect(log.ranges[0]).toEqual({ start: "2031-03-03", end: "2031-03-12", allDay: true, source: "keyboard" });
    });

    it("Escape clears a pending selection without emitting", async () => {
      const { cell, selected, log } = await mount();
      const c = cell(7);
      c.focus();
      key(c, "ArrowRight", { shiftKey: true });
      await flush();
      expect(selected()).toBe(2);
      key(focused(), "Escape");
      await flush();
      expect(selected()).toBe(0);
      expect(log.ranges).toHaveLength(0);
    });

    it("clamps the head on the axis the key moves", async () => {
      const { cell, selected } = await mount();
      const lastRow = cell(38);
      lastRow.focus();
      key(lastRow, "ArrowDown", { shiftKey: true });
      await flush();
      expect(selected()).toBe(1);
      expect(cell(38).getAttribute("aria-selected")).toBe("true");
      expect(cell(41).getAttribute("aria-selected")).toBeNull();

      key(lastRow, "Escape");
      const firstRow = cell(3);
      firstRow.focus();
      key(firstRow, "ArrowUp", { shiftKey: true });
      await flush();
      expect(selected()).toBe(1);
      expect(cell(0).getAttribute("aria-selected")).toBeNull();

      key(firstRow, "Escape");
      const last = cell(41);
      last.focus();
      key(last, "ArrowRight", { shiftKey: true });
      await flush();
      expect(selected()).toBe(1);

      key(last, "ArrowUp", { shiftKey: true });
      await flush();
      expect(selected()).toBe(8);
    });

    it("does not re-announce a clamped extension", async () => {
      const { cell, state } = await mount();
      const last = cell(41);
      last.focus();
      key(last, "ArrowRight", { shiftKey: true });
      const announced = state().announcement();
      key(last, "ArrowRight", { shiftKey: true });
      expect(state().announcement()).toBe(announced);
    });

    it("mirrors Shift+Arrow in RTL and leaves the vertical pair alone", async () => {
      const { cell, selected } = await mount({ dir: "rtl" });
      const c = cell(7); // Mon 3 Mar
      c.focus();
      key(c, "ArrowLeft", { shiftKey: true }); // "next" in RTL
      await flush();
      expect(cell(8).getAttribute("aria-selected")).toBe("true");
      expect(cell(6).getAttribute("aria-selected")).toBeNull();
      key(c, "ArrowDown", { shiftKey: true }); // never mirrors
      await flush();
      expect(selected()).toBe(9);
      expect(cell(15).getAttribute("aria-selected")).toBe("true");
    });

    it("abandons a pending selection on plain navigation", async () => {
      const { cell, selected, log } = await mount();
      const c = cell(7);
      c.focus();
      key(c, "ArrowRight", { shiftKey: true });
      key(c, "ArrowRight", { shiftKey: true });
      await flush();
      expect(selected()).toBe(3);

      key(c, "ArrowLeft"); // plain navigation: focus Sun 2 Mar, selection gone
      await flush();
      expect(selected()).toBe(0);
      expect(focused()).toBe(cell(6));

      key(cell(6), "Enter");
      expect(log.ranges).toHaveLength(0);
      expect(log.slotClicks.at(-1)?.date).toBe("2031-03-02");

      key(cell(6), "ArrowRight", { shiftKey: true });
      await flush();
      expect(selected()).toBe(2);
      expect(cell(6).getAttribute("aria-selected")).toBe("true");
      expect(cell(8).getAttribute("aria-selected")).toBeNull();
    });

    it("treats Shift+Arrow as plain navigation while range selection is off", async () => {
      const { cell, selected } = await mount({ selectable: false });
      const c = cell(7);
      c.focus();
      key(c, "ArrowRight", { shiftKey: true });
      await flush();
      expect(selected()).toBe(0);
      expect(focused()).toBe(cell(8));
    });
  });
});

// Week of Mon 3 – Sun 9 March 2031; day 1 = Tue 4 Mar.
const weekEvents = (): SchedulerEvent[] => [
  { id: "a", title: "A", start: "2031-03-04T09:00", end: "2031-03-04T11:00" },
  { id: "b", title: "B", start: "2031-03-04T10:00", end: "2031-03-04T12:00" },
  { id: "c", title: "C", start: "2031-03-04T22:00", end: "2031-03-05T02:00" }, // crosses midnight
  { id: "d", title: "D", start: "2031-03-03", end: "2031-03-06", allDay: true }, // all-day row, Mon–Wed
];

describe("Scheduler time-grid keyboard", () => {
  it("roves focus through slots: vertical by slot, horizontal by day, all-day row above", async () => {
    const { slot, cell, root } = await mount({ view: "week", date: "2031-03-04", events: weekEvents() });
    const start = slot(1, 540);
    start.focus();
    key(start, "ArrowDown");
    expect(focused()).toBe(slot(1, 570));
    key(slot(1, 570), "ArrowRight");
    expect(focused()).toBe(slot(2, 570));
    key(slot(2, 570), "Home");
    expect(focused()).toBe(slot(0, 570));
    key(slot(0, 570), "End");
    expect(focused()).toBe(slot(6, 570));
    key(slot(6, 570), "End", { ctrlKey: true });
    expect(focused()).toBe(slot(6, 1410));
    key(slot(6, 1410), "ArrowDown"); // clamps at the last slot
    expect(focused()).toBe(slot(6, 1410));
    key(slot(6, 1410), "Home", { ctrlKey: true });
    expect(focused()).toBe(slot(0, 0));
    key(slot(0, 0), "ArrowUp");
    expect(focused()).toBe(cell(0));
    key(cell(0), "ArrowDown");
    expect(focused()).toBe(slot(0, 0));
    await flush();
    expect(root.querySelectorAll('[tabindex="0"]').length).toBe(1);
  });

  it("mirrors the horizontal slot keys in RTL", async () => {
    const { slot, root } = await mount({ view: "week", date: "2031-03-04", dir: "rtl" });
    slot(0, 0).focus();
    key(slot(0, 0), "ArrowLeft");
    expect(focused()).toBe(slot(1, 0));
    await flush();
    expect(root.querySelectorAll('[tabindex="0"]').length).toBe(1);
  });

  it("keeps a tab stop on a window whose span is not a whole number of slots", async () => {
    const { slot, root } = await mount({ view: "week", date: "2031-03-04", minTime: "08:30", maxTime: "18:00" });
    // 30-minute slots over 08:30–18:00 end on 17:30; the last row is reachable and the clamp lands ON it.
    const last = slot(1, 1050);
    last.focus();
    key(last, "ArrowDown");
    expect(focused()).toBe(last);
    key(slot(1, 1020), "ArrowDown");
    expect(focused()).toBe(slot(1, 1050));
    await flush();
    expect(root.querySelectorAll('[tabindex="0"]').length).toBe(1);
  });

  it("drops a focus request whose target never renders instead of holding it", async () => {
    const { root, slot, state } = await mount({ view: "week", date: "2031-03-04", events: weekEvents() });
    const anchorSlot = slot(1, 540);
    anchorSlot.focus();
    const s = state();
    const ctx = { state: s, days: () => [dayFromCivil(2031, 3, 4)], axis: () => ({ min: 0, max: 1440, slot: 30, snap: 30, last: 1410 }) };
    requestFocus(ctx as never, root, { eventId: "gone", day: null, minutes: null });
    await settle();
    expect(s.pendingFocus()).toBeNull();
    expect(focused()).toBe(anchorSlot);
  });

  it("navigates a week when the horizontal arrow leaves the range and keeps the slot", async () => {
    const { slot, date } = await mount({ view: "week", date: "2031-03-04" });
    slot(6, 600).focus();
    key(slot(6, 600), "ArrowRight");
    await settle();
    expect(date()).toBe("2031-03-10");
    expect(focused()).toBe(slot(0, 600));
    key(slot(0, 600), "PageUp");
    await settle();
    expect(date()).toBe("2031-03-03");
    expect(focused()).toBe(slot(0, 600));
  });

  it("pages by one day in the day view", async () => {
    const { slot, date } = await mount({ view: "day", date: "2031-03-04" });
    slot(0, 600).focus();
    key(slot(0, 600), "PageDown");
    await settle();
    expect(date()).toBe("2031-03-05");
    expect(focused()).toBe(slot(0, 600));
  });

  it("emits slotClick with the slot start (timed) or the day (all-day) on Space / click / Enter", async () => {
    const { slot, cell, chip, log } = await mount({ view: "week", date: "2031-03-04", events: weekEvents() });
    key(slot(1, 570), " ");
    slot(1, 570).click();
    expect(log.slotClicks.length).toBe(2);
    expect(log.slotClicks[0]).toMatchObject({ date: "2031-03-04T09:30:00", allDay: false });
    cell(4).click();
    expect(log.slotClicks[2]).toMatchObject({ date: "2031-03-07", allDay: true });
    key(slot(1, 540), "Enter"); // chip "a" starts here
    expect(focused()).toBe(chip("a"));
    key(slot(1, 300), "Enter"); // empty
    expect(log.slotClicks.length).toBe(4);
  });

  it("Enter focuses a timed chip and Escape returns to the slot that owns it", async () => {
    const { slot, chip } = await mount({ view: "week", date: "2031-03-04", events: weekEvents() });
    const s = slot(1, 540);
    s.focus();
    key(s, "Enter");
    expect(focused()).toBe(chip("a"));
    const escape = key(chip("a"), "Escape");
    expect(escape.defaultPrevented).toBe(true);
    expect(focused()).toBe(s);
  });

  it("Tab cycles the timed chips of the focused column", async () => {
    const { chip } = await mount({ view: "week", date: "2031-03-04", events: weekEvents() });
    chip("a").focus();
    const tab = key(chip("a"), "Tab");
    expect(tab.defaultPrevented).toBe(true);
    expect(focused()).toBe(chip("b"));
    const back = key(chip("b"), "Tab", { shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(focused()).toBe(chip("a"));
    // `c` (22:00 → past midnight) is the column's last chip; Tab off it leaves the grid natively.
    expect(key(chip("c"), "Tab").defaultPrevented).toBe(false);
  });

  describe("keyboard range selection", () => {
    it("Shift+ArrowDown extends the selection from the focused slot; Enter commits it", async () => {
      const { slot, selected, liveText, log } = await mount({ view: "week", date: "2031-03-04" });
      const s = slot(1, 540);
      s.focus();
      key(s, "ArrowDown", { shiftKey: true });
      key(s, "ArrowDown", { shiftKey: true });
      await flush();
      expect(selected(".rv-SchedulerTimeGrid-slot")).toBe(3);
      expect(liveText()).toMatch(/9:00.*10:30/);
      key(focused(), "Enter");
      expect(log.ranges[0]).toEqual({ start: "2031-03-04T09:00:00", end: "2031-03-04T10:30:00", allDay: false, source: "keyboard" });
    });

    it("Shift+ArrowRight extends across days and Escape clears", async () => {
      const { slot, selected, log } = await mount({ view: "week", date: "2031-03-04" });
      const s = slot(1, 540);
      s.focus();
      key(s, "ArrowRight", { shiftKey: true });
      await flush();
      // Continuous: Tue 09:00 → 23:30 (30 cells) + Wed 00:00 → 09:00 (19).
      expect(selected()).toBe(49);
      key(focused(), "Escape");
      await flush();
      expect(selected()).toBe(0);
      expect(log.ranges).toHaveLength(0);
    });

    it("orders a backwards keyboard selection by (day, minute) too", async () => {
      const { slot, log } = await mount({ view: "week", date: "2031-03-04" });
      const s = slot(2, 540);
      s.focus();
      key(s, "ArrowLeft", { shiftKey: true });
      for (let step = 0; step < 10; step++) key(focused(), "ArrowDown", { shiftKey: true });
      await flush();
      expect(slot(1, 840).getAttribute("aria-selected")).toBe("true");
      expect(slot(1, 810).getAttribute("aria-selected")).toBeNull();
      expect(slot(2, 570).getAttribute("aria-selected")).toBeNull();
      key(focused(), "Enter");
      expect(log.ranges[0]).toEqual({ start: "2031-03-04T14:00:00", end: "2031-03-05T09:30:00", allDay: false, source: "keyboard" });
    });

    it("mirrors the horizontal selection keys in RTL, vertical unchanged", async () => {
      const { slot, selected, log } = await mount({ view: "week", date: "2031-03-04", dir: "rtl" });
      slot(1, 540).focus();
      key(slot(1, 540), "ArrowLeft", { shiftKey: true });
      await flush();
      expect(selected()).toBe(49);
      key(focused(), "Enter");
      expect(log.ranges.at(-1)).toEqual({ start: "2031-03-04T09:00:00", end: "2031-03-05T09:30:00", allDay: false, source: "keyboard" });
      key(slot(1, 540), "ArrowRight", { shiftKey: true });
      key(focused(), "Enter");
      expect(log.ranges.at(-1)).toEqual({ start: "2031-03-03T09:00:00", end: "2031-03-04T09:30:00", allDay: false, source: "keyboard" });
      key(slot(1, 540), "ArrowDown", { shiftKey: true });
      key(focused(), "Enter");
      expect(log.ranges.at(-1)).toEqual({ start: "2031-03-04T09:00:00", end: "2031-03-04T10:00:00", allDay: false, source: "keyboard" });
    });

    it("clamps the selection head to the visible range and never moves focus", async () => {
      const { slot, selected, liveText, log } = await mount({ view: "week", date: "2031-03-04" });
      const s = slot(6, 1410); // Sun 23:30, last slot
      s.focus();
      key(s, "ArrowDown", { shiftKey: true });
      key(s, "ArrowRight", { shiftKey: true });
      await flush();
      expect(selected()).toBe(1);
      expect(focused()).toBe(s);
      expect(log.ranges).toHaveLength(0);
      // The exclusive end of the last slot is the next day's midnight.
      expect(liveText()).toMatch(/11:30 PM.*Mar 10, 12:00 AM/);
    });

    it("announces an all-day selection by its inclusive last day", async () => {
      const { cell, selected, liveText, log } = await mount({ view: "week", date: "2031-03-04" });
      const c = cell(0); // Mon 3 Mar
      c.focus();
      key(c, "ArrowRight", { shiftKey: true });
      await flush();
      expect(selected(".rv-SchedulerTimeGrid-all-day-cell")).toBe(2);
      expect(liveText()).toContain(`${label(2031, 3, 3)} to ${label(2031, 3, 4)}`);
      key(focused(), "Enter");
      expect(log.ranges[0]).toEqual({ start: "2031-03-03", end: "2031-03-05", allDay: true, source: "keyboard" });
    });

    it("abandons a pending selection on plain navigation", async () => {
      const { slot, selected, log } = await mount({ view: "week", date: "2031-03-04" });
      const s = slot(1, 540);
      s.focus();
      key(s, "ArrowDown", { shiftKey: true });
      key(s, "ArrowDown", { shiftKey: true });
      await flush();
      expect(selected()).toBe(3);
      key(s, "ArrowUp");
      await flush();
      expect(selected()).toBe(0);
      expect(focused()).toBe(slot(1, 510));
      key(slot(1, 510), "Enter");
      expect(log.ranges).toHaveLength(0);
      expect(log.slotClicks.at(-1)?.date).toBe("2031-03-04T08:30:00");
      key(slot(1, 510), "ArrowDown", { shiftKey: true });
      await flush();
      expect(selected()).toBe(2);
      expect(slot(1, 540).getAttribute("aria-selected")).toBe("true");
      expect(slot(1, 570).getAttribute("aria-selected")).toBeNull();
    });
  });
});

// Chip cases (malva `MlvSchedulerEventChip`): `a` Wed 5 Mar 09:00–09:30 (week day 2), `lane` all-day Tue 4 → Thu 6.
const chipEvents = (): SchedulerEvent[] => [
  { id: "a", title: "Standup", start: "2031-03-05T09:00", end: "2031-03-05T09:30" },
  { id: "lane", title: "Offsite", start: "2031-03-04", end: "2031-03-06", allDay: true },
];

describe("Scheduler chip keyboard", () => {
  const week = (extra: Options = {}) => mount({ view: "week", date: "2031-03-05", events: chipEvents(), ...extra });

  it("emits click / dblclick / contextmenu with the chip element", async () => {
    const { chip, log } = await week();
    const a = chip("a");
    mouse(a, "click");
    mouse(a, "dblclick");
    const menu = mouse(a, "contextmenu");
    expect(menu.defaultPrevented).toBe(false);
    expect([log.eventClicks.length, log.eventDoubleClicks.length, log.eventContextMenus.length]).toEqual([1, 1, 1]);
    expect(log.eventClicks[0]).toMatchObject({ event: { id: "a" }, element: a });
    expect(log.slotClicks).toHaveLength(0);
  });

  it("activates on Enter and Space (Space does not scroll)", async () => {
    const { chip, log } = await week();
    key(chip("a"), "Enter");
    const space = key(chip("a"), " ");
    expect(space.defaultPrevented).toBe(true);
    expect(log.eventClicks.length).toBe(2);
    expect(log.eventClicks[1]!.nativeEvent).toBe(space);
  });

  it("emits the chip context menu from the ContextMenu key and Shift+F10", async () => {
    const { chip, log } = await week();
    expect(key(chip("a"), "ContextMenu").defaultPrevented).toBe(true);
    expect(key(chip("a"), "F10", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(log.eventContextMenus.map((e) => e.event.id)).toEqual(["a", "a"]);
    expect(log.slotContextMenus).toHaveLength(0);
  });

  describe("keyboard move and resize", () => {
    it("moves a timed chip by one snap step with Alt+ArrowDown and keeps focus on it", async () => {
      const { chip, log } = await week();
      chip("a").focus();
      const event = key(chip("a"), "ArrowDown", { altKey: true });
      expect(event.defaultPrevented).toBe(true);
      expect(log.moves).toHaveLength(1);
      expect(log.moves[0]).toMatchObject({ event: { start: "2031-03-05T09:30:00", end: "2031-03-05T10:00:00" }, source: "keyboard" });
      await settle();
      expect(focused()).toBe(chip("a"));
    });

    it("clamps a timed keyboard move to the visible time axis", async () => {
      const { chip, log } = await week({ minTime: "09:00", maxTime: "17:00" });
      const event = key(chip("a"), "ArrowUp", { altKey: true });
      expect(log.moves).toHaveLength(0);
      expect(event.defaultPrevented).toBe(true);
      key(chip("a"), "ArrowDown", { altKey: true });
      expect(log.moves[0]!.event.start).toBe("2031-03-05T09:30:00");
    });

    it("clamps a timed keyboard move at the far end of the axis too", async () => {
      const { chip, log } = await week({
        minTime: "09:00",
        maxTime: "17:00",
        events: [{ id: "a", title: "A", start: "2031-03-05T16:30", end: "2031-03-05T17:00" }],
      });
      key(chip("a"), "ArrowDown", { altKey: true });
      expect(log.moves).toHaveLength(0);
      key(chip("a"), "ArrowUp", { altKey: true });
      expect(log.moves[0]!.event.start).toBe("2031-03-05T16:00:00");
    });

    it("moves a timed chip forward one day with Alt+ArrowRight", async () => {
      const { chip, log } = await week();
      key(chip("a"), "ArrowRight", { altKey: true });
      expect(log.moves[0]!.event.start).toBe("2031-03-06T09:00:00");
    });

    it('mirrors the horizontal move in RTL: Alt+ArrowLeft is "next"', async () => {
      const { chip, log } = await week({ dir: "rtl" });
      key(chip("a"), "ArrowLeft", { altKey: true });
      expect(log.moves[0]!.event.start).toBe("2031-03-06T09:00:00");
    });

    it("moves a lane bar by a week with Alt+ArrowDown", async () => {
      const { chip, log } = await week();
      key(chip("lane"), "ArrowDown", { altKey: true });
      expect(log.moves[0]!.event).toMatchObject({ start: "2031-03-11", end: "2031-03-13", allDay: true });
    });

    it("moves a lane bar by a day with Alt+ArrowRight", async () => {
      const { chip, log } = await week();
      key(chip("lane"), "ArrowRight", { altKey: true });
      expect(log.moves[0]!.event).toMatchObject({ start: "2031-03-05", end: "2031-03-07", allDay: true });
    });

    it("resizes a timed chip end edge with Alt+Shift+ArrowDown", async () => {
      const { chip, log } = await week();
      key(chip("a"), "ArrowDown", { altKey: true, shiftKey: true });
      expect(log.resizes[0]).toMatchObject({ event: { end: "2031-03-05T10:00:00" }, source: "keyboard" });
    });

    it("shrinks a lane bar to one day and then refuses to go below it", async () => {
      const { chip, log } = await week();
      key(chip("lane"), "ArrowLeft", { altKey: true, shiftKey: true });
      expect(log.resizes[0]!.event.end).toBe("2031-03-05");
      await settle();
      key(chip("lane"), "ArrowLeft", { altKey: true, shiftKey: true });
      expect(log.resizes).toHaveLength(1);
    });

    it("navigates when a move leaves the visible range", async () => {
      const { chip, date } = await mount({ view: "day", date: "2031-03-05", events: chipEvents() });
      chip("a").focus();
      key(chip("a"), "ArrowRight", { altKey: true });
      await settle();
      expect(date()).toBe("2031-03-06");
      expect(focused()).toBe(chip("a"));
    });

    it("ignores modifiers when not editable", async () => {
      const { chip, log, readOnly } = await week();
      readOnly.set(true);
      await flush();
      const event = key(chip("a"), "ArrowDown", { altKey: true });
      expect(event.defaultPrevented).toBe(false);
      expect(log.moves).toHaveLength(0);
    });

    it("resizes the start edge of a timed chip with Ctrl+Alt+ArrowUp and clamps at one snap", async () => {
      const { chip, log, events } = await week();
      key(chip("a"), "ArrowUp", { altKey: true, ctrlKey: true });
      expect(log.resizes[0]!.event).toMatchObject({ start: "2031-03-05T08:30:00", end: "2031-03-05T09:30:00" });
      events.set(chipEvents()); // back to 09:00–09:30: exactly one snap long
      await settle();
      key(chip("a"), "ArrowDown", { altKey: true, ctrlKey: true });
      expect(log.resizes).toHaveLength(1);
    });

    it("resizes the start edge of a lane bar with Ctrl+Alt+Arrow", async () => {
      const { chip, log } = await week();
      key(chip("lane"), "ArrowRight", { altKey: true, ctrlKey: true });
      expect(log.resizes[0]!.event).toMatchObject({ start: "2031-03-05", end: "2031-03-06", allDay: true });
    });

    it("leaves Alt+Shift+ArrowLeft on a timed chip to the grid", async () => {
      const { chip, log } = await week();
      const event = key(chip("a"), "ArrowLeft", { altKey: true, shiftKey: true });
      expect(event.defaultPrevented).toBe(false);
      expect(log.resizes).toHaveLength(0);
    });

    it("Escape focuses the owning cell", async () => {
      const { chip, cell } = await week();
      const bar = chip("lane");
      bar.focus();
      key(bar, "Escape");
      expect(focused()).toBe(cell(1));
    });

    it("returns focus to the segment the move was made from, not the first one", async () => {
      // Wed 23:00 → Thu 01:00 renders one chip per day column, both `data-rv-event-id="x"`.
      const { chipsOf, dayIndexOf, log } = await mount({
        view: "week",
        date: "2031-03-05",
        events: [{ id: "x", title: "Night shift", start: "2031-03-05T23:00", end: "2031-03-06T01:00" }],
      });
      expect(chipsOf("x").map((c) => dayIndexOf(c))).toEqual(["2", "3"]);
      const second = chipsOf("x")[1]!;
      second.focus();
      key(second, "ArrowRight", { altKey: true });
      await settle();
      expect(log.moves).toHaveLength(1);
      expect(dayIndexOf(focused())).toBe("4");
    });

    it("keeps both announcements when the same move also changes the period", async () => {
      const { chip, root, log } = await mount({
        view: "week",
        date: "2031-03-05",
        events: [{ id: "x", title: "Night shift", start: "2031-03-09T09:00", end: "2031-03-09T10:00" }],
      });
      chip("x").focus();
      key(chip("x"), "ArrowRight", { altKey: true });
      await settle();
      expect(log.moves).toHaveLength(1);
      const regions = Array.from(root.querySelectorAll('[role="status"]')).map((node) => node.textContent?.trim() ?? "");
      expect(regions.filter((text) => text !== "")).toHaveLength(2);
      expect(regions.some((text) => text.includes("Night shift moved to"))).toBe(true);
      expect(regions.some((text) => text.startsWith("Showing"))).toBe(true);
      expect(focused()).toBe(chip("x"));
    });
  });

  describe("delete keys and focus on removal", () => {
    it("Delete emits the delete interaction with the chip and the prevented key", async () => {
      const { chip, log, events } = await week();
      const event = key(chip("a"), "Delete");
      expect(event.defaultPrevented).toBe(true);
      expect(log.deletes).toHaveLength(1);
      expect(log.deletes[0]).toMatchObject({ event: { id: "a" }, element: chip("a") });
      expect(log.deletes[0]!.nativeEvent).toBe(event);
      expect(events()).toHaveLength(2); // emitted, never written
    });

    it("Backspace does the same", async () => {
      const { chip, log } = await week();
      const event = key(chip("a"), "Backspace");
      expect(event.defaultPrevented).toBe(true);
      expect(log.deletes[0]!.nativeEvent).toBe(event);
    });

    it("leaves the keys alone while not editable, and with a modifier held", async () => {
      const { chip, log, readOnly } = await week();
      readOnly.set(true);
      await flush();
      expect(key(chip("a"), "Delete").defaultPrevented).toBe(false);
      expect(key(chip("a"), "Backspace").defaultPrevented).toBe(false);
      readOnly.set(false);
      await flush();
      expect(key(chip("a"), "Delete", { metaKey: true }).defaultPrevented).toBe(false);
      expect(key(chip("a"), "Backspace", { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(log.deletes).toHaveLength(0);
    });

    it("Delete on a month chip emits eventDelete and, once the consumer drops the event, focuses its cell", async () => {
      const { chip, log, events, dayIndexOf } = await mount({ date: "2031-03-05", events: chipEvents() });
      const a = chip("a");
      a.focus();
      key(a, "Delete");
      expect(log.deletes).toHaveLength(1);
      await settle();
      expect(focused()).toBe(a); // the scheduler writes nothing; the consumer does
      events.set(events().filter((e) => e.id !== "a"));
      await settle();
      expect(a.isConnected).toBe(false);
      expect(dayIndexOf(focused())).toBe("9"); // Wed 5 Mar
      expect(focused().dataset["rvMinutes"]).toBe("all-day");
    });

    it("Backspace on a timed week chip focuses the slot the chip started in", async () => {
      const { chip, events } = await week();
      const a = chip("a");
      a.focus();
      expect(key(a, "Backspace").defaultPrevented).toBe(true);
      events.set(events().filter((e) => e.id !== "a"));
      await settle();
      expect(focused().dataset["rvDayIndex"]).toBe("2");
      expect(focused().dataset["rvMinutes"]).toBe("540");
    });

    it("hands focus to the cell even when the browser blurs the chip before detaching it", async () => {
      const { chip, events, cell } = await week();
      const bar = chip("lane");
      bar.focus();
      key(bar, "Delete");
      bar.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
      events.set(events().filter((e) => e.id !== "lane"));
      await settle();
      expect(focused()).toBe(cell(1));
    });

    it("asks for nothing when removed without focus", async () => {
      const { events, slot } = await week();
      const anchor = slot(0, 600);
      anchor.focus();
      events.set(events().filter((e) => e.id !== "lane"));
      await settle();
      expect(focused()).toBe(anchor);
    });

    it("asks for nothing once focus has already left it", async () => {
      const { chip, cell, events } = await week();
      const bar = chip("lane");
      bar.focus();
      cell(3).focus();
      events.set(events().filter((e) => e.id !== "lane"));
      await settle();
      expect(focused()).toBe(cell(3));
    });

    it("asks for nothing when focus went to the body before a later removal", async () => {
      const { chip, events } = await week();
      const bar = chip("lane");
      bar.focus();
      bar.blur(); // focus genuinely on the body, the chip lives on
      await settle();
      events.set(events().filter((e) => e.id !== "lane"));
      await settle();
      expect(focused()).toBe(document.body);
    });

    it("keeps the return when the chip still has focus at the microtask", async () => {
      const { chip, events, cell } = await week();
      const bar = chip("lane");
      bar.focus();
      bar.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
      expect(focused()).toBe(bar);
      await Promise.resolve();
      events.set(events().filter((e) => e.id !== "lane"));
      await settle();
      expect(focused()).toBe(cell(1));
    });

    it("never overwrites a focus request inside its resolve window", async () => {
      const { chip, events, state, root } = await week();
      const bar = chip("lane");
      bar.focus();
      const s = state();
      // A keyboard move files a request for the moved chip (resolve window open); the chip then goes.
      key(bar, "ArrowRight", { altKey: true });
      const request = s.pendingFocus();
      expect(request).not.toBeNull();
      events.set(events().filter((e) => e.id !== "lane"));
      await settle();
      expect(s.pendingFocus()).toBeNull();
      expect(focused()).not.toBe(root.querySelector('[data-rv-day-index="1"][data-rv-minutes="all-day"]'));
    });

    it("replaces a stale request filed outside any resolve window (review T7+T8 #3)", async () => {
      const { chip, events, state, cell } = await week();
      const bar = chip("lane");
      bar.focus();
      const s = state();
      // Written past `requestFocus` (no resolution scheduled): stale, so it must not block the hand-off for good.
      s.pendingFocus.set({ eventId: "missing", day: null, minutes: null });
      events.set(events().filter((e) => e.id !== "lane"));
      await settle();
      expect(s.pendingFocus()).toBeNull();
      expect(focused()).toBe(cell(1));
    });
  });

  describe("projected interactive content", () => {
    it("leaves clicks and keys from a projected control alone", async () => {
      const events = signal<readonly SchedulerEvent[]>(chipEvents());
      const clicks: SchedulerEventInteraction[] = [];
      const moves: SchedulerEventChange[] = [];
      const { container } = render(() => (
        <Scheduler
          events={events}
          defaultView="week"
          defaultDate="2031-03-05"
          timeZone="UTC"
          locale="en-US"
          firstDayOfWeek="mon"
          onEventAction={(e) => clicks.push(e)}
          onEventMove={(e) => moves.push(e)}
          renderEvent={(event) => (
            <button type="button" class="custom-action">
              {event.title}
            </button>
          )}
        />
      ));
      await settle();
      const chipEl = container.querySelector<HTMLElement>('[data-rv-event-id="a"]')!;
      const inner = chipEl.querySelector<HTMLElement>(".custom-action")!;
      inner.click();
      const enter = key(inner, "Enter");
      const move = key(inner, "ArrowDown", { altKey: true });
      expect(clicks).toHaveLength(0);
      expect(enter.defaultPrevented).toBe(false);
      expect(move.defaultPrevented).toBe(false);
      expect(moves).toHaveLength(0);
      mouse(chipEl, "click");
      expect(clicks).toHaveLength(1);
    });
  });
});
