// Ported from @malva-ui/scheduler (src/lib/scheduler/scheduler-context-menu.spec.ts), MIT, © 2026 Malva UI.
// Changes:
// - `<mlv-scheduler>` + `*mlvSchedulerSlotMenuDef` / `*mlvSchedulerEventMenuDef` → `<Scheduler renderSlotMenu
//   renderEventMenu>` returning cdk `MenuItem`s; dates are strings (September 2026, `firstDayOfWeek="mon"`, UTC), so
//   the ranges come back as strings; `data-day-index` / `data-minutes` / `data-event-id` → `data-rv-*`.
// - "Completes the popup's leave animation by hand" → real Chromium (no leave animation in the headless panel):
//   `settle()` waits for the close and the focus scope's restore.
// - "forwards the resolved density to the detached panel" → the panel carries its own `rv-SchedulerMenu*` classes
//   (cdk has no density; `@rivetjs/ui` styles the panel, T11).
// - "passes axe with the menu open" → structural ARIA check (role / name / items) here; axe runs in T12.
import { afterEach, describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { MenuItem } from "../menu/index.tsx";
import {
  Scheduler,
  type SchedulerEvent,
  type SchedulerEventInteraction,
  type SchedulerRange,
  type SchedulerRangeSelectEvent,
  type SchedulerSlotEvent,
  type SchedulerView,
} from "../scheduler/index.tsx";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
  await sleep(60);
  await flush();
};
const rightClick = (x = 120, y = 90) =>
  new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2, buttons: 2, detail: 0 });
/** The `contextmenu` browsers synthesise for Shift+F10 / the ContextMenu key. */
const keyboardContextMenu = () => new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 0, clientY: 0, button: 0, buttons: 0, detail: 0 });
const shiftF10 = () => new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true });
const key = (target: Element, k: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
const focused = () => document.activeElement as HTMLElement;

afterEach(async () => {
  cleanup();
  document.body.click();
  await flush();
});

interface Options {
  withSlotMenu?: boolean;
  withEventMenu?: boolean;
  view?: SchedulerView;
}

async function mount(options: Options = {}) {
  const events = signal<readonly SchedulerEvent[]>([
    { id: "a", title: "Standup", start: "2026-09-02T09:00", end: "2026-09-02T09:30" },
    { id: "b", title: "Offsite", start: "2026-09-03", end: "2026-09-05", allDay: true },
  ]);
  const view = signal<SchedulerView>(options.view ?? "month");
  const maxTime = signal("24:00");
  const slotDuration = signal(30);
  const log = {
    slotMenus: [] as SchedulerSlotEvent[],
    eventMenus: [] as SchedulerEventInteraction[],
    ranges: [] as SchedulerRangeSelectEvent[],
    created: [] as SchedulerRange[],
    edited: [] as SchedulerEvent[],
  };
  const withSlotMenu = options.withSlotMenu ?? true;
  const withEventMenu = options.withEventMenu ?? true;
  const { container } = render(() => (
    <Scheduler
      events={events}
      view={view}
      date="2026-09-02"
      timeZone="UTC"
      locale="en-US"
      firstDayOfWeek="mon"
      maxTime={maxTime()}
      slotDuration={slotDuration()}
      showCurrentTime={false}
      onSlotContextMenu={(e) => log.slotMenus.push(e)}
      onEventContextMenu={(e) => log.eventMenus.push(e)}
      onRangeSelect={(e) => log.ranges.push(e)}
      renderSlotMenu={
        withSlotMenu
          ? (range, { selection, view: at }) => [
              <MenuItem class="slot-item" onAction={() => log.created.push(range)}>
                {"New event in " + at}
              </MenuItem>,
              selection ? <MenuItem class="selection-item">Block selection</MenuItem> : null,
            ]
          : undefined
      }
      renderEventMenu={
        withEventMenu
          ? (event, { view: at }) => (
              <MenuItem class="event-item" onAction={() => log.edited.push(event)}>
                {"Edit " + event.title + " in " + at}
              </MenuItem>
            )
          : undefined
      }
    />
  ));
  await settle();
  const root = container.querySelector<HTMLElement>("[data-rv-scheduler]")!;
  const q = <E extends Element = HTMLElement>(selector: string) => {
    const found = document.querySelector<E>(selector);
    if (!found) throw new Error("missing " + selector);
    return found;
  };
  return {
    root,
    log,
    view,
    maxTime,
    slotDuration,
    q,
    /** Month cell / all-day cell of visible day `index` (0 = Mon 31 Aug 2026). */
    dayCell: (index: number) => root.querySelector<HTMLElement>(`[data-rv-day-index="${index}"][data-rv-minutes="all-day"]`)!,
    slot: (index: number, minutes: number) => root.querySelector<HTMLElement>(`[data-rv-day-index="${index}"][data-rv-minutes="${minutes}"]`)!,
    chip: (id: string) => root.querySelector<HTMLElement>(`.rv-SchedulerEvent[data-rv-event-id="${id}"]`)!,
    panel: () => document.querySelector<HTMLElement>(".rv-SchedulerMenu[role=menu]"),
    panels: () => document.querySelectorAll(".rv-SchedulerMenu[role=menu]").length,
    item: (cls: string) => document.querySelector<HTMLElement>(".rv-SchedulerMenu ." + cls),
  };
}

describe("Scheduler context menus", () => {
  it("opens the event menu on a chip right-click with the event and still emits onEventContextMenu", async () => {
    const t = await mount();
    const event = rightClick();
    t.chip("a").dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(t.panel()).toBeTruthy();
    expect(t.item("event-item")!.textContent!.trim()).toBe("Edit Standup in month");
    expect(t.item("slot-item")).toBeNull();
    expect(t.log.eventMenus.map((e) => e.event.id)).toEqual(["a"]);
    expect(t.log.eventMenus[0]!.nativeEvent.defaultPrevented).toBe(true);
    expect(t.panel()!.getAttribute("aria-label")).toBe("Actions for Standup");
  });

  it("opens the slot menu on an empty month cell with the whole day as the range, and closes on activation", async () => {
    const t = await mount();
    const event = rightClick();
    t.dayCell(10).dispatchEvent(event); // Thu 10 Sep
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(t.item("slot-item")!.textContent!.trim()).toBe("New event in month");
    expect(t.item("selection-item")).toBeNull();
    expect(t.item("event-item")).toBeNull();
    expect(t.log.slotMenus.map((e) => e.date)).toEqual(["2026-09-10"]);
    expect(t.panel()!.getAttribute("aria-label")).toBe("Actions for Thursday, September 10, 2026");
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created).toEqual([{ start: "2026-09-10", end: "2026-09-11", allDay: true }]);
    expect(t.panel()).toBeNull();
  });

  it("uses the slot duration as the range on the time grid", async () => {
    const t = await mount({ view: "week" });
    t.slot(2, 570).dispatchEvent(rightClick()); // Wed 2 Sep, 09:30
    await settle();
    expect(t.item("slot-item")!.textContent!.trim()).toBe("New event in week");
    expect(t.panel()!.getAttribute("aria-label")).toBe("Actions for Sep 2, 9:30 AM");
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created).toEqual([{ start: "2026-09-02T09:30:00", end: "2026-09-02T10:00:00", allDay: false }]);
  });

  it("hands a pending keyboard selection to the slot menu when the cell is inside it", async () => {
    const t = await mount();
    const anchor = t.dayCell(10);
    anchor.focus();
    key(anchor, "ArrowRight", { shiftKey: true });
    key(anchor, "ArrowRight", { shiftKey: true });
    await settle();
    expect(t.dayCell(12).getAttribute("aria-selected")).toBe("true");
    t.dayCell(11).dispatchEvent(rightClick());
    await settle();
    expect(t.item("selection-item")).toBeTruthy();
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created).toEqual([{ start: "2026-09-10", end: "2026-09-13", allDay: true }]);
    // A cell outside the selection gets its own day, not the selection.
    t.dayCell(5).dispatchEvent(rightClick());
    await settle();
    expect(t.item("selection-item")).toBeNull();
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created.at(-1)).toEqual({ start: "2026-09-05", end: "2026-09-06", allDay: true });
  });

  it("releases the pending month selection once the menu that took it is activated, so Enter commits nothing", async () => {
    const t = await mount();
    const anchor = t.dayCell(10);
    anchor.focus();
    key(anchor, "ArrowRight", { shiftKey: true });
    await settle();
    expect(t.dayCell(11).getAttribute("aria-selected")).toBe("true");
    t.dayCell(11).dispatchEvent(rightClick());
    await settle();
    t.item("selection-item")!.click();
    await settle();
    expect(t.panel()).toBeNull();
    expect(t.dayCell(10).getAttribute("aria-selected")).toBeNull();
    expect(t.dayCell(11).getAttribute("aria-selected")).toBeNull();
    key(focused(), "Enter");
    await settle();
    expect(t.log.ranges).toEqual([]);
  });

  it("releases the pending month selection when the menu that took it is dismissed with Escape", async () => {
    const t = await mount();
    const anchor = t.dayCell(10);
    anchor.focus();
    key(anchor, "ArrowRight", { shiftKey: true });
    await settle();
    t.dayCell(10).dispatchEvent(keyboardContextMenu());
    await settle();
    expect(focused()).toBe(t.item("slot-item"));
    key(focused(), "Escape");
    await settle();
    expect(t.panel()).toBeNull();
    expect(focused()).toBe(t.dayCell(10));
    expect(t.dayCell(10).getAttribute("aria-selected")).toBeNull();
    expect(t.dayCell(11).getAttribute("aria-selected")).toBeNull();
  });

  it("keeps a pending selection the menu did not take", async () => {
    const t = await mount();
    const anchor = t.dayCell(10);
    anchor.focus();
    key(anchor, "ArrowRight", { shiftKey: true });
    await settle();
    t.dayCell(5).dispatchEvent(rightClick());
    await settle();
    expect(t.item("selection-item")).toBeNull();
    t.item("slot-item")!.click();
    await settle();
    expect(t.dayCell(10).getAttribute("aria-selected")).toBe("true");
    expect(t.dayCell(11).getAttribute("aria-selected")).toBe("true");
  });

  it("hands a pending time-grid selection to the slot menu and releases it on close", async () => {
    const t = await mount({ view: "week" });
    const anchor = t.slot(2, 540);
    anchor.focus();
    key(anchor, "ArrowDown", { shiftKey: true });
    key(anchor, "ArrowDown", { shiftKey: true });
    await settle();
    expect(t.slot(2, 600).getAttribute("aria-selected")).toBe("true");
    t.slot(2, 570).dispatchEvent(rightClick());
    await settle();
    expect(t.item("selection-item")).toBeTruthy();
    expect(t.panel()!.getAttribute("aria-label")).toBe("Actions for Sep 2, 9:00 AM");
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created).toEqual([{ start: "2026-09-02T09:00:00", end: "2026-09-02T10:30:00", allDay: false }]);
    expect(t.slot(2, 540).getAttribute("aria-selected")).toBeNull();
    expect(t.slot(2, 600).getAttribute("aria-selected")).toBeNull();
  });

  it("uses the whole day as the range on an all-day cell of the week view", async () => {
    const t = await mount({ view: "week" });
    t.dayCell(2).dispatchEvent(rightClick()); // Wed 2 Sep all-day cell
    await settle();
    expect(t.panel()!.getAttribute("aria-label")).toBe("Actions for Wednesday, September 2, 2026");
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created).toEqual([{ start: "2026-09-02", end: "2026-09-03", allDay: true }]);
  });

  it("clamps the slot range to maxTime and maps the end of the axis to the next midnight", async () => {
    const t = await mount({ view: "week" });
    t.maxTime.set("09:30");
    t.slotDuration.set(60);
    await settle();
    t.slot(2, 540).dispatchEvent(rightClick()); // 09:00, the axis ends at 09:30
    await settle();
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created.at(-1)).toEqual({ start: "2026-09-02T09:00:00", end: "2026-09-02T09:30:00", allDay: false });
    t.maxTime.set("24:00");
    t.slotDuration.set(30);
    await settle();
    t.slot(2, 1410).dispatchEvent(rightClick()); // 23:30, the last slot
    await settle();
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created.at(-1)).toEqual({ start: "2026-09-02T23:30:00", end: "2026-09-03T00:00:00", allDay: false });
  });

  it("renders the panel with its own classes in the overlay layer (density: ui)", async () => {
    const t = await mount();
    t.chip("a").dispatchEvent(rightClick());
    await settle();
    const panel = t.panel()!;
    expect(panel.closest(".rv-SchedulerMenu-popover")).toBeTruthy();
    expect(t.root.contains(panel)).toBe(false);
  });

  it("opens from the keyboard anchored to the focused chip, focuses the first item and returns focus on Escape", async () => {
    const t = await mount();
    const target = t.chip("a");
    target.focus();
    target.dispatchEvent(keyboardContextMenu());
    await settle();
    expect(focused()).toBe(t.item("event-item"));
    key(focused(), "Escape");
    await settle();
    expect(t.panel()).toBeNull();
    expect(focused()).toBe(target);
  });

  it("opens the event menu on Shift+F10 on a focused chip, anchored with the first item focused, and returns focus on Escape", async () => {
    const t = await mount();
    const target = t.chip("a");
    target.focus();
    const event = shiftF10();
    target.dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(t.panel()!.getAttribute("aria-label")).toBe("Actions for Standup");
    expect(focused()).toBe(t.item("event-item"));
    expect(t.log.eventMenus.map((e) => e.event.id)).toEqual(["a"]);
    key(focused(), "Escape");
    await settle();
    expect(t.panel()).toBeNull();
    expect(focused()).toBe(target);
  });

  it("opens the slot menu on the ContextMenu key on a focused month cell with the whole day as the range", async () => {
    const t = await mount();
    const cell = t.dayCell(10);
    cell.focus();
    const event = new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true, cancelable: true });
    cell.dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(t.panel()!.getAttribute("aria-label")).toBe("Actions for Thursday, September 10, 2026");
    expect(focused()).toBe(t.item("slot-item"));
    expect(t.log.slotMenus.map((e) => e.date)).toEqual(["2026-09-10"]);
    // Released with focus already inside the panel: the keyup Windows would synthesise a second contextmenu from is
    // claimed there too.
    const release = new KeyboardEvent("keyup", { key: "ContextMenu", bubbles: true, cancelable: true });
    focused().dispatchEvent(release);
    expect(release.defaultPrevented).toBe(true);
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created).toEqual([{ start: "2026-09-10", end: "2026-09-11", allDay: true }]);
    expect(focused()).toBe(cell);
  });

  it("hands a pending selection to the slot menu on Shift+F10 inside it and keeps it until the menu closes", async () => {
    const t = await mount();
    const anchor = t.dayCell(10);
    anchor.focus();
    key(anchor, "ArrowRight", { shiftKey: true });
    key(anchor, "ArrowRight", { shiftKey: true });
    await settle();
    expect(t.dayCell(12).getAttribute("aria-selected")).toBe("true");
    // Focus stays on the anchor while the head moves, so the key lands there.
    anchor.dispatchEvent(shiftF10());
    await settle();
    expect(t.item("selection-item")).toBeTruthy();
    // Opening did not abandon the selection the way a plain key would.
    expect(t.dayCell(12).getAttribute("aria-selected")).toBe("true");
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created).toEqual([{ start: "2026-09-10", end: "2026-09-13", allDay: true }]);
    expect(t.dayCell(12).getAttribute("aria-selected")).toBeNull();
  });

  it("opens the slot menu on Shift+F10 on a focused time-grid slot", async () => {
    const t = await mount({ view: "week" });
    const target = t.slot(2, 570);
    target.focus();
    const event = shiftF10();
    target.dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(t.panel()!.getAttribute("aria-label")).toBe("Actions for Sep 2, 9:30 AM");
    expect(focused()).toBe(t.item("slot-item"));
    t.item("slot-item")!.click();
    await settle();
    expect(t.log.created).toEqual([{ start: "2026-09-02T09:30:00", end: "2026-09-02T10:00:00", allDay: false }]);
  });

  it("claims the key without a def — prevented, no second contextmenu — opens nothing and emits once", async () => {
    const t = await mount({ withEventMenu: false });
    const target = t.chip("a");
    target.focus();
    const event = shiftF10();
    target.dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(t.panel()).toBeNull();
    expect(t.log.eventMenus.map((e) => e.event.id)).toEqual(["a"]);
    expect(t.log.eventMenus[0]!.nativeEvent).toBe(event);
    // The ContextMenu key: Windows synthesises from its keyup, so that is claimed too.
    const press = new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true, cancelable: true });
    target.dispatchEvent(press);
    await settle();
    expect(press.defaultPrevented).toBe(true);
    expect(t.log.eventMenus.length).toBe(2);
    const release = new KeyboardEvent("keyup", { key: "ContextMenu", bubbles: true, cancelable: true });
    target.dispatchEvent(release);
    expect(release.defaultPrevented).toBe(true);
    // A held key's repeats are claimed but emit nothing more.
    const repeat = shiftF10();
    Object.defineProperty(repeat, "repeat", { value: true });
    target.dispatchEvent(repeat);
    await settle();
    expect(repeat.defaultPrevented).toBe(true);
    expect(t.log.eventMenus.length).toBe(2);
  });

  it("re-targets an open menu on a second right-click instead of stacking a panel", async () => {
    const t = await mount();
    t.chip("a").dispatchEvent(rightClick());
    await settle();
    expect(t.item("event-item")).toBeTruthy();
    t.dayCell(10).dispatchEvent(rightClick(300, 300));
    await settle();
    expect(t.panels()).toBe(1);
    expect(t.item("event-item")).toBeNull();
    expect(t.item("slot-item")).toBeTruthy();
  });

  it("leaves the native event alone and opens nothing when the matching def is missing", async () => {
    const t = await mount({ withEventMenu: false });
    const onChip = rightClick();
    t.chip("a").dispatchEvent(onChip);
    await settle();
    expect(onChip.defaultPrevented).toBe(false);
    expect(t.panel()).toBeNull();
    expect(t.log.eventMenus.map((e) => e.event.id)).toEqual(["a"]);
    // The slot def is still there, so cells keep their menu.
    const onCell = rightClick();
    t.dayCell(10).dispatchEvent(onCell);
    await settle();
    expect(onCell.defaultPrevented).toBe(true);
    expect(t.item("slot-item")).toBeTruthy();
  });

  it("renders no menu plumbing at all without any def", async () => {
    const t = await mount({ withEventMenu: false, withSlotMenu: false });
    const event = rightClick();
    t.dayCell(10).dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(false);
    expect(t.panel()).toBeNull();
    expect(document.querySelector(".rv-SchedulerMenu-popover")).toBeNull();
    expect(t.log.slotMenus.map((e) => e.date)).toEqual(["2026-09-10"]);
  });

  it("exposes a named menu of menu items while open", async () => {
    const t = await mount();
    t.chip("a").dispatchEvent(rightClick());
    await settle();
    const panel = t.panel()!;
    expect(panel.getAttribute("role")).toBe("menu");
    expect(panel.getAttribute("aria-label")).toBe("Actions for Standup");
    expect([...panel.querySelectorAll("[role=menuitem]")].map((item) => item.textContent!.trim())).toEqual(["Edit Standup in month"]);
  });
});
