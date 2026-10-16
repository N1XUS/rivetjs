// Ported from @malva-ui/scheduler (src/lib/drag/scheduler-drag.service.ts: target resolution, grab-day offset, ghost
// preview, Escape cancel, commit, clone sanitizing; src/lib/event/scheduler-event.ts `_attachResize`,
// `_previewTimedResize`, `_previewLaneResize`), MIT, © 2026 Malva UI.
// Rivet (spec §12 R1, T5 decision):
// - The lazy drag chunk: `behaviour.ts` `schedulerPress` imports it on the first press of a chip / handle and hands
//   it the press. No SortableJS: one standalone cdk `DragRef` per pressed chip (gesture: threshold 5 px, touch
//   `dragStartDelay` 200 ms, registry `selectstart` guard), its root pinned with `constrainPosition` (the chip never
//   moves: no clipping, no DOM move under For-managed rows), a floating clone in `<body>` (fixed, `pointer-events:
//   none`, `aria-hidden`, `inert`, ids stripped, the chip's direction) following the pointer. Target = the element
//   under the pointer (`elementFromPoint`; the source chip and ghosts are not hit-testable while dragging): a time
//   column slot reads the CLONE's top edge (malva: the start lands where the chip's top is), lane cells the day minus
//   the grab-day offset (mirrored in RTL). Preview = `state.dragPreview` (ghost through `schedulerWithPreview`).
// - Resize: `startPointerDrag` (`pointer.ts`) on the pressed handle; preview by rewriting the chip's geometry custom
//   properties (geometry read once per gesture), restored before the commit (the re-layout writes the result).
// - Trailing click after a gesture is swallowed once (`pointer.ts` `swallowNextClick`: 300 ms, inside the scheduler or
//   the chip, never after touch) instead of malva's `suppressNextClick` context flag.
import { untrack } from "@rivetjs/reactivity";
import { createDragRef } from "../drag-drop/drag-ref.ts";
import {
  resolveMove,
  resolveResize,
  type SchedulerDropTarget,
  type SchedulerLayoutRange,
  type SchedulerNormalizedEvent,
  type SchedulerResizeEdge,
} from "./layout.ts";
import { MINUTES_PER_DAY, minutesFromOffset, slotCount } from "./time.ts";
import type { DragDrop } from "../drag-drop/drag-events.ts";
import { moreButtonOf, schedulerRootOf } from "./behaviour.ts";
import { TOUCH_GESTURE_DELAY, elementAt, startPointerDrag, swallowNextClick, type SchedulerPointerPosition } from "./pointer.ts";
import {
  commitChange,
  schedulerDateOf,
  schedulerDays,
  schedulerDefaultDuration,
  schedulerNormalizedEvents,
  schedulerSlotDuration,
  schedulerSnap,
  schedulerTimeWindow,
  type SchedulerState,
} from "./state.ts";

const DAY_INDEX = "data-rv-day-index";
const MINUTES = "data-rv-minutes";

function pointerOf(event: Event | null | undefined): SchedulerPointerPosition | null {
  if (!event) return null;
  const touch = (event as TouchEvent).touches?.[0] ?? (event as TouchEvent).changedTouches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  const { clientX, clientY } = event as MouseEvent;
  return typeof clientX === "number" && typeof clientY === "number" ? { x: clientX, y: clientY } : null;
}

const isRtl = (element: Element): boolean => getComputedStyle(element).direction === "rtl";

function normalizedOf<T>(state: SchedulerState<T>, id: string | null): SchedulerNormalizedEvent<T> | null {
  if (id === null) return null;
  return untrack(() => schedulerNormalizedEvents(state).find((n) => n.event.id === id) ?? null);
}

function sameRange(a: SchedulerLayoutRange, b: SchedulerLayoutRange): boolean {
  return a.start === b.start && a.end === b.end && a.allDay === b.allDay;
}

/** The `+N more` panel was hidden for the gesture: once it settles, the panel closes, focus back on its button (malva). */
function closeMorePanelAfterDrag(state: SchedulerState<any>, root: HTMLElement): void {
  const dayIndex = untrack(state.popoverDay);
  if (dayIndex === null) return;
  const trigger = moreButtonOf(root, dayIndex);
  state.popoverDay.set(null);
  if (trigger) requestAnimationFrame(() => trigger.isConnected && trigger.focus({ preventScroll: true }));
}

/** Strips ids, focusability and animation from the floating clone (malva `sanitizeClone`). */
function sanitizeClone(clone: HTMLElement): void {
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("inert", "");
  clone.removeAttribute("id");
  clone.removeAttribute("tabindex");
  clone.removeAttribute("data-rv-event-id");
  clone.removeAttribute("role");
  clone.style.animation = "none";
  for (const el of Array.from(clone.querySelectorAll<HTMLElement>("[id]"))) el.removeAttribute("id");
}

interface Axis {
  min: number;
  max: number;
  /** Minutes the rendered rows cover (`slotCount × slotDuration`). */
  span: number;
}

function axisOf(state: SchedulerState<any>): Axis {
  return untrack(() => {
    const { min, max } = schedulerTimeWindow(state);
    const slot = schedulerSlotDuration(state);
    return { min, max, span: slotCount(min, max, slot) * slot };
  });
}

/** malva `resolveTarget`: the drop target under `pointer` inside `root`, `null` outside every list. */
export function resolveDropTarget(
  state: SchedulerState<any>,
  root: HTMLElement,
  pointer: SchedulerPointerPosition,
  top: number | null,
  grabDayOffset: number,
): SchedulerDropTarget | null {
  const hit = elementAt(root.ownerDocument, pointer, null) as Element | null;
  const cell = hit?.closest<HTMLElement>("[" + DAY_INDEX + "]");
  if (!cell || schedulerRootOf(cell) !== root) return null;
  const dayIndex = Number(cell.getAttribute(DAY_INDEX));
  const column = cell.closest<HTMLElement>(".rv-SchedulerTimeGrid-column");
  if (column) {
    const slots = column.querySelector<HTMLElement>(".rv-SchedulerTimeGrid-slots") ?? column;
    const rect = slots.getBoundingClientRect();
    const axis = axisOf(state);
    const snap = untrack(() => schedulerSnap(state));
    // A clone's top edge snaps to the nearest step (malva); a bare pointer (external drop) names the step it is in.
    const minutes =
      top === null
        ? axis.min + Math.floor(((pointer.y - rect.top) / Math.max(1, rect.height)) * (axis.span / Math.max(1, snap))) * Math.max(1, snap)
        : minutesFromOffset(top - rect.top, rect.height, axis.min, axis.min + axis.span, snap, "start");
    return { dayIndex, minutes: Math.min(minutes, Math.max(axis.min, axis.max - Math.max(1, snap))), allDay: false };
  }
  if (cell.getAttribute(MINUTES) !== "all-day") return null;
  const allDayRow = !!cell.closest(".rv-SchedulerTimeGrid-all-day");
  return { dayIndex: dayIndex - grabDayOffset, minutes: null, allDay: allDayRow ? true : null };
}

/** Days between a lane bar's first day and the day the pointer grabbed it on (malva `grabDayOffset`). */
function grabDayOffsetOf(chip: HTMLElement, pointer: SchedulerPointerPosition): number {
  if (!chip.hasAttribute("data-all-day")) return 0;
  const rect = chip.getBoundingClientRect();
  const span = Math.max(1, Number(chip.style.getPropertyValue("--rv-scheduler-span")) || 1);
  const cellWidth = rect.width / span;
  const offset = isRtl(chip) ? rect.right - pointer.x : pointer.x - rect.left;
  return cellWidth > 0 ? Math.min(span - 1, Math.max(0, Math.floor(offset / cellWidth))) : 0;
}

/**
 * Drag-moves `chip` from the press that loaded this chunk (`age` = ms since the press: the touch delay keeps its
 * original timing). `released` = the press ended while the chunk loaded (a click: nothing starts).
 */
export function startChipMove<T>(state: SchedulerState<T>, press: MouseEvent | TouchEvent, chip: HTMLElement, released: boolean, age: number): void {
  if (released || !chip.isConnected) return;
  const root = schedulerRootOf(chip);
  if (!root) return;
  const doc = chip.ownerDocument;
  const id = chip.getAttribute("data-rv-event-id");
  const ref = createDragRef(chip, { dragStartThreshold: 5, pointerDirectionChangeThreshold: 5 });
  ref.dragStartDelay = { touch: TOUCH_GESTURE_DELAY, mouse: 0 };
  // Pinned: the chip itself never moves; the clone follows the pointer.
  ref.constrainPosition = (_point, _ref, dimensions) => ({ x: dimensions.left, y: dimensions.top });
  let started = false;
  let cancelled = false;
  let normalized: SchedulerNormalizedEvent<T> | null = null;
  let clone: HTMLElement | null = null;
  let grab = { x: 0, y: 0 };
  let grabDayOffset = 0;
  const pointerEvents = chip.style.pointerEvents;

  const finish = () => {
    doc.removeEventListener("keydown", onKey, true);
    for (const type of ["mouseup", "touchend", "touchcancel"]) doc.removeEventListener(type, onRelease);
    ref.dispose();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !started || cancelled) return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  };
  // A press released before the threshold (a click) never reaches `ended`: dispose after its release.
  const onRelease = () => queueMicrotask(() => !started && finish());
  doc.addEventListener("keydown", onKey, true);
  for (const type of ["mouseup", "touchend", "touchcancel"]) doc.addEventListener(type, onRelease);

  // `started` carries the move that crossed the threshold: the grab point is the press.
  const pressedAt = pointerOf(press) ?? { x: 0, y: 0 };
  ref.started.subscribe(() => {
    started = true;
    normalized = normalizedOf(state, id);
    const at = pressedAt;
    const rect = chip.getBoundingClientRect();
    grab = { x: at.x - rect.left, y: at.y - rect.top };
    grabDayOffset = grabDayOffsetOf(chip, at);
    clone = chip.cloneNode(true) as HTMLElement;
    sanitizeClone(clone);
    clone.setAttribute("dir", isRtl(chip) ? "rtl" : "ltr");
    clone.setAttribute("data-rv-drag-clone", "");
    Object.assign(clone.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: rect.width + "px",
      height: rect.height + "px",
      margin: "0",
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex: "1000",
      transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
    });
    doc.body.append(clone);
    chip.style.pointerEvents = "none";
    chip.setAttribute("data-dragging", "true");
    state.dragging.set(true);
  });
  const cancel = () => {
    cancelled = true;
    state.dragPreview.set(null);
    if (clone) clone.style.visibility = "hidden";
  };
  ref.moved.subscribe(({ event }) => {
    const at = pointerOf(event);
    if (!at || !clone) return;
    // The chip left the DOM mid-gesture (event removed, view switched): nothing to drop.
    if (!cancelled && !chip.isConnected) cancel();
    const left = at.x - grab.x;
    const top = at.y - grab.y;
    clone.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    if (cancelled || !normalized) return;
    const target = resolveDropTarget(state, root, at, top, grabDayOffset);
    const current = untrack(state.dragPreview);
    if (!target) {
      if (current) state.dragPreview.set(null);
      return;
    }
    const next = resolveMove(
      normalized,
      target,
      untrack(() => schedulerDays(state)),
      untrack(() => schedulerDefaultDuration(state)),
    );
    if (current && current.id === normalized.event.id && sameRange(current, next)) return;
    state.dragPreview.set({ id: normalized.event.id, ...next });
  });
  ref.ended.subscribe(() => {
    const preview = untrack(state.dragPreview);
    const live = !cancelled && chip.isConnected && !!normalized && !!preview && !sameRange(normalized, preview);
    clone?.remove();
    clone = null;
    ref.reset();
    chip.style.pointerEvents = pointerEvents;
    chip.removeAttribute("data-dragging");
    state.dragPreview.set(null);
    state.dragging.set(false);
    swallowNextClick(doc, press, [root, chip]);
    finish();
    if (live)
      commitChange(state, {
        kind: "move",
        normalized: normalized!,
        next: { start: preview!.start, end: preview!.end, allDay: preview!.allDay },
        source: "pointer",
      });
    closeMorePanelAfterDrag(state, root);
  });
  ref._pointerDownFromHost(press, age);
}

/** Resizes the chip of `handle` from the press that loaded this chunk (malva `_attachResize`). */
export function startChipResize<T>(state: SchedulerState<T>, press: PointerEvent, handle: HTMLElement, released: boolean): void {
  const chip = handle.closest<HTMLElement>("[data-rv-event-id]");
  if (!chip || !chip.isConnected) return;
  const doc = chip.ownerDocument;
  const edge = (handle.getAttribute("data-edge") === "start" ? "start" : "end") as SchedulerResizeEdge;
  const lane = chip.hasAttribute("data-all-day");
  const id = chip.getAttribute("data-rv-event-id");
  const props = ["--rv-scheduler-event-top", "--rv-scheduler-event-height", "--rv-scheduler-span", "--rv-scheduler-lane-shift"];
  // `null` until `onStart` read the geometry: a cancel before the threshold (touch swipe inside the arm delay,
  // Escape / pointercancel on a still press) must leave the chip's vars alone.
  let saved: string[] | null = null;
  const restore = () => {
    const before = saved;
    if (before) props.forEach((name, i) => (before[i] ? chip.style.setProperty(name, before[i]!) : chip.style.removeProperty(name)));
  };
  let originX = 0;
  let baseSpan = 1;
  let baseTop = 0;
  let baseHeight = 0;
  let columnRect: DOMRect | null = null;
  let cellWidth = 0;
  let dayIndex = 0;
  let axis: Axis = { min: 0, max: 1440, span: 1440 };
  let snap = 30;
  let pending: { dayIndex: number; minutes: number | null } | null = null;
  let normalized: SchedulerNormalizedEvent<T> | null = null;

  const previewTimed = (y: number) => {
    if (!columnRect) return null;
    const minutes = minutesFromOffset(y - columnRect.top, columnRect.height, axis.min, axis.min + axis.span, snap, edge);
    const clamped = Math.min(minutes, axis.max);
    const percent = ((clamped - axis.min) / axis.span) * 100;
    const minHeight = (snap / axis.span) * 100;
    if (edge === "end") chip.style.setProperty("--rv-scheduler-event-height", Math.max(minHeight, percent - baseTop) + "%");
    else {
      const bottom = baseTop + baseHeight;
      const top = Math.max(0, Math.min(percent, bottom - minHeight));
      chip.style.setProperty("--rv-scheduler-event-top", top + "%");
      chip.style.setProperty("--rv-scheduler-event-height", bottom - top + "%");
    }
    return { dayIndex, minutes: clamped };
  };
  const previewLane = (x: number) => {
    if (!cellWidth) return null;
    const travel = isRtl(chip) ? originX - x : x - originX;
    const steps = Math.round(travel / cellWidth);
    if (edge === "end") {
      const span = Math.max(1, baseSpan + steps);
      chip.style.setProperty("--rv-scheduler-span", String(span));
      return { dayIndex: dayIndex + span - 1, minutes: null };
    }
    const shift = Math.max(-dayIndex, Math.min(baseSpan - 1, steps));
    chip.style.setProperty("--rv-scheduler-span", String(baseSpan - shift));
    chip.style.setProperty("--rv-scheduler-lane-shift", shift * cellWidth + "px");
    return { dayIndex: dayIndex + shift, minutes: null };
  };

  startPointerDrag(
    press,
    handle,
    {
      // Geometry read once per gesture (malva rule: no rect read per pointermove).
      onStart: (origin) => {
        normalized = normalizedOf(state, id);
        saved = props.map((name) => chip.style.getPropertyValue(name));
        originX = origin.x;
        baseSpan = Math.max(1, Number(saved[2]) || 1);
        baseTop = parseFloat(saved[0]!) || 0;
        baseHeight = parseFloat(saved[1]!) || 0;
        const owner = chip.closest<HTMLElement>("[" + DAY_INDEX + "]");
        dayIndex = Number(owner?.getAttribute(DAY_INDEX) ?? 0);
        columnRect = lane
          ? null
          : (chip.closest(".rv-SchedulerTimeGrid-column")?.querySelector(".rv-SchedulerTimeGrid-slots")?.getBoundingClientRect() ?? null);
        cellWidth = lane ? (owner?.getBoundingClientRect().width ?? 0) : 0;
        axis = axisOf(state);
        snap = untrack(() => schedulerSnap(state));
        pending = null;
        chip.setAttribute("data-resizing", edge);
        state.dragging.set(true);
      },
      onMove: (point) => {
        pending = lane ? previewLane(point.x) : previewTimed(point.y);
      },
      onEnd: (_point, moved) => {
        chip.removeAttribute("data-resizing");
        if (!moved) return;
        state.dragging.set(false);
        swallowNextClick(doc, press, [schedulerRootOf(chip), chip]);
        restore();
        if (!pending || !normalized) return;
        const next = resolveResize(
          normalized,
          pending,
          untrack(() => schedulerDays(state)),
          snap,
          edge,
        );
        if (sameRange(normalized, next)) return;
        commitChange(state, { kind: "resize", normalized, next, source: "pointer" });
      },
      onCancel: () => {
        // Nothing started (no `onStart`): nothing to undo, no click to swallow.
        if (!saved) return;
        chip.removeAttribute("data-resizing");
        restore();
        state.dragging.set(false);
        // The pointer is still down on Escape; its release still fires a click.
        swallowNextClick(doc, press, [schedulerRootOf(chip), chip]);
      },
    },
    { threshold: 3, touchDelay: TOUCH_GESTURE_DELAY, released: () => released },
  );
}

/**
 * A cdk drag-drop item from a connected list landed on the scheduler's hit-area `DropList` (malva `externalDrop`):
 * the cell under the drop point (time column: the pointer's slot) → `onExternalDrop({ item, start, end, allDay })`
 * with `end = start + defaultEventDuration` (timed) or the next midnight (month cell / all-day row). Nothing is
 * written; the item returns to its own list (the scheduler list never sorts).
 */
export function externalDrop<T>(state: SchedulerState<T>, drop: DragDrop<any, any, any>): void {
  const root = schedulerRootOf(drop.container.element);
  if (!root || !drop.isPointerOverContainer || drop.previousContainer === drop.container || !state.onExternalDrop) return;
  const target = resolveDropTarget(state, root, drop.dropPoint, null, 0);
  if (!target) return;
  const days = untrack(() => schedulerDays(state));
  const day = days[Math.max(0, Math.min(days.length - 1, target.dayIndex))]!;
  const allDay = target.allDay !== false;
  const start = day * MINUTES_PER_DAY + (allDay ? 0 : (target.minutes ?? 0));
  const end = allDay ? start + MINUTES_PER_DAY : start + untrack(() => schedulerDefaultDuration(state));
  state.onExternalDrop({ item: drop.item.data, start: schedulerDateOf(state, start, allDay), end: schedulerDateOf(state, end, allDay), allDay });
}
