// Ported from @malva-ui/scheduler (src/lib/layout/scheduler-focus.ts `findEventElement` / `findCellElement`), MIT,
// © 2026 Malva UI.
// Rivet: the DOM lookups of the delegated keyboard / focus handlers (`keys*.ts`). Attribute names carry the
// `data-rv-` prefix (`data-rv-event-id`, `data-rv-day-index`, `data-rv-minutes`). No JSX, no import-time DOM work.
// Month `+N more` toggle / close / focus: port of src/lib/month/scheduler-month.ts `_openMore` / `onClose` (T3).
// `schedulerPress` (T6): the delegated press of the views (no malva counterpart: malva binds SortableJS per list and
// `attachPointerDrag` per handle at render); loads the drag chunk (`drag.ts`) on the first press of a chip / handle.
import { untrack, type Signal } from "@rivetjs/reactivity";
import type { DragDrop, DragEnter, DragExit } from "../drag-drop/drag-events.ts";
import type { SchedulerDate } from "./dates.ts";
import type { SchedulerEvent, SchedulerMoreEvent } from "./layout.ts";
import { DEV } from "#dev";
import { schedulerSelectable } from "./selection.ts";
import type { SchedulerState } from "./state.ts";

/** Chip attribute holding the event id. */
export const EVENT_ID_ATTR = "data-rv-event-id";
/** Cell / column attribute holding the visible-day index. */
export const DAY_INDEX_ATTR = "data-rv-day-index";
/** Cell attribute: `"all-day"` (month cell, all-day cell) or the slot's minutes of day. */
export const MINUTES_ATTR = "data-rv-minutes";

/**
 * The chip element rendering `id`, or `null`. Attribute comparison, so ids need no escaping.
 *
 * A multi-day event renders one chip per day and every one of them carries the same event id, so `dayIndex` picks the
 * segment: the chip whose owning cell or column declares that day index. It is a preference, not a filter — an index
 * no chip claims any more (the segment was resized away, or the change scrolled the range) falls back to the first
 * chip of `id`.
 */
export function findEventElement(root: Element, id: string, dayIndex?: number): HTMLElement | null {
  let first: HTMLElement | null = null;
  for (const element of Array.from(root.querySelectorAll<HTMLElement>("[" + EVENT_ID_ATTR + "]"))) {
    if (element.getAttribute(EVENT_ID_ATTR) !== id) continue;
    if (dayIndex === undefined) return element;
    first ??= element;
    const owner = element.closest<HTMLElement>("[" + DAY_INDEX_ATTR + "]");
    if (owner && Number(owner.getAttribute(DAY_INDEX_ATTR)) === dayIndex) return element;
  }
  return first;
}

/**
 * The focusable cell for a day (`minutes === null`: a month cell or all-day cell, `data-rv-minutes="all-day"`) or a
 * time slot (`data-rv-minutes="<n>"`).
 */
export function findCellElement(root: Element, dayIndex: number, minutes: number | null): HTMLElement | null {
  const minutesAttr = minutes === null ? "all-day" : String(minutes);
  return root.querySelector<HTMLElement>("[" + DAY_INDEX_ATTR + '="' + dayIndex + '"][' + MINUTES_ATTR + '="' + minutesAttr + '"]');
}

/** The scheduler root owning `element` (a chip in the `+N more` panel lives in a portal: found through its trigger). */
export function schedulerRootOf(element: Element): HTMLElement | null {
  const root = element.closest<HTMLElement>("[data-rv-scheduler]");
  if (root) return root;
  const panel = element.closest<HTMLElement>("[role=group][id]");
  return panel ? (panel.ownerDocument.querySelector(`[aria-controls="${panel.id}"]`)?.closest<HTMLElement>("[data-rv-scheduler]") ?? null) : null;
}

// ─── Month view (delegated on the grid element) ────────────────────────────

/** What the month handlers need (a `ctx` literal of the view's locals: resumable). */
export interface MonthBehaviourContext<T = unknown> {
  readonly state: SchedulerState<T>;
  readonly popoverId: string;
  readonly cell: (dayIndex: number) => { readonly day: number; readonly hidden: readonly SchedulerEvent<T>[] } | null;
  readonly moreDate: (day: number) => SchedulerDate;
  readonly onMoreAction: (event: SchedulerMoreEvent<T>) => void;
  /** Roving tab stop (day number). */
  readonly focusDay: Signal<number | null>;
}

/** The `+N more` button of a day, or `null` when the day does not overflow. */
export function moreButtonOf(root: Element, dayIndex: number): HTMLElement | null {
  return root.querySelector<HTMLElement>("[" + DAY_INDEX_ATTR + '="' + dayIndex + '"] [data-rv-more]');
}

function dayIndexOfElement(element: Element | null): number | null {
  const owner = element?.closest<HTMLElement>("[" + DAY_INDEX_ATTR + "]");
  return owner ? Number(owner.getAttribute(DAY_INDEX_ATTR)) : null;
}

/** Focuses the first chip of the open panel once it rendered (the overlay mounts on the next flush). */
function focusPanel(popoverId: string, attempts = 4): void {
  const panel = typeof document === "undefined" ? null : document.getElementById(popoverId);
  const chip = panel?.querySelector<HTMLElement>("[" + EVENT_ID_ATTR + "]:not([data-ghost])") ?? panel;
  if (chip) chip.focus({ preventScroll: true });
  else if (attempts > 0) requestAnimationFrame(() => focusPanel(popoverId, attempts - 1));
}

/**
 * `+N more` press (malva `_openMore`): toggles its own panel (a second press closes it, focus back on the button, no
 * `onMoreAction`), else opens the panel for its day, emits `onMoreAction({ date, events: hidden })` and moves focus to
 * the panel's first chip.
 */
export function monthMoreClick<T>(event: MouseEvent, ctx: MonthBehaviourContext<T>): void {
  const trigger = (event.target as Element | null)?.closest<HTMLElement>("[data-rv-more]");
  if (!trigger) return;
  event.stopPropagation();
  const dayIndex = dayIndexOfElement(trigger);
  if (dayIndex === null) return;
  const state = ctx.state;
  if (untrack(state.popoverDay) === dayIndex) {
    state.popoverDay.set(null);
    trigger.focus();
    return;
  }
  const cell = ctx.cell(dayIndex);
  if (!cell) return;
  ctx.onMoreAction({ date: ctx.moreDate(cell.day), events: cell.hidden });
  state.popoverDay.set(dayIndex);
  requestAnimationFrame(() => focusPanel(ctx.popoverId));
}

/**
 * Panel dismissed (Escape, outside press): closes it; focus that fell to `<body>` with the panel (or sat inside it)
 * returns to the button — a close while focus sits elsewhere (the user pressed another cell) leaves it there.
 */
export function closeMorePanel<T>(ctx: MonthBehaviourContext<T>, root: Element | null | undefined): void {
  const state = ctx.state;
  const dayIndex = untrack(state.popoverDay);
  if (dayIndex === null) return;
  const panel = typeof document === "undefined" ? null : document.getElementById(ctx.popoverId);
  const doc = root?.ownerDocument;
  const active = doc?.activeElement ?? null;
  const held = !active || active === doc?.body || (!!panel && panel.contains(active));
  const trigger = root ? moreButtonOf(root, dayIndex) : null;
  state.popoverDay.set(null);
  if (!held || !trigger) return;
  requestAnimationFrame(() => {
    const now = trigger.ownerDocument.activeElement;
    if (!now || now === trigger.ownerDocument.body || (panel && panel.contains(now))) trigger.focus();
  });
}

/** Roving tab stop follows focus onto a cell. */
export function monthFocusIn<T>(event: FocusEvent, ctx: MonthBehaviourContext<T>): void {
  const target = event.target as HTMLElement | null;
  if (!target || target.getAttribute("role") !== "gridcell") return;
  const dayIndex = dayIndexOfElement(target);
  const cell = dayIndex === null ? null : ctx.cell(dayIndex);
  if (cell) ctx.focusDay.set(cell.day);
}

// ─── Time grid (delegated on the sheet) ────────────────────────────────────

/** A time-grid tab stop: a day number + slot minutes (`null` = the day's all-day cell). */
export interface TimeGridFocus {
  readonly day: number;
  readonly minutes: number | null;
}

/** Roving tab stop follows focus onto a slot or an all-day cell (malva `_onCellFocus`). */
export function timeGridFocusIn(event: FocusEvent, days: readonly number[], focus: Signal<TimeGridFocus | null>): void {
  const target = event.target as HTMLElement | null;
  const role = target?.getAttribute("role");
  if (!target || (role !== "option" && role !== "gridcell")) return;
  const dayIndex = Number(target.getAttribute(DAY_INDEX_ATTR));
  const raw = target.getAttribute(MINUTES_ATTR);
  const day = days[dayIndex];
  if (day === undefined || raw === null) return;
  focus.set({ day, minutes: raw === "all-day" ? null : Number(raw) });
}

// ─── Chip drag / resize (delegated on the month grid, the `+N more` panel and the time-grid sheet) ──

/** Resize handle of a chip (`data-edge="start" | "end"`). */
const HANDLE = ".rv-SchedulerEvent-resize-handle";
const MOUSE_AFTER_TOUCH = 800;
let lastTouch = -Infinity;

/**
 * Press on a view (`mousedown` / `touchstart` move a chip, `pointerdown` on a resize handle resizes it): finds the
 * draggable chip (never a ghost, never `data-draggable="false"`), records whether the press ends before the lazily
 * imported drag chunk (`drag.ts`) arrives, then hands the press over. Emulated mouse events after a touch are ignored
 * (cdk drag-drop rule). Nothing is loaded for presses on cells, handles of read-only chips or secondary buttons.
 */
export function schedulerPress<T>(event: MouseEvent | TouchEvent | PointerEvent, state: SchedulerState<T>): void {
  const target = event.target as Element | null;
  if (!target || (event as MouseEvent).button > 0) return;
  const type = event.type;
  const handle = target.closest<HTMLElement>(HANDLE);
  if (type === "touchstart") lastTouch = Date.now();
  if (type === "pointerdown") {
    if (!handle) return pressCell(event as PointerEvent, state, target);
  } else if (handle || (type === "mousedown" && Date.now() - lastTouch < MOUSE_AFTER_TOUCH)) return;
  const chip = target.closest<HTMLElement>("[" + EVENT_ID_ATTR + "]");
  if (!chip || chip.hasAttribute("data-ghost") || (!handle && chip.getAttribute("data-draggable") === "false")) return;
  if (handle) event.stopPropagation();
  const doc = chip.ownerDocument;
  const at = Date.now();
  let released = false;
  const ends = handle ? ["pointerup", "pointercancel"] : ["mouseup", "touchend", "touchcancel"];
  const onEnd = () => (released = true);
  for (const name of ends) doc.addEventListener(name, onEnd, true);
  const release = () => {
    for (const name of ends) doc.removeEventListener(name, onEnd, true);
  };
  import("./drag.ts")
    .then((drag) => {
      release();
      if (handle) drag.startChipResize(state, event as PointerEvent, handle, released);
      else drag.startChipMove(state, event as MouseEvent | TouchEvent, chip, released, Date.now() - at);
    })
    .catch(chunkFailed(release));
}

/**
 * Press on a cell (malva `_onGridPointerDown` / `_onSheetPointerDown`): a press outside a pending selection abandons
 * it (a later `Enter` must act on what was pressed), then — when range selection is on — the range-select chunk
 * (`select.ts`) takes the press. Presses on chips, buttons (`+N more`) or outside a cell start nothing.
 */
function pressCell<T>(event: PointerEvent, state: SchedulerState<T>, target: Element): void {
  const cell = target.closest<HTMLElement>("[" + DAY_INDEX_ATTR + "][" + MINUTES_ATTR + "]");
  const raw = cell?.getAttribute(MINUTES_ATTR);
  const pos = cell ? { dayIndex: Number(cell.getAttribute(DAY_INDEX_ATTR)), minutes: raw === "all-day" ? null : Number(raw) } : null;
  // The views paint selected cells `data-selected` (`selection.ts` `isCellSelected`): no state / layout code here.
  if (untrack(state.selection) && !cell?.hasAttribute("data-selected")) state.selection.set(null);
  if (!pos || target.closest("[" + EVENT_ID_ATTR + "], button") || !untrack(() => schedulerSelectable(state))) return;
  const surface = event.currentTarget as HTMLElement | null;
  if (!surface) return;
  const doc = surface.ownerDocument;
  let released = false;
  const onEnd = () => (released = true);
  for (const name of ["pointerup", "pointercancel"]) doc.addEventListener(name, onEnd, true);
  const release = () => {
    for (const name of ["pointerup", "pointercancel"]) doc.removeEventListener(name, onEnd, true);
  };
  import("./select.ts")
    .then((select) => {
      release();
      select.startRangeSelect(state, event, surface, pos, released);
    })
    .catch(chunkFailed(release));
}

// External sources may use their default (full-size) placeholder. A scheduler is a hit area, not an insertion
// list: keep that placeholder out of layout while it is here, restoring the caller's inline style on exit.
const externalPlaceholders = new WeakMap<HTMLElement, { value: string; priority: string }>();
export function schedulerExternalEnter(event: DragEnter): void {
  const element = event.item.getPlaceholderElement();
  if (!element || externalPlaceholders.has(element)) return;
  externalPlaceholders.set(element, { value: element.style.getPropertyValue("display"), priority: element.style.getPropertyPriority("display") });
  element.style.setProperty("display", "none", "important");
}
export function schedulerExternalExit(event: DragExit): void {
  const element = event.item.getPlaceholderElement();
  const saved = element && externalPlaceholders.get(element);
  if (!saved) return;
  if (saved.value) element.style.setProperty("display", saved.value, saved.priority);
  else element.style.removeProperty("display");
  externalPlaceholders.delete(element);
}

/** Hit-area `DropList` `onDropped` (external drop, T7): hands the drop to the drag chunk. */
export function schedulerExternalDrop<T>(drop: DragDrop<any, any, any>, state: SchedulerState<T>): void {
  schedulerExternalExit(drop);
  import("./drag.ts").then((drag) => drag.externalDrop(state, drop)).catch(chunkFailed());
}

/**
 * Rejection path of a lazy gesture chunk (network error, stale deploy) or of the gesture start it runs: drops the
 * press listeners added for it (idempotent) and reports the failure in development (no unhandled rejection; the press
 * simply starts nothing).
 */
function chunkFailed(release?: () => void): (error: unknown) => void {
  return (error) => {
    release?.();
    if (DEV) console.error("[rivet:cdk] scheduler: a gesture chunk failed to load or start; the press starts nothing.", error);
  };
}
