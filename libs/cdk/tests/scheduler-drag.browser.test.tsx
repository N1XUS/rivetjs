// Ported from @malva-ui/scheduler (src/lib/drag/scheduler-drag.service.spec.ts, src/lib/event/scheduler-event.spec.ts
// drag / resize blocks, src/lib/month/scheduler-month.spec.ts popover-while-dragging), MIT, © 2026 Malva UI.
// Changes (SortableJS → cdk DragRef, mapping table in `libs/cdk/scheduler/CLAUDE.md`): `drag.handleStart / handleMove /
// handleEnd` with fake Sortable events → real mouse / touch / pointer events on the rendered chips (the delegated
// `schedulerPress` loads `drag.ts`); `sortableFor` / `unregister` / `dragGroup` cases have no counterpart (no
// per-list instances: one DragRef per press, disposed on release); "list destroyed mid-gesture" → the chip leaves the
// DOM mid-gesture; jsdom geometry → a test stylesheet in Chromium (vitest iframe ≈ 414 px: every layout ≤ 392 px wide
// so `elementFromPoint` reaches the targets). Week of Mon 3 – Sun 9 March 2031 (UTC), month March 2031 (Mon 24 Feb –).
import { afterEach, describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { dispatchKeyboardEvent, dispatchMouseEvent, dispatchPointerEvent } from "@rivetjs/testing/fake-events";
import { Scheduler, type SchedulerEvent, type SchedulerEventChange, type SchedulerState, type SchedulerView } from "../scheduler/index.tsx";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
  await sleep(20);
  await flush();
};

const css = `
  body { margin: 0; }
  .rv-Scheduler { width: 392px; font: 12px/1 sans-serif; }
  .rv-Scheduler * { box-sizing: border-box; }
  .rv-SchedulerTimeGrid-scroller { height: 600px; }
  .rv-SchedulerTimeGrid-header, .rv-SchedulerTimeGrid-all-day, .rv-SchedulerTimeGrid-body { display: flex; }
  .rv-SchedulerTimeGrid-corner, .rv-SchedulerTimeGrid-all-day-label, .rv-SchedulerTimeGrid-gutter { width: 42px; flex: none; }
  .rv-SchedulerTimeGrid-day-header, .rv-SchedulerTimeGrid-all-day-cell, .rv-SchedulerTimeGrid-column { width: 50px; flex: none; position: relative; }
  .rv-SchedulerTimeGrid-day-header { height: 20px; }
  .rv-SchedulerTimeGrid-all-day-cell { height: 40px; }
  .rv-SchedulerTimeGrid-slot { height: 10px; }
  .rv-SchedulerTimeGrid-hour { display: none; }
  .rv-SchedulerTimeGrid-events { position: absolute; inset: 0; pointer-events: none; }
  .rv-SchedulerTimeGrid-events .rv-SchedulerEvent { position: absolute; pointer-events: auto; top: var(--rv-scheduler-event-top); height: var(--rv-scheduler-event-height); inset-inline-start: var(--rv-scheduler-event-start); width: var(--rv-scheduler-event-width); background: #8cf; }
  .rv-SchedulerMonth-weekdays, .rv-SchedulerMonth-row { display: flex; }
  .rv-SchedulerMonth-weekday, .rv-SchedulerMonth-cell { width: 56px; flex: none; }
  .rv-SchedulerMonth-cell { height: 80px; position: relative; }
  .rv-SchedulerMonth-day-number { display: block; height: 14px; }
  .rv-SchedulerMonth-lanes, .rv-SchedulerTimeGrid-all-day-lanes { position: relative; }
  .rv-SchedulerMonth-lanes > .rv-SchedulerEvent, .rv-SchedulerTimeGrid-all-day-lanes > .rv-SchedulerEvent, .rv-SchedulerMonth-more {
    position: absolute; top: calc((var(--rv-scheduler-lane) - 1) * 18px); height: 16px; inset-inline-start: var(--rv-scheduler-lane-shift, 0px);
    width: calc(var(--rv-scheduler-span, 1) * 100%); z-index: 1; background: #fc8; padding: 0; border: 0; }
  .rv-SchedulerMonth-popover { width: 150px; background: #fff; }
  .rv-SchedulerMonth-popover .rv-SchedulerEvent { position: relative; height: 16px; }
  .rv-SchedulerEvent-resize-handle { position: absolute; z-index: 2; }
  [data-timed] > .rv-SchedulerEvent-resize-handle { inset-inline: 0; height: 6px; }
  [data-timed] > .rv-SchedulerEvent-resize-handle[data-edge="start"] { top: 0; }
  [data-timed] > .rv-SchedulerEvent-resize-handle[data-edge="end"] { bottom: 0; }
  [data-all-day] > .rv-SchedulerEvent-resize-handle { inset-block: 0; width: 6px; }
  [data-all-day] > .rv-SchedulerEvent-resize-handle[data-edge="start"] { inset-inline-start: 0; }
  [data-all-day] > .rv-SchedulerEvent-resize-handle[data-edge="end"] { inset-inline-end: 0; }
`;

let sheet: HTMLStyleElement | null = null;
afterEach(async () => {
  cleanup();
  sheet?.remove();
  sheet = null;
  for (const clone of Array.from(document.querySelectorAll("[data-rv-drag-clone]"))) clone.remove();
  // Lets a swallow-next-click listener of the previous case lapse.
  document.body.click();
});

const weekEvents = (): SchedulerEvent[] => [
  { id: "a", title: "A", start: "2031-03-04T09:00", end: "2031-03-04T10:00", color: "success", cssColor: "rgb(10, 20, 30)" },
  { id: "d", title: "D", start: "2031-03-05", end: "2031-03-06", allDay: true },
  { id: "x", title: "X", start: "2031-03-06T12:00", end: "2031-03-07T10:00" },
];

interface Setup {
  view?: SchedulerView;
  events?: SchedulerEvent[];
  dir?: "rtl";
  readOnly?: () => boolean;
  canMove?: (event: SchedulerEvent, next: unknown) => boolean;
  canResize?: (event: SchedulerEvent, next: unknown) => boolean;
  visibleLanes?: number;
}

async function setup(options: Setup = {}) {
  sheet = document.createElement("style");
  sheet.textContent = css;
  document.head.append(sheet);
  const events = signal<readonly SchedulerEvent[]>(options.events ?? weekEvents());
  const moves: SchedulerEventChange[] = [];
  const resizes: SchedulerEventChange[] = [];
  const stateRef = signal<SchedulerState | null>(null);
  const readOnly = options.readOnly ?? (() => false);
  const { container } = render(() => (
    <div dir={options.dir}>
      <Scheduler
        events={events}
        defaultView={options.view ?? "week"}
        defaultDate="2031-03-04"
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        businessHours={null}
        visibleLanes={options.visibleLanes ?? 3}
        isReadOnly={readOnly()}
        canMove={options.canMove}
        canResize={options.canResize}
        onEventMove={(change) => moves.push(change)}
        onEventResize={(change) => resizes.push(change)}
        stateRef={stateRef}
      />
    </div>
  ));
  await settle();
  const root = container.querySelector<HTMLElement>("[data-rv-scheduler]")!;
  return { root, events, moves, resizes, state: () => stateRef()! };
}

const chipOf = (root: ParentNode, id: string, dayIndex?: number) => {
  const all = Array.from(root.querySelectorAll<HTMLElement>(`[data-rv-event-id="${id}"]`));
  return dayIndex === undefined ? all[0]! : all.find((c) => c.closest("[data-rv-day-index]")?.getAttribute("data-rv-day-index") === String(dayIndex))!;
};
const slotOf = (root: ParentNode, dayIndex: number, minutes: number) =>
  root.querySelector<HTMLElement>(`.rv-SchedulerTimeGrid-slot[data-rv-day-index="${dayIndex}"][data-rv-minutes="${minutes}"]`)!;
const cellOf = (root: ParentNode, dayIndex: number) => root.querySelector<HTMLElement>(`.rv-SchedulerMonth-cell[data-rv-day-index="${dayIndex}"]`)!;
const allDayCellOf = (root: ParentNode, dayIndex: number) =>
  root.querySelector<HTMLElement>(`.rv-SchedulerTimeGrid-all-day-cell[data-rv-day-index="${dayIndex}"]`)!;
const rect = (el: Element) => el.getBoundingClientRect();
const eventById = (list: readonly SchedulerEvent[], id: string) => list.find((e) => e.id === id)!;
const clone = () => document.querySelector<HTMLElement>("body > [data-rv-drag-clone]");

/** A touch event with a stable identifier (fake-events' `createTouchEvent` numbers every event anew). */
function touch(node: Node, type: string, x: number, y: number) {
  const event = new UIEvent(type, { bubbles: true, cancelable: true, view: window });
  const point = { identifier: 7, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y, target: node };
  const active = type === "touchend" || type === "touchcancel" ? [] : [point];
  for (const [key, value] of [
    ["touches", active],
    ["targetTouches", active],
    ["changedTouches", [point]],
  ] as const)
    Object.defineProperty(event, key, { get: () => value });
  node.dispatchEvent(event);
}

/** Presses `el` at (x, y), waits for the drag chunk, then moves the mouse to (tx, ty) in steps. */
async function mouseDrag(el: Element, x: number, y: number, tx: number, ty: number, release = true) {
  dispatchMouseEvent(el, "mousedown", x, y);
  await settle();
  const steps = 8;
  for (let i = 1; i <= steps; i++) dispatchMouseEvent(document, "mousemove", x + ((tx - x) * i) / steps, y + ((ty - y) * i) / steps);
  await settle();
  if (release) {
    dispatchMouseEvent(document, "mouseup", tx, ty);
    await settle();
  }
}

/** Presses a resize handle with a pointer and drags it to (tx, ty). */
async function pointerDrag(handle: Element, tx: number, ty: number, release = true) {
  const r = rect(handle);
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  dispatchPointerEvent(handle, "pointerdown", x, y, undefined, undefined, { isPrimary: true, pointerType: "mouse", button: 0 });
  dispatchMouseEvent(handle, "mousedown", x, y);
  await settle();
  const steps = 6;
  for (let i = 1; i <= steps; i++) dispatchPointerEvent(document, "pointermove", x + ((tx - x) * i) / steps, y + ((ty - y) * i) / steps);
  await flush();
  if (release) {
    dispatchPointerEvent(document, "pointerup", tx, ty);
    await settle();
  }
}

describe("Scheduler drag-move (time grid)", () => {
  it("previews a timed move into another column at the clone's top edge, with a ghost and a floating clone", async () => {
    const { root, events, moves } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    const target = rect(slotOf(root, 3, 660));
    await mouseDrag(chip, from.left + 10, from.top + 5, target.left + 10, target.top + 5, false);
    const ghost = chipOf(root, "a__rv-ghost");
    expect(ghost).toBeTruthy();
    expect(ghost.closest(".rv-SchedulerTimeGrid-column")!.getAttribute("data-rv-day-index")).toBe("3");
    expect(parseFloat(ghost.style.getPropertyValue("--rv-scheduler-event-top"))).toBeCloseTo((660 / 1440) * 100, 3);
    expect(chip.getAttribute("data-dragging")).toBe("true");
    expect(chip.style.pointerEvents).toBe("none");
    expect(root.getAttribute("data-dragging")).toBe("true");
    const floating = clone()!;
    expect(floating.style.position).toBe("fixed");
    expect(floating.style.pointerEvents).toBe("none");
    expect(floating.getAttribute("aria-hidden")).toBe("true");
    expect(floating.hasAttribute("inert")).toBe(true);
    expect(floating.hasAttribute("data-rv-event-id")).toBe(false);
    expect(floating.querySelector("[id]")).toBeNull();
    expect(floating.getAttribute("dir")).toBe("ltr");
    expect(moves).toHaveLength(0);
    dispatchMouseEvent(document, "mouseup", target.left + 10, target.top + 5);
    await settle();
    expect(eventById(events(), "a")).toMatchObject({ start: "2031-03-06T11:00:00", end: "2031-03-06T12:00:00" });
    expect(moves).toHaveLength(1);
    expect(moves[0]!.source).toBe("pointer");
    expect(moves[0]!.previous).toMatchObject({ start: "2031-03-04T09:00", end: "2031-03-04T10:00" });
    expect(root.querySelector('[data-rv-event-id="a__rv-ghost"]')).toBeNull();
    expect(clone()).toBeNull();
    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(root.querySelector('[role="status"]')!.textContent! + root.querySelectorAll('[role="status"]')[1]!.textContent).toMatch(/A/);
  });

  it("paints the ghost as a copy: id suffix, same colour, data-ghost, not hit-testable, inert", async () => {
    const { root } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    const target = rect(slotOf(root, 2, 720));
    await mouseDrag(chip, from.left + 10, from.top + 5, target.left + 10, target.top + 5, false);
    const ghost = chipOf(root, "a__rv-ghost");
    expect(ghost.getAttribute("data-ghost")).toBe("true");
    expect(ghost.getAttribute("data-color")).toBe("success");
    expect(ghost.style.getPropertyValue("--rv-scheduler-event-color")).toBe("rgb(10, 20, 30)");
    expect(ghost.style.pointerEvents).toBe("none");
    expect(ghost.hasAttribute("inert")).toBe(true);
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(ghost.querySelector(".rv-SchedulerEvent-resize-handle")).toBeNull();
    dispatchKeyboardEvent(document, "keydown", undefined, "Escape");
    dispatchMouseEvent(document, "mouseup", target.left + 10, target.top + 5);
    await settle();
  });

  it("drops on its own slot without committing", async () => {
    const { root, events, moves } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    await mouseDrag(chip, from.left + 10, from.top + 5, from.left + 18, from.top + 5 + 2);
    expect(moves).toHaveLength(0);
    expect(eventById(events(), "a").start).toBe("2031-03-04T09:00");
  });

  it("resolves the drop time from the clone's top edge, not the pointer", async () => {
    const { root, events } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    // Grabbed 15 px below the top (1.5 rows): the pointer sits over 11:30, the clone's top over 11:00.
    const target = rect(slotOf(root, 1, 660));
    await mouseDrag(chip, from.left + 10, from.top + 15, target.left + 10, target.top + 15);
    expect(eventById(events(), "a").start).toBe("2031-03-04T11:00:00");
  });

  it("cancels with Escape and swallows the trailing click", async () => {
    const { root, events, moves, state } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    const target = rect(slotOf(root, 3, 660));
    await mouseDrag(chip, from.left + 10, from.top + 5, target.left + 10, target.top + 5, false);
    dispatchKeyboardEvent(document, "keydown", undefined, "Escape");
    await flush();
    expect(state().dragPreview()).toBeNull();
    expect(root.querySelector('[data-rv-event-id="a__rv-ghost"]')).toBeNull();
    dispatchMouseEvent(document, "mouseup", target.left + 10, target.top + 5);
    await settle();
    expect(moves).toHaveLength(0);
    expect(eventById(events(), "a").start).toBe("2031-03-04T09:00");
    let clicks = 0;
    root.addEventListener("click", () => clicks++);
    chip.click();
    expect(clicks).toBe(0);
    chip.click();
    expect(clicks).toBe(1);
  });

  it("leaves a click without movement alone: no drag, no commit, the click arrives", async () => {
    const { root, moves, state } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    dispatchMouseEvent(chip, "mousedown", from.left + 10, from.top + 5);
    dispatchMouseEvent(document, "mousemove", from.left + 12, from.top + 6);
    dispatchMouseEvent(document, "mouseup", from.left + 12, from.top + 6);
    await settle();
    expect(clone()).toBeNull();
    expect(state().dragging()).toBe(false);
    let clicks = 0;
    root.addEventListener("click", () => clicks++);
    chip.click();
    expect(clicks).toBe(1);
    expect(moves).toHaveLength(0);
  });

  it("turns a timed event dropped on the all-day row into an all-day event and back", async () => {
    const { root, events } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    const cell = rect(allDayCellOf(root, 4));
    await mouseDrag(chip, from.left + 10, from.top + 5, cell.left + 10, cell.top + 30);
    expect(eventById(events(), "a")).toMatchObject({ start: "2031-03-07T00:00:00", end: "2031-03-08T00:00:00", allDay: true });
    await settle();
    const bar = chipOf(root, "a");
    const barRect = rect(bar);
    const slot = rect(slotOf(root, 2, 600));
    await mouseDrag(bar, barRect.left + 20, barRect.top + 5, slot.left + 20, slot.top + 5);
    // All-day → timed: the default duration (60 min).
    expect(eventById(events(), "a")).toMatchObject({ start: "2031-03-05T10:00:00", end: "2031-03-05T11:00:00", allDay: false });
  });

  it("respects canMove vetoes on drop and announces the rejection", async () => {
    const { root, events, moves } = await setup({ canMove: () => false });
    const chip = chipOf(root, "a");
    const from = rect(chip);
    const target = rect(slotOf(root, 3, 660));
    await mouseDrag(chip, from.left + 10, from.top + 5, target.left + 10, target.top + 5);
    expect(moves).toHaveLength(0);
    expect(eventById(events(), "a").start).toBe("2031-03-04T09:00");
    const statuses = Array.from(root.querySelectorAll('[role="status"]'))
      .map((s) => s.textContent)
      .join("");
    expect(statuses).toMatch(/A/);
  });

  it("marks non-draggable chips and never drags them (isDraggable false, read only)", async () => {
    const readOnly = signal(false);
    const { root, moves } = await setup({
      events: [...weekEvents(), { id: "n", title: "N", start: "2031-03-03T09:00", end: "2031-03-03T10:00", isDraggable: false }],
      readOnly: () => readOnly(),
    });
    const fixed = chipOf(root, "n");
    expect(fixed.getAttribute("data-draggable")).toBe("false");
    const from = rect(fixed);
    const target = rect(slotOf(root, 3, 660));
    await mouseDrag(fixed, from.left + 10, from.top + 5, target.left + 10, target.top + 5, false);
    expect(clone()).toBeNull();
    dispatchMouseEvent(document, "mouseup", target.left + 10, target.top + 5);
    readOnly.set(true);
    await settle();
    const chip = chipOf(root, "a");
    expect(chip.getAttribute("data-draggable")).toBe("false");
    expect(chip.querySelector(".rv-SchedulerEvent-resize-handle")).toBeNull();
    const a = rect(chip);
    await mouseDrag(chip, a.left + 10, a.top + 5, target.left + 10, target.top + 5);
    expect(moves).toHaveLength(0);
  });

  it("releases a drag whose chip leaves the DOM mid-gesture", async () => {
    const { root, events, moves, state } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    const target = rect(slotOf(root, 3, 660));
    await mouseDrag(chip, from.left + 10, from.top + 5, target.left + 10, target.top + 5, false);
    events.set(events().filter((e) => e.id !== "a"));
    await flush();
    dispatchMouseEvent(document, "mousemove", target.left + 10, target.top + 25);
    await flush();
    expect(state().dragPreview()).toBeNull();
    dispatchMouseEvent(document, "mouseup", target.left + 10, target.top + 25);
    await settle();
    expect(moves).toHaveLength(0);
    expect(state().dragging()).toBe(false);
    expect(clone()).toBeNull();
  });

  it("arms a touch drag after a 200 ms press; a swipe before it does not drag", async () => {
    const { root, events } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    const target = rect(slotOf(root, 3, 660));
    const x = from.left + 10;
    const y = from.top + 5;
    // Swipe at once: the browser pans, nothing drags.
    touch(chip, "touchstart", x, y);
    await settle();
    touch(document, "touchmove", x + 30, y + 30);
    await flush();
    expect(clone()).toBeNull();
    touch(document, "touchend", x + 30, y + 30);
    await settle();
    // The emulated mousedown after the touch is ignored.
    dispatchMouseEvent(chip, "mousedown", x, y);
    dispatchMouseEvent(document, "mousemove", target.left + 10, target.top + 5);
    await settle();
    expect(clone()).toBeNull();
    dispatchMouseEvent(document, "mouseup", target.left + 10, target.top + 5);
    await sleep(850);
    // Press, rest, then drag.
    touch(chip, "touchstart", x, y);
    await sleep(240);
    for (let i = 1; i <= 6; i++) {
      const px = x + ((target.left + 10 - x) * i) / 6;
      const py = y + ((target.top + 5 - y) * i) / 6;
      touch(document, "touchmove", px, py);
    }
    await settle();
    expect(clone()).not.toBeNull();
    touch(document, "touchend", target.left + 10, target.top + 5);
    await settle();
    expect(eventById(events(), "a").start).toBe("2031-03-06T11:00:00");
    // Lets the emulated-mouse guard after a touch lapse for the next case.
    await sleep(850);
  });

  it("swallows the trailing click only inside the scheduler, within 300 ms (malva suppressNextClick)", async () => {
    const { root } = await setup();
    const outside = document.createElement("button");
    document.body.append(outside);
    try {
      const chip = chipOf(root, "a");
      const from = rect(chip);
      const target = rect(slotOf(root, 3, 660));
      await mouseDrag(chip, from.left + 10, from.top + 5, target.left + 10, target.top + 5);
      let outsideClicks = 0;
      let clicks = 0;
      outside.addEventListener("click", () => outsideClicks++);
      root.addEventListener("click", () => clicks++);
      outside.click(); // a toolbar / page button right after the drop: not eaten
      expect(outsideClicks).toBe(1);
      chipOf(root, "a").click(); // the gesture's own trailing click
      expect(clicks).toBe(0);
      chipOf(root, "a").click();
      expect(clicks).toBe(1);
      // A later gesture's swallow lapses after 300 ms.
      const moved = chipOf(root, "a");
      const at = rect(moved);
      const back = rect(slotOf(root, 1, 540));
      await mouseDrag(moved, at.left + 10, at.top + 5, back.left + 10, back.top + 5);
      await sleep(320);
      chipOf(root, "a").click();
      expect(clicks).toBe(2);
    } finally {
      outside.remove();
    }
  });

  it("lets the next tap through after a touch drag (no trailing click to swallow)", async () => {
    const { root, events } = await setup();
    const chip = chipOf(root, "a");
    const from = rect(chip);
    const target = rect(slotOf(root, 3, 660));
    const x = from.left + 10;
    const y = from.top + 5;
    touch(chip, "touchstart", x, y);
    await sleep(240);
    for (let i = 1; i <= 6; i++) touch(document, "touchmove", x + ((target.left + 10 - x) * i) / 6, y + ((target.top + 5 - y) * i) / 6);
    await settle();
    touch(document, "touchend", target.left + 10, target.top + 5);
    await settle();
    expect(eventById(events(), "a").start).toBe("2031-03-06T11:00:00");
    let clicks = 0;
    root.addEventListener("click", () => clicks++);
    chipOf(root, "x").click(); // the user's next tap, at once
    expect(clicks).toBe(1);
    await sleep(850);
  });
});

describe("Scheduler drag-move (month)", () => {
  const monthEvents = (): SchedulerEvent[] => [
    { id: "a", title: "A", start: "2031-03-04T09:00", end: "2031-03-04T10:00" },
    { id: "b", title: "B", start: "2031-03-04", end: "2031-03-07", allDay: true },
  ];

  it("moves a chip to another cell keeping its time of day", async () => {
    const { root, events } = await setup({ view: "month", events: monthEvents() });
    const chip = chipOf(root, "a");
    const from = rect(chip);
    const cell = rect(cellOf(root, 17));
    await mouseDrag(chip, from.left + 5, from.top + 5, cell.left + 20, cell.top + 50);
    expect(eventById(events(), "a")).toMatchObject({ start: "2031-03-13T09:00:00", end: "2031-03-13T10:00:00" });
  });

  it("keeps the grabbed day of a multi-day bar under the pointer (grab offset)", async () => {
    const { root, events } = await setup({ view: "month", events: monthEvents() });
    const bar = chipOf(root, "b");
    const barRect = rect(bar);
    const cellWidth = rect(cellOf(root, 8)).width;
    // Grabbed on its second day (Wed 5), dropped with the pointer on Wed 12 → starts Tue 11.
    const cell = rect(cellOf(root, 16));
    await mouseDrag(bar, barRect.left + cellWidth + 10, barRect.top + 5, cell.left + 10, cell.top + 50);
    expect(eventById(events(), "b")).toMatchObject({ start: "2031-03-11", end: "2031-03-14", allDay: true });
  });

  it("mirrors the grab-day offset of a multi-day bar in RTL", async () => {
    const { root, events } = await setup({ view: "month", events: monthEvents(), dir: "rtl" });
    const bar = chipOf(root, "b");
    const barRect = rect(bar);
    const cellWidth = rect(cellOf(root, 8)).width;
    const cell = rect(cellOf(root, 16));
    await mouseDrag(bar, barRect.right - cellWidth - 10, barRect.top + 5, cell.right - 10, cell.top + 50);
    expect(eventById(events(), "b")).toMatchObject({ start: "2031-03-11", end: "2031-03-14" });
    expect(document.querySelector("[data-rv-drag-clone]")).toBeNull();
  });

  it("cancels when the ghost pushes the source bar into a hidden lane (full row, one day left; = malva)", async () => {
    // Visible lanes 1: the ghost of a Wed–Fri bar dragged to Tue starts earlier, takes lane 1 and pushes the source
    // into the hidden lane 2 → the source chip unmounts → the gesture cancels, nothing is written.
    const { root, events, moves, state } = await setup({
      view: "month",
      events: [{ id: "s", title: "S", start: "2031-03-05", end: "2031-03-08", allDay: true }],
      visibleLanes: 1,
    });
    const bar = chipOf(root, "s");
    const from = rect(bar);
    const cell = rect(cellOf(root, 8)); // Tue 4
    await mouseDrag(bar, from.left + 5, from.top + 5, cell.left + 10, cell.top + 50, false);
    expect(bar.isConnected).toBe(false); // in the hidden lane under the ghost
    dispatchMouseEvent(document, "mousemove", cell.left + 12, cell.top + 50);
    await settle();
    expect(state().dragPreview()).toBeNull();
    dispatchMouseEvent(document, "mouseup", cell.left + 12, cell.top + 50);
    await settle();
    expect(moves).toHaveLength(0);
    expect(eventById(events(), "s").start).toBe("2031-03-05");
    expect(chipOf(root, "s").isConnected).toBe(true);
    expect(clone()).toBeNull();
  });

  it("hides the +N more panel while a drag runs (not disposed), drags its chips out, then closes it", async () => {
    const crowded: SchedulerEvent[] = [
      { id: "p", title: "P", start: "2031-03-12T08:00", end: "2031-03-12T09:00" },
      { id: "q", title: "Q", start: "2031-03-12T10:00", end: "2031-03-12T11:00" },
      { id: "r", title: "R", start: "2031-03-12T12:00", end: "2031-03-12T13:00" },
    ];
    const { root, events } = await setup({ view: "month", events: crowded, visibleLanes: 1 });
    const more = cellOf(root, 16).querySelector<HTMLButtonElement>("[data-rv-more]")!;
    more.click();
    await settle();
    await sleep(40);
    const panel = document.querySelector<HTMLElement>(".rv-SchedulerMonth-popover")!;
    expect(panel).toBeTruthy();
    const chip = chipOf(panel, "r");
    expect(chip.querySelector(".rv-SchedulerEvent-resize-handle")).toBeNull();
    const from = rect(chip);
    const cell = rect(cellOf(root, 22));
    await mouseDrag(chip, from.left + 5, from.top + 5, cell.left + 20, cell.top + 60, false);
    expect(document.querySelector(".rv-SchedulerMonth-popover")).toBe(panel);
    expect(panel.style.visibility).toBe("hidden");
    expect(cellOf(root, 22).querySelector('[data-rv-event-id="r__rv-ghost"]')).not.toBeNull();
    dispatchMouseEvent(document, "mouseup", cell.left + 20, cell.top + 60);
    await settle();
    await sleep(40);
    expect(eventById(events(), "r").start).toBe("2031-03-18T12:00:00");
    expect(document.querySelector(".rv-SchedulerMonth-popover")).toBeNull();
  });
});

describe("Scheduler resize", () => {
  it("reads the owning column rect once per resize gesture", async () => {
    const { root, resizes } = await setup();
    const chip = chipOf(root, "a");
    const slots = chip.closest(".rv-SchedulerTimeGrid-column")!.querySelector(".rv-SchedulerTimeGrid-slots")!;
    const target = rect(slotOf(root, 1, 660));
    const measure = vi.spyOn(slots, "getBoundingClientRect");
    try {
      await pointerDrag(chip.querySelector('[data-edge="end"]')!, target.left + 10, target.top + 2, false);
      expect(measure).toHaveBeenCalledTimes(1);
      dispatchPointerEvent(document, "pointermove", target.left + 10, target.top + 12);
      dispatchPointerEvent(document, "pointermove", target.left + 10, target.top + 22);
      await flush();
      expect(measure).toHaveBeenCalledTimes(1);
      dispatchPointerEvent(document, "pointerup", target.left + 10, target.top + 22);
      await settle();
      expect(resizes).toHaveLength(1);
    } finally {
      measure.mockRestore();
    }
  });

  it("renders one handle per resizable edge and drops the ones that continue", async () => {
    const { root } = await setup({
      events: [...weekEvents(), { id: "f", title: "F", start: "2031-03-03T09:00", end: "2031-03-03T10:00", isResizable: false }],
    });
    const edges = (el: Element) => Array.from(el.querySelectorAll(".rv-SchedulerEvent-resize-handle")).map((h) => h.getAttribute("data-edge"));
    expect(edges(chipOf(root, "a"))).toEqual(["start", "end"]);
    expect(chipOf(root, "a").querySelector(".rv-SchedulerEvent-resize-handle")!.getAttribute("aria-hidden")).toBe("true");
    expect(chipOf(root, "a").querySelector(".rv-SchedulerEvent-resize-handle > .rv-SchedulerEvent-grip")).not.toBeNull();
    // X: Thu 12:00 → Fri 10:00 (two column segments).
    expect(edges(chipOf(root, "x", 3))).toEqual(["start"]);
    expect(edges(chipOf(root, "x", 4))).toEqual(["end"]);
    expect(edges(chipOf(root, "f"))).toEqual([]);
  });

  it("previews a timed end resize as --rv-scheduler-event-height and commits the snapped end", async () => {
    const { root, events, resizes } = await setup();
    const chip = chipOf(root, "a");
    const handle = chip.querySelector('[data-edge="end"]')!;
    const target = rect(slotOf(root, 1, 660));
    await pointerDrag(handle, target.left + 10, target.top + 2, false);
    expect(chip.getAttribute("data-resizing")).toBe("end");
    expect(parseFloat(chip.style.getPropertyValue("--rv-scheduler-event-height"))).toBeCloseTo((120 / 1440) * 100, 3);
    dispatchPointerEvent(document, "pointerup", target.left + 10, target.top + 2);
    await settle();
    expect(eventById(events(), "a")).toMatchObject({ start: "2031-03-04T09:00:00", end: "2031-03-04T11:00:00" });
    expect(resizes).toHaveLength(1);
    expect(chip.hasAttribute("data-resizing")).toBe(false);
    expect(parseFloat(chip.style.getPropertyValue("--rv-scheduler-event-height"))).toBeCloseTo((120 / 1440) * 100, 3);
  });

  it("resizes the start edge of a timed chip, keeping the end pinned", async () => {
    const { root, events } = await setup();
    const chip = chipOf(root, "a");
    const handle = chip.querySelector('[data-edge="start"]')!;
    const target = rect(slotOf(root, 1, 480));
    await pointerDrag(handle, target.left + 10, target.top + 2);
    expect(eventById(events(), "a")).toMatchObject({ start: "2031-03-04T08:00:00", end: "2031-03-04T10:00:00" });
  });

  it("resizes a lane bar by whole days from the pointer travel (end edge), mirrored in RTL", async () => {
    for (const dir of [undefined, "rtl"] as const) {
      const { root, events } = await setup({ view: "month", events: [{ id: "b", title: "B", start: "2031-03-04", end: "2031-03-07", allDay: true }], dir });
      const bar = chipOf(root, "b");
      const handle = bar.querySelector<HTMLElement>('[data-edge="end"]')!;
      const width = rect(cellOf(root, 8)).width;
      const h = rect(handle);
      const travel = dir === "rtl" ? -2 * width : 2 * width;
      await pointerDrag(handle, h.left + h.width / 2 + travel, h.top + h.height / 2, false);
      expect(bar.style.getPropertyValue("--rv-scheduler-span")).toBe("5");
      dispatchPointerEvent(document, "pointerup", h.left + travel, h.top);
      await settle();
      expect(eventById(events(), "b")).toMatchObject({ start: "2031-03-04", end: "2031-03-09", allDay: true });
      cleanup();
      sheet?.remove();
      document.body.click();
    }
  });

  it("resizes the start edge of a lane bar by whole days, sliding it with --rv-scheduler-lane-shift", async () => {
    const { root, events, resizes } = await setup({ view: "month", events: [{ id: "b", title: "B", start: "2031-03-04", end: "2031-03-07", allDay: true }] });
    const bar = chipOf(root, "b");
    const handle = bar.querySelector<HTMLElement>('[data-edge="start"]')!;
    const width = rect(cellOf(root, 8)).width;
    const h = rect(handle);
    await pointerDrag(handle, h.left + h.width / 2 - width, h.top + h.height / 2, false);
    expect(bar.style.getPropertyValue("--rv-scheduler-span")).toBe("4");
    expect(bar.style.getPropertyValue("--rv-scheduler-lane-shift")).toBe(-width + "px");
    dispatchPointerEvent(document, "pointerup", h.left - width, h.top);
    await settle();
    expect(eventById(events(), "b")).toMatchObject({ start: "2031-03-03", end: "2031-03-07" });
    expect(resizes[0]!.source).toBe("pointer");
    expect(chipOf(root, "b").style.getPropertyValue("--rv-scheduler-lane-shift")).toBe("");
  });

  it("restores the geometry on Escape, swallows the trailing click and commits nothing", async () => {
    const { root, events, resizes } = await setup();
    const chip = chipOf(root, "a");
    const before = chip.style.getPropertyValue("--rv-scheduler-event-height");
    const handle = chip.querySelector('[data-edge="end"]')!;
    const target = rect(slotOf(root, 1, 720));
    await pointerDrag(handle, target.left + 10, target.top + 2, false);
    expect(chip.style.getPropertyValue("--rv-scheduler-event-height")).not.toBe(before);
    dispatchKeyboardEvent(document, "keydown", undefined, "Escape");
    expect(chip.style.getPropertyValue("--rv-scheduler-event-height")).toBe(before);
    dispatchPointerEvent(document, "pointerup", target.left + 10, target.top + 2);
    await settle();
    let clicks = 0;
    root.addEventListener("click", () => clicks++);
    chip.click();
    expect(clicks).toBe(0);
    expect(resizes).toHaveLength(0);
    expect(eventById(events(), "a").end).toBe("2031-03-04T10:00");
  });

  it("restores the geometry when canResize vetoes", async () => {
    const { root, events, resizes } = await setup({ canResize: () => false });
    const chip = chipOf(root, "a");
    const before = chip.style.getPropertyValue("--rv-scheduler-event-height");
    const target = rect(slotOf(root, 1, 720));
    await pointerDrag(chip.querySelector('[data-edge="end"]')!, target.left + 10, target.top + 2);
    expect(resizes).toHaveLength(0);
    expect(eventById(events(), "a").end).toBe("2031-03-04T10:00");
    expect(chip.style.getPropertyValue("--rv-scheduler-event-height")).toBe(before);
  });

  it("keeps the chip geometry when a handle press is cancelled before the threshold (touch swipe, Escape)", async () => {
    const { root, resizes, state } = await setup();
    const chip = chipOf(root, "a");
    const handle = chip.querySelector<HTMLElement>('[data-edge="end"]')!;
    // Behaviour style: a press-then-drag on a handle never starts a pan.
    expect(handle.style.touchAction).toBe("none");
    const vars = ["--rv-scheduler-event-top", "--rv-scheduler-event-height", "--rv-scheduler-event-start", "--rv-scheduler-event-width"];
    const before = vars.map((name) => chip.style.getPropertyValue(name));
    expect(before.every(Boolean)).toBe(true);
    const r = rect(handle);
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    // A touch that moves within the 200 ms arm delay: a swipe (the browser pans), abandoned before any start.
    dispatchPointerEvent(handle, "pointerdown", x, y, undefined, undefined, { isPrimary: true, pointerType: "touch", button: 0 });
    await settle();
    dispatchPointerEvent(document, "pointermove", x, y + 40, undefined, undefined, { isPrimary: true, pointerType: "touch" });
    await flush();
    dispatchPointerEvent(document, "pointerup", x, y + 40, undefined, undefined, { isPrimary: true, pointerType: "touch" });
    await settle();
    expect(vars.map((name) => chip.style.getPropertyValue(name))).toEqual(before);
    // Escape while a mouse press is still under the threshold.
    dispatchPointerEvent(handle, "pointerdown", x, y, undefined, undefined, { isPrimary: true, pointerType: "mouse", button: 0 });
    await settle();
    dispatchKeyboardEvent(document, "keydown", undefined, "Escape");
    await flush();
    dispatchPointerEvent(document, "pointerup", x, y);
    await settle();
    expect(vars.map((name) => chip.style.getPropertyValue(name))).toEqual(before);
    expect(chip.hasAttribute("data-resizing")).toBe(false);
    expect(state().dragging()).toBe(false);
    expect(resizes).toHaveLength(0);
  });

  it("a press on a handle never starts a drag-move", async () => {
    const { root, moves } = await setup();
    const chip = chipOf(root, "a");
    const target = rect(slotOf(root, 3, 720));
    await pointerDrag(chip.querySelector('[data-edge="end"]')!, target.left + 10, target.top + 2, false);
    dispatchMouseEvent(document, "mousemove", target.left + 10, target.top + 2);
    await flush();
    expect(clone()).toBeNull();
    dispatchPointerEvent(document, "pointerup", target.left + 10, target.top + 2);
    dispatchMouseEvent(document, "mouseup", target.left + 10, target.top + 2);
    await settle();
    expect(moves).toHaveLength(0);
  });
});
