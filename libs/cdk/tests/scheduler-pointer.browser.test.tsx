// Ported from @malva-ui/scheduler (src/lib/drag/scheduler-pointer.spec.ts; range-select cases of
// src/lib/month/scheduler-month.spec.ts + src/lib/time-grid/scheduler-time-grid.spec.ts; externalDrop case of
// src/lib/drag/scheduler-drag.service.spec.ts), MIT, © 2026 Malva UI.
// Changes: jsdom `elementFromPoint` stubs → Chromium's own (stubbed only for the fallback case); range selection on the
// rendered `<Scheduler>` with real pointer events (the delegated `schedulerPress` loads `select.ts`); external drop =
// a cdk `<Drag>` in a connected `<DropList>` (malva: a foreign SortableJS item of the same `dragGroup`).
// Layouts stay ≤ 392 px wide (vitest iframe ≈ 414 px).
import { afterEach, describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { dispatchKeyboardEvent, dispatchMouseEvent, dispatchPointerEvent } from "@rivetjs/testing/fake-events";
import { attachPointerDrag, elementAt } from "../scheduler/pointer.ts";
import { Scheduler, type SchedulerExternalDropEvent, type SchedulerEvent, type SchedulerRangeSelectEvent, type SchedulerView } from "../scheduler/index.tsx";
import { Drag, DragPlaceholder, DropList } from "../drag-drop/index.tsx";

/** A plain Event with the pointer fields set (what the helper reads; malva's jsdom stand-in). */
function pointerEvent(type: string, x: number, y: number, extra: Record<string, unknown> = {}): Event {
  return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    ...extra,
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
  await sleep(20);
  await flush();
};

describe("attachPointerDrag", () => {
  afterEach(() => vi.useRealTimers());

  it("starts after the threshold, reports moves and ends with moved = true", () => {
    const el = document.body.appendChild(document.createElement("div"));
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const detach = attachPointerDrag(el, { onStart, onMove, onEnd }, { threshold: 5 });
    el.dispatchEvent(pointerEvent("pointerdown", 10, 10));
    el.dispatchEvent(pointerEvent("pointermove", 12, 12));
    expect(onStart).not.toHaveBeenCalled();
    el.dispatchEvent(pointerEvent("pointermove", 30, 12));
    expect(onStart).toHaveBeenCalledWith({ x: 10, y: 10 }, expect.any(Event));
    expect(onMove).toHaveBeenCalledWith({ x: 30, y: 12 }, expect.any(Event));
    el.dispatchEvent(pointerEvent("pointerup", 31, 12));
    expect(onEnd).toHaveBeenCalledWith({ x: 31, y: 12 }, true, expect.any(Event));
    detach();
    el.remove();
  });

  it("ends with moved = false for a plain click (no threshold crossed)", () => {
    const el = document.body.appendChild(document.createElement("div"));
    const onEnd = vi.fn();
    const onMove = vi.fn();
    const detach = attachPointerDrag(el, { onMove, onEnd }, { threshold: 5 });
    el.dispatchEvent(pointerEvent("pointerdown", 10, 10));
    el.dispatchEvent(pointerEvent("pointerup", 11, 10));
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith({ x: 11, y: 10 }, false, expect.any(Event));
    detach();
    el.remove();
  });

  it("ignores secondary buttons and ignored targets", () => {
    const el = document.body.appendChild(document.createElement("div"));
    const child = el.appendChild(document.createElement("span"));
    child.className = "skip";
    const onEnd = vi.fn();
    const detach = attachPointerDrag(el, { onMove: vi.fn(), onEnd }, { ignore: (t) => t.classList.contains("skip") });
    el.dispatchEvent(pointerEvent("pointerdown", 0, 0, { button: 2 }));
    el.dispatchEvent(pointerEvent("pointerup", 0, 0, { button: 2 }));
    child.dispatchEvent(pointerEvent("pointerdown", 0, 0));
    child.dispatchEvent(pointerEvent("pointerup", 0, 0));
    expect(onEnd).not.toHaveBeenCalled();
    detach();
    el.remove();
  });

  it("cancels on Escape and on pointercancel without calling onEnd", () => {
    const el = document.body.appendChild(document.createElement("div"));
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    const detach = attachPointerDrag(el, { onMove: vi.fn(), onEnd, onCancel });
    el.dispatchEvent(pointerEvent("pointerdown", 0, 0));
    el.dispatchEvent(pointerEvent("pointermove", 20, 0));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    el.dispatchEvent(pointerEvent("pointerup", 20, 0));
    expect(onEnd).not.toHaveBeenCalled();
    el.dispatchEvent(pointerEvent("pointerdown", 0, 0));
    el.dispatchEvent(pointerEvent("pointercancel", 0, 0));
    expect(onCancel).toHaveBeenCalledTimes(2);
    detach();
    el.remove();
  });

  it("ignores a second pointerdown while a gesture is running", () => {
    const el = document.body.appendChild(document.createElement("div"));
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const detach = attachPointerDrag(el, { onStart, onMove: vi.fn(), onEnd }, { threshold: 5 });
    el.dispatchEvent(pointerEvent("pointerdown", 10, 10));
    el.dispatchEvent(pointerEvent("pointerdown", 200, 200, { pointerId: 2 }));
    el.dispatchEvent(pointerEvent("pointermove", 40, 10));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({ x: 10, y: 10 }, expect.any(Event));
    el.dispatchEvent(pointerEvent("pointerup", 40, 10));
    expect(onEnd).toHaveBeenCalledTimes(1);
    detach();
    el.remove();
  });

  it("only follows the pointer that started the gesture", () => {
    const el = document.body.appendChild(document.createElement("div"));
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const detach = attachPointerDrag(el, { onMove, onEnd, onCancel }, { threshold: 5 });
    el.dispatchEvent(pointerEvent("pointerdown", 10, 10));
    el.dispatchEvent(pointerEvent("pointermove", 90, 90, { pointerId: 2 }));
    el.dispatchEvent(pointerEvent("pointercancel", 90, 90, { pointerId: 2 }));
    el.dispatchEvent(pointerEvent("pointerup", 90, 90, { pointerId: 2 }));
    expect(onMove).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    el.dispatchEvent(pointerEvent("pointermove", 40, 10));
    el.dispatchEvent(pointerEvent("pointerup", 40, 10));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    detach();
    el.remove();
  });

  describe("touchDelay", () => {
    /** Whether the element holds a non-passive `touchmove` blocker. */
    function trackTouchMove(el: HTMLElement): () => boolean {
      let armed = false;
      const add = el.addEventListener.bind(el);
      const remove = el.removeEventListener.bind(el);
      el.addEventListener = ((type: string, ...rest: unknown[]) => {
        if (type === "touchmove") armed = true;
        return (add as (...a: unknown[]) => void)(type, ...rest);
      }) as typeof el.addEventListener;
      el.removeEventListener = ((type: string, ...rest: unknown[]) => {
        if (type === "touchmove") armed = false;
        return (remove as (...a: unknown[]) => void)(type, ...rest);
      }) as typeof el.removeEventListener;
      return () => armed;
    }

    it("abandons a touch gesture that moves before the delay fires", () => {
      vi.useFakeTimers();
      const el = document.body.appendChild(document.createElement("div"));
      const capture = vi.fn();
      el.setPointerCapture = capture;
      const isArmed = trackTouchMove(el);
      const onStart = vi.fn();
      const onMove = vi.fn();
      const onCancel = vi.fn();
      const detach = attachPointerDrag(el, { onStart, onMove, onEnd: vi.fn(), onCancel }, { threshold: 5, touchDelay: 200 });
      el.dispatchEvent(pointerEvent("pointerdown", 10, 10, { pointerType: "touch" }));
      expect(capture).not.toHaveBeenCalled();
      expect(isArmed()).toBe(false);
      vi.advanceTimersByTime(150);
      el.dispatchEvent(pointerEvent("pointermove", 10, 40, { pointerType: "touch" }));
      expect(onStart).not.toHaveBeenCalled();
      expect(onMove).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(500);
      expect(capture).not.toHaveBeenCalled();
      detach();
      el.remove();
    });

    it("arms a touch gesture that rests for the delay, and blocks native panning", () => {
      vi.useFakeTimers();
      const el = document.body.appendChild(document.createElement("div"));
      el.setPointerCapture = vi.fn();
      el.hasPointerCapture = () => true;
      el.releasePointerCapture = vi.fn();
      const isArmed = trackTouchMove(el);
      const onStart = vi.fn();
      const onMove = vi.fn();
      const detach = attachPointerDrag(el, { onStart, onMove, onEnd: vi.fn() }, { threshold: 5, touchDelay: 200 });
      el.dispatchEvent(pointerEvent("pointerdown", 10, 10, { pointerType: "touch" }));
      vi.advanceTimersByTime(200);
      expect(el.setPointerCapture).toHaveBeenCalledWith(1);
      expect(isArmed()).toBe(true);
      const touchMove = new Event("touchmove", { cancelable: true });
      el.dispatchEvent(touchMove);
      expect(touchMove.defaultPrevented).toBe(true);
      el.dispatchEvent(pointerEvent("pointermove", 10, 40, { pointerType: "touch" }));
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onMove).toHaveBeenCalledTimes(1);
      el.dispatchEvent(pointerEvent("pointerup", 10, 40, { pointerType: "touch" }));
      expect(isArmed()).toBe(false);
      detach();
      el.remove();
    });

    it("leaves a mouse pointer on the movement threshold", () => {
      vi.useFakeTimers();
      const el = document.body.appendChild(document.createElement("div"));
      const isArmed = trackTouchMove(el);
      const onStart = vi.fn();
      const detach = attachPointerDrag(el, { onStart, onMove: vi.fn(), onEnd: vi.fn() }, { threshold: 5, touchDelay: 200 });
      el.dispatchEvent(pointerEvent("pointerdown", 10, 10));
      el.dispatchEvent(pointerEvent("pointermove", 30, 10));
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(isArmed()).toBe(false);
      detach();
      el.remove();
    });
  });

  it("stops listening after detach", () => {
    const el = document.body.appendChild(document.createElement("div"));
    const onEnd = vi.fn();
    const detach = attachPointerDrag(el, { onMove: vi.fn(), onEnd });
    detach();
    el.dispatchEvent(pointerEvent("pointerdown", 0, 0));
    el.dispatchEvent(pointerEvent("pointerup", 0, 0));
    expect(onEnd).not.toHaveBeenCalled();
    el.remove();
  });
});

describe("elementAt", () => {
  afterEach(() => Reflect.deleteProperty(document, "elementFromPoint"));

  it("hit-tests the pointer position rather than trusting the event target", () => {
    const under = document.body.appendChild(document.createElement("div"));
    Object.assign(under.style, { position: "fixed", left: "0", top: "0", width: "50px", height: "50px" });
    const pressed = document.createElement("div");
    expect(elementAt(document, { x: 12, y: 34 }, pressed)).toBe(under);
    under.remove();
  });

  it("falls back to the pressed target when the hit test is missing or empty", () => {
    const pressed = document.createElement("div");
    Object.defineProperty(document, "elementFromPoint", { value: undefined, configurable: true });
    expect(elementAt(document, { x: 12, y: 34 }, pressed)).toBe(pressed);
    Reflect.deleteProperty(document, "elementFromPoint");
    // A point outside the viewport hits nothing.
    expect(elementAt(document, { x: -1, y: -1 }, pressed)).toBe(pressed);
  });
});

// ─── Range selection + external drop on a rendered scheduler ─────────────────

const css = `
  body { margin: 0; }
  .rv-Scheduler { width: 392px; font: 12px/1 sans-serif; }
  .rv-Scheduler * { box-sizing: border-box; }
  .rv-SchedulerTimeGrid-scroller { height: 560px; }
  .rv-SchedulerTimeGrid-header, .rv-SchedulerTimeGrid-all-day, .rv-SchedulerTimeGrid-body { display: flex; }
  .rv-SchedulerTimeGrid-corner, .rv-SchedulerTimeGrid-all-day-label, .rv-SchedulerTimeGrid-gutter { width: 42px; flex: none; }
  .rv-SchedulerTimeGrid-day-header, .rv-SchedulerTimeGrid-all-day-cell, .rv-SchedulerTimeGrid-column { width: 50px; flex: none; position: relative; }
  .rv-SchedulerTimeGrid-day-header { height: 20px; }
  .rv-SchedulerTimeGrid-all-day-cell { height: 30px; }
  .rv-SchedulerTimeGrid-slot { height: 10px; }
  .rv-SchedulerTimeGrid-hour { display: none; }
  .rv-SchedulerTimeGrid-events { position: absolute; inset: 0; pointer-events: none; }
  .rv-SchedulerTimeGrid-events .rv-SchedulerEvent { position: absolute; pointer-events: auto; top: var(--rv-scheduler-event-top); height: var(--rv-scheduler-event-height); width: 100%; }
  .rv-SchedulerMonth-weekdays, .rv-SchedulerMonth-row { display: flex; }
  .rv-SchedulerMonth-weekday, .rv-SchedulerMonth-cell { width: 56px; flex: none; }
  .rv-SchedulerMonth-cell { height: 60px; position: relative; }
  .rv-SchedulerMonth-lanes > .rv-SchedulerEvent { position: absolute; top: 14px; height: 14px; width: 100%; }
  .ext { position: fixed; left: 0; bottom: 0; width: 120px; height: 30px; }
  .ext-item { height: 24px; width: 100px; background: #ccc; }
`;

let sheet: HTMLStyleElement | null = null;

async function setup(
  options: {
    view?: SchedulerView;
    selectable?: () => boolean;
    readOnly?: () => boolean;
    external?: boolean;
    placeholder?: boolean;
    events?: SchedulerEvent[];
  } = {},
) {
  sheet = document.createElement("style");
  sheet.textContent = css;
  document.head.append(sheet);
  const ranges: SchedulerRangeSelectEvent[] = [];
  const drops: SchedulerExternalDropEvent[] = [];
  const clicks: string[] = [];
  const slotClicks: string[] = [];
  const events = signal<readonly SchedulerEvent[]>(options.events ?? [{ id: "a", title: "A", start: "2031-03-04T09:00", end: "2031-03-04T10:00" }]);
  const selectable = options.selectable ?? (() => true);
  const readOnly = options.readOnly ?? (() => false);
  const { container } = render(() => (
    <div onClick={(e) => clicks.push((e.target as Element).getAttribute("data-rv-minutes") ?? "")}>
      {options.external ? (
        <DropList id="ext" class="ext" sortingDisabled connectedTo={["board"]}>
          <Drag data={{ task: 7 }} class="ext-item">
            Task
            {options.placeholder !== false ? <DragPlaceholder>{() => <span />}</DragPlaceholder> : null}
          </Drag>
        </DropList>
      ) : null}
      <Scheduler
        events={events}
        defaultView={options.view ?? "week"}
        defaultDate="2031-03-04"
        timeZone="UTC"
        locale="en-US"
        firstDayOfWeek="mon"
        businessHours={null}
        allowsRangeSelection={selectable()}
        isReadOnly={readOnly()}
        dropGroup="board"
        onRangeSelect={(range) => ranges.push(range)}
        onSlotAction={(slot) => slotClicks.push(String(slot.date))}
        onExternalDrop={options.external ? (drop) => drops.push(drop) : undefined}
      />
    </div>
  ));
  await settle();
  const root = container.querySelector<HTMLElement>("[data-rv-scheduler]")!;
  return { root, ranges, drops, clicks, slotClicks };
}

afterEach(async () => {
  cleanup();
  sheet?.remove();
  sheet = null;
  document.body.click();
});

const rect = (el: Element) => el.getBoundingClientRect();
const slotOf = (root: ParentNode, dayIndex: number, minutes: number) =>
  root.querySelector<HTMLElement>(`.rv-SchedulerTimeGrid-slot[data-rv-day-index="${dayIndex}"][data-rv-minutes="${minutes}"]`)!;
const allDayOf = (root: ParentNode, dayIndex: number) =>
  root.querySelector<HTMLElement>(`.rv-SchedulerTimeGrid-all-day-cell[data-rv-day-index="${dayIndex}"]`)!;
const cellOf = (root: ParentNode, dayIndex: number) => root.querySelector<HTMLElement>(`.rv-SchedulerMonth-cell[data-rv-day-index="${dayIndex}"]`)!;
const selected = (root: ParentNode) =>
  Array.from(root.querySelectorAll('[aria-selected="true"]')).map((el) => el.getAttribute("data-rv-day-index") + ":" + el.getAttribute("data-rv-minutes"));

/** Pointer press on `from`, moves to `to` (element centres), optional release + click. */
async function select(from: Element, to: Element, release = true) {
  const a = rect(from);
  const b = rect(to);
  const x = a.left + a.width / 2;
  const y = a.top + a.height / 2;
  const tx = b.left + b.width / 2;
  const ty = b.top + b.height / 2;
  dispatchPointerEvent(from, "pointerdown", x, y, undefined, undefined, { isPrimary: true, pointerType: "mouse", button: 0, pointerId: 1 });
  await settle();
  for (let i = 1; i <= 6; i++)
    dispatchPointerEvent(document, "pointermove", x + ((tx - x) * i) / 6, y + ((ty - y) * i) / 6, undefined, undefined, { pointerId: 1 });
  await flush();
  if (!release) return;
  dispatchPointerEvent(document, "pointerup", tx, ty, undefined, undefined, { pointerId: 1 });
  dispatchMouseEvent(to, "click", tx, ty);
  await settle();
}

describe("Scheduler range selection", () => {
  it("a no-travel press on a real timed slot remains a single slot click", async () => {
    const { root, ranges, slotClicks } = await setup();
    const slot = slotOf(root, 1, 600);
    const r = rect(slot);
    const x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    dispatchPointerEvent(slot, "pointerdown", x, y, undefined, undefined, { pointerId: 1, isPrimary: true, pointerType: "mouse", button: 0 });
    await settle();
    dispatchPointerEvent(slot, "pointerup", x, y, undefined, undefined, { pointerId: 1 });
    dispatchMouseEvent(slot, "click", x, y);
    await settle();
    expect(slotClicks).toEqual(["2031-03-04T10:00:00"]);
    expect(ranges).toEqual([]);
    expect(selected(root)).toEqual([]);
  });

  it("month: selection off preserves the trailing click, and a later outside press abandons a pending selection", async () => {
    const selectable = signal(false);
    const { root, ranges, slotClicks } = await setup({ view: "month", selectable: () => selectable() });
    await select(cellOf(root, 7), cellOf(root, 9));
    expect(ranges).toEqual([]);
    expect(slotClicks).toEqual(["2031-03-05"]);
    expect(selected(root)).toEqual([]);
    selectable.set(true);
    await settle();
    const from = cellOf(root, 7);
    from.focus();
    dispatchKeyboardEvent(from, "keydown", undefined, "ArrowRight", { shift: true });
    await settle();
    expect(selected(root)).toHaveLength(2);
    const outside = cellOf(root, 10),
      r = rect(outside);
    dispatchPointerEvent(outside, "pointerdown", r.left + 10, r.top + 45, undefined, undefined, {
      pointerId: 1,
      isPrimary: true,
      pointerType: "mouse",
      button: 0,
    });
    await settle();
    expect(selected(root)).toEqual([]);
    dispatchPointerEvent(document, "pointercancel", r.left + 10, r.top + 45, undefined, undefined, { pointerId: 1 });
    expect(ranges).toEqual([]);
  });

  it("month: pressing a chip or +N more never starts range selection", async () => {
    const events = Array.from({ length: 5 }, (_, i) => ({ id: String(i), title: `E${i}`, start: "2031-03-04T09:00", end: "2031-03-04T10:00" }));
    const { root, ranges } = await setup({ view: "month", events });
    for (const target of [root.querySelector<HTMLElement>("[data-rv-event-id]")!, root.querySelector<HTMLElement>("[data-rv-more]")!]) {
      await select(target, cellOf(root, 10), false);
      expect(selected(root)).toEqual([]);
      dispatchPointerEvent(document, "pointerup", 0, 0, undefined, undefined, { pointerId: 1 });
      await settle();
    }
    expect(ranges).toEqual([]);
  });
  for (const view of ["month", "week"] as const) {
    it(`${view}: extends a TOUCH drag past the pressed cell, which keeps the moves`, async () => {
      const { root, ranges } = await setup({ view });
      const from = view === "month" ? cellOf(root, 8) : slotOf(root, 1, 600);
      const to = view === "month" ? cellOf(root, 10) : slotOf(root, 1, 690);
      const a = rect(from),
        b = rect(to);
      const send = (type: string, box: DOMRect) =>
        dispatchPointerEvent(from, type, box.left + box.width / 2, box.top + box.height / 2, undefined, undefined, {
          isPrimary: true,
          pointerType: "touch",
          button: 0,
          pointerId: 7,
        });
      send("pointerdown", a);
      await sleep(250);
      send("pointermove", b);
      await flush();
      expect(selected(root)).toHaveLength(view === "month" ? 3 : 4);
      send("pointerup", b);
      await settle();
      expect(ranges).toEqual([
        view === "month"
          ? { start: "2031-03-04", end: "2031-03-07", allDay: true, source: "pointer" }
          : { start: "2031-03-04T10:00:00", end: "2031-03-04T12:00:00", allDay: false, source: "pointer" },
      ]);
    });
  }

  it("keeps a pending selection when the press lands inside it", async () => {
    const { root, ranges } = await setup({ view: "month" });
    const from = cellOf(root, 7),
      inside = cellOf(root, 8);
    from.focus();
    from.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true, cancelable: true }));
    await settle();
    expect(selected(root)).toHaveLength(2);
    const b = rect(inside);
    dispatchPointerEvent(inside, "pointerdown", b.left + 10, b.top + 40, undefined, undefined, {
      isPrimary: true,
      pointerType: "mouse",
      button: 0,
      pointerId: 1,
    });
    await settle();
    expect(selected(root)).toHaveLength(2);
    dispatchPointerEvent(inside, "pointercancel", b.left + 10, b.top + 40, undefined, undefined, { pointerId: 1 });
    expect(ranges).toHaveLength(0);
  });

  it("time grid: selects a range of slots by dragging, paints it, emits onRangeSelect on release and swallows the click", async () => {
    const { root, ranges, clicks } = await setup();
    await select(slotOf(root, 1, 600), slotOf(root, 1, 690), false);
    expect(selected(root)).toEqual(["1:600", "1:630", "1:660", "1:690"]);
    dispatchPointerEvent(document, "pointerup", 0, 0, undefined, undefined, { pointerId: 1 });
    slotOf(root, 1, 690).click();
    await settle();
    expect(ranges).toEqual([{ start: "2031-03-04T10:00:00", end: "2031-03-04T12:00:00", allDay: false, source: "pointer" }]);
    expect(selected(root)).toEqual([]);
    expect(clicks).toEqual([]);
    slotOf(root, 1, 690).click();
    expect(clicks).toEqual(["690"]);
  });

  it("orders a backwards multi-day drag by (day, minute) and paints it continuously", async () => {
    const { root, ranges } = await setup();
    await select(slotOf(root, 2, 540), slotOf(root, 1, 1380), false);
    const painted = selected(root);
    expect(painted[0]).toBe("1:1380");
    expect(painted).toContain("1:1410");
    expect(painted).toContain("2:0");
    expect(painted.at(-1)).toBe("2:540");
    dispatchPointerEvent(document, "pointerup", 0, 0, undefined, undefined, { pointerId: 1 });
    await settle();
    expect(ranges[0]).toMatchObject({ start: "2031-03-04T23:00:00", end: "2031-03-05T09:30:00", allDay: false });
  });

  it("all-day row: selects days, never crosses into the slots", async () => {
    const { root, ranges } = await setup();
    await select(allDayOf(root, 1), slotOf(root, 3, 600), false);
    expect(selected(root)).toEqual(["1:all-day"]);
    await select(allDayOf(root, 1), allDayOf(root, 3));
    expect(ranges.at(-1)).toEqual({ start: "2031-03-04", end: "2031-03-07", allDay: true, source: "pointer" });
  });

  it("month: drag across cells emits an all-day range", async () => {
    const { root, ranges } = await setup({ view: "month" });
    await select(cellOf(root, 9), cellOf(root, 17));
    // Wed 5 → Thu 13 (malva: continuous day interval across rows).
    expect(ranges).toEqual([{ start: "2031-03-05", end: "2031-03-14", allDay: true, source: "pointer" }]);
  });

  it("Escape cancels mid-gesture, clears the paint and swallows the trailing click", async () => {
    const { root, ranges, clicks } = await setup();
    await select(slotOf(root, 1, 600), slotOf(root, 1, 690), false);
    dispatchKeyboardEvent(document, "keydown", undefined, "Escape");
    await flush();
    expect(selected(root)).toEqual([]);
    dispatchPointerEvent(document, "pointerup", 0, 0, undefined, undefined, { pointerId: 1 });
    slotOf(root, 1, 690).click();
    await settle();
    expect(ranges).toEqual([]);
    expect(clicks).toEqual([]);
  });

  it("Escape on the focused pressed slot (the grid's key handler clears first) still swallows the trailing click", async () => {
    // Review T7+T8 #2: the keydown reaches the sheet's handler (selection cleared) before the tracker's document
    // listener; the tracker must swallow from its own started state, not from the (already cleared) selection.
    const { root, ranges, clicks } = await setup();
    await select(slotOf(root, 1, 600), slotOf(root, 1, 690), false);
    slotOf(root, 1, 600).focus();
    dispatchKeyboardEvent(slotOf(root, 1, 600), "keydown", undefined, "Escape");
    await flush();
    expect(selected(root)).toEqual([]);
    dispatchPointerEvent(document, "pointerup", 0, 0, undefined, undefined, { pointerId: 1 });
    slotOf(root, 1, 690).click();
    await settle();
    expect(ranges).toEqual([]);
    expect(clicks).toEqual([]);
  });

  it("month: Escape on the focused pressed cell swallows the trailing click", async () => {
    const { root, ranges, clicks } = await setup({ view: "month" });
    await select(cellOf(root, 9), cellOf(root, 11), false);
    cellOf(root, 9).focus();
    dispatchKeyboardEvent(cellOf(root, 9), "keydown", undefined, "Escape");
    await flush();
    expect(selected(root)).toEqual([]);
    dispatchPointerEvent(document, "pointerup", 0, 0, undefined, undefined, { pointerId: 1 });
    cellOf(root, 11).click();
    await settle();
    expect(ranges).toEqual([]);
    expect(clicks).toEqual([]);
  });

  it("leaves the trailing click alone when the drag painted nothing (selection off), and never starts on a chip", async () => {
    const selectable = signal(false);
    const { root, ranges, clicks } = await setup({ selectable: () => selectable() });
    await select(slotOf(root, 1, 600), slotOf(root, 1, 690));
    expect(ranges).toEqual([]);
    expect(clicks).toEqual(["690"]);
    selectable.set(true);
    await settle();
    const chip = root.querySelector<HTMLElement>('[data-rv-event-id="a"]')!;
    await select(chip, slotOf(root, 3, 690));
    expect(ranges).toEqual([]);
  });

  it("a press outside a pending selection abandons it; a press inside keeps it", async () => {
    const { root } = await setup();
    await select(slotOf(root, 1, 600), slotOf(root, 1, 660), false);
    // Leave it pending: cancel the tracker without clearing (a keyboard selection would look the same).
    expect(selected(root)).toHaveLength(3);
    dispatchPointerEvent(slotOf(root, 1, 630), "pointerdown", 0, 0, undefined, undefined, { pointerId: 2 });
    expect(selected(root)).toHaveLength(3);
    dispatchPointerEvent(slotOf(root, 4, 300), "pointerdown", 0, 0, undefined, undefined, { pointerId: 3 });
    expect(selected(root)).toEqual([]);
    dispatchPointerEvent(document, "pointerup", 0, 0, undefined, undefined, { pointerId: 1 });
    await settle();
  });
});

describe("Scheduler external drop", () => {
  /** Drags the external item onto `target`'s centre. */
  async function dropOn(target: Element, during?: () => void) {
    const item = document.querySelector<HTMLElement>(".ext-item")!;
    const a = rect(item);
    const b = rect(target);
    const x = a.left + 10;
    const y = a.top + 10;
    const tx = b.left + b.width / 2;
    const ty = b.top + b.height / 2;
    dispatchMouseEvent(item, "mousedown", x, y);
    await settle();
    for (let i = 1; i <= 12; i++) dispatchMouseEvent(document, "mousemove", x + ((tx - x) * i) / 12, y + ((ty - y) * i) / 12);
    await settle();
    during?.();
    dispatchMouseEvent(document, "mouseup", tx, ty);
    await settle();
    await sleep(350);
  }

  it("renders the body as a hit-area DropList only with onExternalDrop", async () => {
    const plain = await setup();
    expect(plain.root.querySelector(".rv-Scheduler-body")!.hasAttribute("data-rv-drop-list")).toBe(false);
    cleanup();
    const hit = await setup({ external: true });
    const body = hit.root.querySelector(".rv-Scheduler-body")!;
    expect(body.getAttribute("id")).toBe("board");
    expect(body.hasAttribute("data-rv-drop-list")).toBe(true);
  });

  it("a timed drop: the slot under the pointer, defaultEventDuration long; the item stays in its list", async () => {
    const { root, drops } = await setup({ external: true });
    await dropOn(slotOf(root, 2, 600));
    expect(drops).toEqual([{ item: { task: 7 }, start: "2031-03-05T10:00:00", end: "2031-03-05T11:00:00", allDay: false }]);
    expect(document.querySelector(".ext .ext-item")).not.toBeNull();
  });

  it("a foreign item without a custom placeholder leaves the month geometry unchanged and returns to its list", async () => {
    const { root, drops } = await setup({ external: true, view: "month", placeholder: false });
    const body = root.querySelector<HTMLElement>(".rv-Scheduler-body")!;
    const height = rect(body).height;
    await dropOn(root.querySelector('.rv-SchedulerMonth-cell[data-rv-day-index="10"]')!, () => {
      expect(body.querySelector(".cdk-drag-placeholder")).not.toBeNull();
      expect(rect(body).height).toBe(height);
      expect(rect(body.querySelector(".cdk-drag-placeholder")!).height).toBe(0);
    });
    expect(drops).toEqual([{ item: { task: 7 }, start: "2031-03-06", end: "2031-03-07", allDay: true }]);
    expect(document.querySelector(".ext .ext-item")).not.toBeNull();
    expect(root.querySelector(".cdk-drag-placeholder")).toBeNull();
  });

  it("an all-day drop (all-day row / month cell) covers that day; read-only refuses the item", async () => {
    const readOnly = signal(false);
    const { root, drops } = await setup({ external: true, readOnly: () => readOnly() });
    await dropOn(allDayOf(root, 3));
    expect(drops).toEqual([{ item: { task: 7 }, start: "2031-03-06", end: "2031-03-07", allDay: true }]);
    readOnly.set(true);
    await settle();
    await dropOn(allDayOf(root, 4));
    expect(drops).toHaveLength(1);
  });
});
