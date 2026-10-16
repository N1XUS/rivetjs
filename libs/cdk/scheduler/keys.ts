// Ported from @malva-ui/scheduler (src/lib/event/scheduler-event.ts `_onKeydown` / `_keyboardMove` /
// `_clampTimedStep` / `_keyboardResize` / `_focusTargetDayIndex` / `_owningCell` / `_tabWithinCell` /
// `_fromInteractiveDescendant` / focus hand-off, src/lib/month/scheduler-month.ts `_onMoreKeydown` + popover hand-off,
// src/lib/time-grid/scheduler-time-grid.ts + scheduler-month.ts `afterRenderEffect` pending-focus resolution and
// `_onCellPointer` / `_onSlotPointer`, @malva-ui/core/menu `mlvIsContextMenuKey` / `mlvClaimContextMenuKey`), MIT,
// © 2026 Malva UI.
// Rivet:
// - shared keyboard / focus / click code of the delegated view handlers (`keys-month.ts`, `keys-time-grid.ts`): one
//   listener per view root instead of per-chip host bindings. Leaf module (behaviour.ts + selection.ts only): the
//   heavy work (normalized events, commits, labels, navigation) goes through the root context's actions, so a cold
//   key that changes nothing loads no state / intl / layout code (`tests/scheduler-chunks.test.ts`).
// - layout math on integer wall minutes (`day * 1440 + minute`): a keyboard step is plain arithmetic.
// - pending focus (`state.pendingFocus`, day numbers) is resolved imperatively after the change (microtask, then up to
//   three frames) instead of malva's `afterRenderEffect`: the boot-free month view runs no effect.
// - a timed chip names its owning slot in `data-rv-slot` (server-rendered), so `Escape`, the focus hand-off and the
//   time grid's `Enter` are DOM lookups (malva `_owningSlotMinutes` / `_chipAt`).
import { untrack } from "@rivetjs/reactivity";
import { DAY_INDEX_ATTR, EVENT_ID_ATTR, MINUTES_ATTR, findCellElement, findEventElement, moreButtonOf, schedulerRootOf } from "./behaviour.ts";
import { schedulerDaysKey, type SchedulerCell } from "./selection.ts";
import type { SchedulerAxis, SchedulerContextValue, SchedulerInteractionKind } from "./context.tsx";
import type { SchedulerLayoutRange, SchedulerNormalizedEvent } from "./layout.ts";
import type { SchedulerFocusRequest } from "./state.ts";

const DAY = 1440;
/** A real chip (never the drag ghost). */
export const CHIP = "[" + EVENT_ID_ATTR + "]:not([data-ghost])";
/** Owning slot (minutes of day) of a timed chip. */
export const SLOT_ATTR = "data-rv-slot";
/** Keys the views handle (`data-rk`: held while a cold handler chunk loads, so they never scroll the page). */
export const SCHEDULER_KEYS = "ArrowDown ArrowUp ArrowLeft ArrowRight Home End PageUp PageDown Space Enter ContextMenu";

type Ctx = SchedulerContextValue<any>;

// ─── Context-menu key ──────────────────────────────────────────────────────

/** The ContextMenu key or `Shift+F10` (no other modifier) — malva `mlvIsContextMenuKey`. */
export function isContextMenuKey(event: KeyboardEvent): boolean {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey);
}

const claimed = new WeakSet<KeyboardEvent>();

/**
 * Claims a context-menu keydown (malva `mlvClaimContextMenuKey`): prevented, so Windows / Linux browsers synthesise no
 * second `contextmenu` from the same press; the ContextMenu key's keyup (where those browsers synthesise it) is
 * prevented once by a self-removing capture listener. Returns `true` for a held key's repeat (claimed, not emitted).
 */
export function claimContextMenuKey(event: KeyboardEvent, doc: Document): boolean {
  event.preventDefault();
  if (event.key !== "ContextMenu" || event.repeat || claimed.has(event)) return event.repeat;
  claimed.add(event);
  const guard = (keyup: KeyboardEvent): void => {
    if (keyup.key !== "ContextMenu") return;
    keyup.preventDefault();
    doc.removeEventListener("keyup", guard, true);
  };
  doc.addEventListener("keyup", guard, true);
  return false;
}

// ─── Small DOM helpers ─────────────────────────────────────────────────────

/**
 * Arrow key with the horizontal pair mirrored when the grid renders right-to-left (vertical / Home / End / Page keys
 * never mirror). The element's computed `direction` decides — what the grid's logical CSS lays out and what the
 * pointer drag mirrors by (`drag.ts`), whether it comes from a `dir` attribute or the locale.
 */
export function logicalArrow(event: KeyboardEvent, element: Element): string | null {
  const key = event.key;
  if (key === "ArrowUp" || key === "ArrowDown") return key;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  if (getComputedStyle(element).direction !== "rtl") return key;
  return key === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
}

/** A cell's position off its own `data-rv-day-index` / `data-rv-minutes` (`"all-day"` → `null`). */
export function cellPosition(element: Element): SchedulerCell {
  const raw = element.getAttribute(MINUTES_ATTR);
  return { dayIndex: Number(element.getAttribute(DAY_INDEX_ATTR)), minutes: raw === "all-day" || raw === null ? null : Number(raw) };
}

/** Whether `target` is a cell (both position attributes on the element itself, never a bubbled chip key). */
export function isCell(target: Element): boolean {
  return target.hasAttribute(DAY_INDEX_ATTR) && target.hasAttribute(MINUTES_ATTR);
}

/** Focuses the cell at `dayIndex` / `minutes` (the view's `focusin` moves its roving tab stop). */
export function focusCell(root: Element, dayIndex: number, minutes: number | null): void {
  findCellElement(root, dayIndex, minutes)?.focus();
}

/**
 * Whether the event came from a focusable descendant of the chip — a control rendered by `renderEvent` owns its own
 * clicks and keys (malva `_fromInteractiveDescendant`).
 */
function fromInteractiveDescendant(target: Element, chip: Element): boolean {
  if (target === chip) return false;
  const interactive = target.closest('a[href],button,input,select,textarea,[contenteditable="true"],[tabindex]');
  return !!interactive && interactive !== chip && chip.contains(interactive);
}

/** Clamps to the rendered rows and snaps down to a slot start (malva `_snapToSlot`). */
export function snapToRow(axis: SchedulerAxis, minutes: number): number {
  const clamped = Math.min(axis.last, Math.max(axis.min, minutes));
  return axis.min + Math.floor((clamped - axis.min) / axis.slot) * axis.slot;
}

// ─── Pending focus ─────────────────────────────────────────────────────────

/** Requests inside their resolve window (microtask + up to three frames): only these count as standing. */
const resolving = new WeakSet<SchedulerFocusRequest>();

/**
 * Files a focus request for after the next render and always schedules its resolution (see `resolveFocus`) — a
 * request without a root (its view already gone) is cleared at the microtask, so no request outlives its window.
 */
export function requestFocus(ctx: Ctx, root: Element | null, request: SchedulerFocusRequest): void {
  ctx.state.pendingFocus.set(request);
  resolving.add(request);
  queueMicrotask(() => resolveFocus(ctx, root, request, 3));
}

/** Whether a request filed by `requestFocus` is still inside its resolve window (a hand-off must not overwrite it). */
function standingRequest(ctx: Ctx): boolean {
  const request = untrack(ctx.state.pendingFocus);
  return request !== null && resolving.has(request);
}

/**
 * Resolves `state.pendingFocus` against the rendered view (malva `afterRenderEffect`): a chip by id (preferring its
 * segment on `day`), or the cell of `day` (`minutes` snapped to a rendered row). Cleared once placed — and also when
 * nothing matches after the retries: a stale request would fire a focus jump on a later, unrelated render.
 */
function resolveFocus(ctx: Ctx, root: Element | null, request: SchedulerFocusRequest, attempts: number): void {
  const state = ctx.state;
  if (untrack(state.pendingFocus) !== request) return void resolving.delete(request);
  if (!root || !root.isConnected) {
    resolving.delete(request);
    state.pendingFocus.set(null);
    return;
  }
  const days = untrack(ctx.days);
  const dayIndex = request.day === null ? -1 : days.indexOf(request.day);
  let element: HTMLElement | null = null;
  if (request.eventId !== null) element = findEventElement(root, request.eventId, dayIndex >= 0 ? dayIndex : undefined);
  else if (dayIndex >= 0) element = findCellElement(root, dayIndex, request.minutes === null ? null : snapToRow(untrack(ctx.axis), request.minutes));
  if (!element && attempts > 0 && typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => resolveFocus(ctx, root, request, attempts - 1));
    return;
  }
  resolving.delete(request);
  state.pendingFocus.set(null);
  element?.focus();
}

// ─── Chips ─────────────────────────────────────────────────────────────────

/** The grid cell a chip belongs to (malva `_owningCell`): a lane chip's cell, a timed chip's owning slot. */
function owningCell(chip: Element): HTMLElement | null {
  const direct = chip.closest<HTMLElement>("[" + DAY_INDEX_ATTR + "][" + MINUTES_ATTR + "]");
  if (direct) return direct;
  const slot = chip.getAttribute(SLOT_ATTR);
  const column = chip.closest("[" + DAY_INDEX_ATTR + "]");
  return slot === null || !column ? null : column.querySelector<HTMLElement>("[" + MINUTES_ATTR + '="' + slot + '"]');
}

function interaction(ctx: Ctx, chip: HTMLElement, nativeEvent: MouseEvent | KeyboardEvent) {
  const normalized = ctx.normalized(chip.getAttribute(EVENT_ID_ATTR)!);
  return normalized ? { event: normalized.event, element: chip, nativeEvent } : null;
}

/** Day index of the column / cell owning a chip (`-1` in the `+N more` panel). */
function chipDayIndex(chip: Element): number {
  const owner = chip.closest("[" + DAY_INDEX_ATTR + "]");
  return owner ? Number(owner.getAttribute(DAY_INDEX_ATTR)) : -1;
}

/**
 * Keydown on a chip (malva `MlvSchedulerEventChip._onKeydown`): ContextMenu / `Shift+F10` → context-menu interaction
 * (claimed); `Enter` / `Space` → action; `Delete` / `Backspace` (no modifier, editable) → `onEventDelete` (prevented);
 * `Escape` → owning cell; `Tab` → ring of the cell's chips + `+N more`; `Alt+Arrow` moves, `Alt+Shift+Arrow` resizes
 * the end, `Ctrl+Alt+Arrow` the start. A key that maps to nothing is left to bubble.
 */
export function chipKeyDown(event: KeyboardEvent, ctx: Ctx, chip: HTMLElement): void {
  const target = event.target as Element;
  if (chip.hasAttribute("data-ghost") || fromInteractiveDescendant(target, chip)) return;
  const state = ctx.state;
  if (isContextMenuKey(event)) {
    if (claimContextMenuKey(event, chip.ownerDocument) || !(state.onEventContextMenu || ctx.hasEventMenu)) return;
    const payload = interaction(ctx, chip, event);
    if (payload) ctx.eventInteraction("contextmenu", payload);
    return;
  }
  const key = event.key;
  if (key === "Enter" || key === " ") {
    event.preventDefault();
    if (!state.onEventAction) return;
    const payload = interaction(ctx, chip, event);
    if (payload) ctx.eventInteraction("click", payload);
    return;
  }
  if (key === "Delete" || key === "Backspace") {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !untrack(ctx.editable)) return;
    event.preventDefault();
    const payload = interaction(ctx, chip, event);
    if (!payload) return;
    ctx.eventDelete(payload);
    return;
  }
  if (key === "Escape") {
    const cell = owningCell(chip);
    if (cell) {
      event.preventDefault();
      event.stopPropagation();
      cell.focus();
    }
    return;
  }
  if (key === "Tab") return tabWithinCell(event, chip);
  if (!event.altKey) return;
  const arrow = logicalArrow(event, chip);
  if (arrow === null) return;
  // Shift wins, so Ctrl+Alt+Shift+Arrow stays an end-edge resize.
  const edge = event.shiftKey ? "end" : event.ctrlKey ? "start" : null;
  const lane = chip.hasAttribute("data-all-day");
  // A timed chip resizes on the block axis only: the horizontal keys reach the grid instead of being swallowed.
  if (edge && !lane && (arrow === "ArrowLeft" || arrow === "ArrowRight")) return;
  if (!untrack(ctx.editable)) return;
  const normalized = ctx.normalized(chip.getAttribute(EVENT_ID_ATTR)!);
  if (!normalized) return;
  if (edge ? normalized.event.isResizable === false : normalized.event.isDraggable === false) return;
  event.preventDefault();
  event.stopPropagation();
  const axis = untrack(ctx.axis);
  const next = edge ? keyboardResize(normalized, lane, arrow, edge, axis.snap) : keyboardMove(normalized, lane, arrow, axis);
  if (!next) return;
  const days = untrack(ctx.days);
  const root = schedulerRootOf(chip);
  const current = chipDayIndex(chip);
  // The segment the user acted on keeps focus: a move shifts every segment by the same whole-day delta, a resize
  // leaves the standing segment where it is (malva `_focusTargetDayIndex`; unknown → the event's first chip).
  let targetIndex = -1;
  if (current >= 0) {
    if (edge) targetIndex = current;
    else {
      const from = days.indexOf(Math.floor(normalized.start / DAY));
      const to = days.indexOf(Math.floor(next.start / DAY));
      if (from >= 0 && to >= 0) targetIndex = current + (to - from);
    }
  }
  const day = targetIndex >= 0 ? (days[targetIndex] ?? null) : null;
  requestFocus(ctx, root, { eventId: normalized.event.id, day, minutes: null });
  const ok = ctx.commit(edge ? "resize" : "move", normalized, next);
  if (ok && !edge && untrack(ctx.days).indexOf(Math.floor(next.start / DAY)) < 0) ctx.goTo(Math.floor(next.start / DAY));
}

/**
 * Next range of a keyboard move, `null` for a no-op (malva `_keyboardMove`): lanes ←→ ±1 day, ↑↓ ±7 days; timed ↑↓
 * ±snap (clamped to the axis), ←→ ±1 day.
 */
export function keyboardMove(normalized: SchedulerNormalizedEvent<any>, lane: boolean, arrow: string, axis: SchedulerAxis): SchedulerLayoutRange | null {
  const { start, end, allDay } = normalized;
  if (arrow === "ArrowUp" || arrow === "ArrowDown") {
    const sign = arrow === "ArrowDown" ? 1 : -1;
    if (lane) return { start: start + 7 * DAY * sign, end: end + 7 * DAY * sign, allDay };
    const step = clampTimedStep(start, end, axis.snap * sign, axis);
    return step === 0 ? null : { start: start + step, end: end + step, allDay };
  }
  const sign = arrow === "ArrowRight" ? 1 : -1;
  return { start: start + DAY * sign, end: end + DAY * sign, allDay };
}

/**
 * Trims a vertical step so a timed chip cannot leave the time axis (malva `_clampTimedStep`). Only a range that fits
 * one day's window is clamped; one crossing midnight or longer than the window keeps stepping freely.
 */
export function clampTimedStep(start: number, end: number, step: number, axis: SchedulerAxis): number {
  const from = start - Math.floor(start / DAY) * DAY;
  const duration = end - start;
  if (from < axis.min || from + duration > axis.max) return step;
  return Math.min(Math.max(from + step, axis.min), axis.max - duration) - from;
}

/**
 * Next range of a keyboard resize of `edge`, `null` when it would shrink below one snap step (one day for an all-day
 * bar); the opposite edge never moves (malva `_keyboardResize`).
 */
export function keyboardResize(
  normalized: SchedulerNormalizedEvent<any>,
  lane: boolean,
  arrow: string,
  edge: "start" | "end",
  snap: number,
): SchedulerLayoutRange | null {
  const { start, end, allDay } = normalized;
  const sign = arrow === "ArrowRight" || arrow === "ArrowDown" ? 1 : -1;
  const step = lane ? DAY * sign : snap * sign;
  if (edge === "start") {
    const nextStart = start + step;
    const maxStart = allDay ? Math.floor(end / DAY) * DAY - DAY : end - snap;
    return nextStart > maxStart ? null : { start: nextStart, end, allDay };
  }
  const nextEnd = end + step;
  const minEnd = allDay ? Math.floor(start / DAY) * DAY + DAY : start + snap;
  return nextEnd < minEnd ? null : { start, end: nextEnd, allDay };
}

/** `Tab` / `Shift+Tab` among the chips (and `+N more`) of the owning cell / column; native past the ends. */
function tabWithinCell(event: KeyboardEvent, chip: HTMLElement): void {
  const container = chip.closest("[" + DAY_INDEX_ATTR + "]");
  if (!container) return;
  const stops = Array.from(container.querySelectorAll<HTMLElement>(CHIP + ", [data-rv-more]"));
  const next = stops[stops.indexOf(chip) + (event.shiftKey ? -1 : 1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

/**
 * Keydown on a `+N more` button (malva `_onMoreKeydown`): the last stop of the cell's ring — `Shift+Tab` steps back to
 * the cell's last chip, `Escape` returns to the cell. Activation is the button's own click.
 */
export function moreKeyDown(event: KeyboardEvent, button: HTMLElement): void {
  const cell = button.closest<HTMLElement>("[" + DAY_INDEX_ATTR + "][" + MINUTES_ATTR + "]");
  if (!cell) return;
  if (event.key === "Escape") {
    event.preventDefault();
    cell.focus();
    return;
  }
  if (event.key !== "Tab" || !event.shiftKey) return;
  const chips = cell.querySelectorAll<HTMLElement>(CHIP);
  const previous = chips[chips.length - 1];
  if (!previous) return;
  event.preventDefault();
  previous.focus();
}

// ─── Focus hand-off of a chip removed while focused ────────────────────────

interface FocusReturn {
  readonly root: HTMLElement | null;
  /** The owning cell (grid chips). */
  readonly request: SchedulerFocusRequest | null;
  /** Day index of the open `+N more` panel (panel chips). */
  readonly panelDay: number | null;
}

const returns = new WeakMap<Element, FocusReturn>();
/** The focused chip's removal watch: Firefox / WebKit raise no `focusout` for a focused node that is removed. */
let watched: { readonly chip: Element; readonly observer: MutationObserver } | null = null;

function watch(ctx: Ctx, chip: HTMLElement): void {
  unwatch();
  if (typeof MutationObserver !== "function") return;
  const observer = new MutationObserver(() => {
    if (!chip.isConnected) handOff(ctx, chip);
  });
  observer.observe(chip.ownerDocument.body, { childList: true, subtree: true });
  watched = { chip, observer };
}

function unwatch(chip?: Element): void {
  if (!watched || (chip && watched.chip !== chip)) return;
  watched.observer.disconnect();
  watched = null;
}

/**
 * Chip `focusin` (malva `_focusReturn = _cellFocusRequest()`): records where focus goes if the chip is torn down while
 * holding it — captured now, because a detached chip has no `closest()`.
 */
export function chipFocusIn(event: FocusEvent, ctx: Ctx): void {
  const chip = (event.target as Element | null)?.closest?.<HTMLElement>(CHIP);
  if (!chip) return;
  const root = schedulerRootOf(chip);
  const cell = owningCell(chip);
  if (cell) {
    const { dayIndex, minutes } = cellPosition(cell);
    const day = untrack(ctx.days)[dayIndex];
    returns.set(chip, { root, request: day === undefined ? null : { eventId: null, day, minutes }, panelDay: null });
  } else returns.set(chip, { root, request: null, panelDay: untrack(ctx.state.popoverDay) });
  watch(ctx, chip);
}

/**
 * Chip `focusout`: focus moved to a known element → the return is void. Without `relatedTarget` (focus went to
 * `<body>` / another window, or Chromium blurs a chip being removed — before it detaches), decide one microtask later:
 * a chip holding focus again came straight back, a connected one genuinely lost it. A removal while focused (any
 * browser, any time later — the consumer's `onEventDelete` write may be async) is caught by the removal watch.
 */
export function chipFocusOut(event: FocusEvent, ctx: Ctx): void {
  const chip = (event.target as Element | null)?.closest?.<HTMLElement>(CHIP);
  if (!chip || !returns.has(chip)) return;
  if (event.relatedTarget !== null) {
    returns.delete(chip);
    unwatch(chip);
    return;
  }
  queueMicrotask(() => handOff(ctx, chip));
}

function handOff(ctx: Ctx, chip: HTMLElement): void {
  const record = returns.get(chip);
  if (!record) return;
  const doc = chip.ownerDocument;
  const active = doc.activeElement;
  // Came straight back (itself or a control inside it), or genuinely lost to the page / another window.
  if (chip.contains(active)) return;
  returns.delete(chip);
  unwatch(chip);
  if (chip.isConnected) return;
  if (active && active !== doc.body) return;
  const root = record.root;
  if (record.panelDay !== null) {
    // A panel chip: the panel takes focus back onto its group; once nothing overflows any more the `+N more` button
    // is gone, so the panel closes and the day cell takes focus (malva popover hand-off).
    const dayIndex = record.panelDay;
    const settle = () => {
      const now = doc.activeElement;
      if (now && now !== doc.body) return;
      const panel = doc.getElementById(ctx.popoverId);
      if (root && moreButtonOf(root, dayIndex) && panel?.isConnected) return panel.focus();
      ctx.state.popoverDay.set(null);
      if (root) focusCell(root, dayIndex, null);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(settle);
    else settle();
    return;
  }
  // Never over a standing request: a keyboard move asks for the moved chip before the old one goes. A
  // request past its resolve window is stale (not standing) and is replaced — it never blocks hand-offs for good.
  if (!record.request || standingRequest(ctx)) return;
  requestFocus(ctx, root, record.request);
}

// ─── Click / double click / context menu ───────────────────────────────────

/**
 * Delegated `click` / `dblclick` / `contextmenu` of a view: on a chip → `onEventAction` / `onEventDoubleClick` /
 * `onEventContextMenu`; on empty cell / slot space → `onSlotAction` / `onSlotDoubleClick` / `onSlotContextMenu`
 * (malva `_onPointer` / `_onCellPointer` / `_onSlotPointer`). The click trailing a gesture never arrives (swallowed by
 * `pointer.ts`); nothing loads while the matching handler (or, for `contextmenu`, menu render function) is absent; a
 * right-click opens the built-in menu (prevented) only with `renderEventMenu` / `renderSlotMenu`.
 */
export function schedulerInteraction(kind: SchedulerInteractionKind, event: MouseEvent, ctx: Ctx): void {
  const target = event.target as Element | null;
  if (!target?.closest) return;
  const state = ctx.state;
  const chip = target.closest<HTMLElement>("[" + EVENT_ID_ATTR + "]");
  if (chip) {
    if (chip.hasAttribute("data-ghost") || fromInteractiveDescendant(target, chip)) return;
    if (!(kind === "click" ? state.onEventAction : kind === "dblclick" ? state.onEventDoubleClick : state.onEventContextMenu || ctx.hasEventMenu)) return;
    const payload = interaction(ctx, chip, event);
    if (payload) ctx.eventInteraction(kind, payload);
    return;
  }
  if (target.closest("[data-rv-more], button")) return;
  const cell = target.closest<HTMLElement>("[" + DAY_INDEX_ATTR + "][" + MINUTES_ATTR + "]");
  if (!cell || !(kind === "click" ? state.onSlotAction : kind === "dblclick" ? state.onSlotDoubleClick : state.onSlotContextMenu || ctx.hasSlotMenu)) return;
  emitSlot(ctx, kind, cell, event);
}

/** A slot interaction of `cell` (`inSelection` = painted by a pending selection: the slot menu offers the selection). */
export function emitSlot(ctx: Ctx, kind: SchedulerInteractionKind, cell: HTMLElement, nativeEvent: MouseEvent | KeyboardEvent): void {
  const { dayIndex, minutes } = cellPosition(cell);
  const day = untrack(ctx.days)[dayIndex];
  if (day === undefined) return;
  ctx.slotInteraction(
    kind,
    { date: ctx.slotDate(day, minutes), allDay: minutes === null, element: cell, nativeEvent },
    { day, minutes, inSelection: cell.hasAttribute("data-selected") },
  );
}

/** Cell `Space` (or `Enter` without a chip) → slot action; the ContextMenu key → slot context menu (claimed). */
export function cellKeyboardSlot(ctx: Ctx, kind: "click" | "contextmenu", cell: HTMLElement, event: KeyboardEvent): void {
  const state = ctx.state;
  if (kind === "contextmenu") {
    if (claimContextMenuKey(event, cell.ownerDocument) || !(state.onSlotContextMenu || ctx.hasSlotMenu)) return;
  } else if (!state.onSlotAction) return;
  emitSlot(ctx, kind, cell, event);
}

// ─── Keyboard range selection ──────────────────────────────────────────────

/** The pending selection of the rendered days, `null` without one (a selection of other days is stale). */
export function liveSelection(ctx: Ctx) {
  const selection = untrack(ctx.state.selection);
  return selection && selection.key === schedulerDaysKey(untrack(ctx.days)) ? selection : null;
}

/** Writes a selection head (anchored on `anchor` when none is pending) and announces it (`selectionHint`). */
export function setSelectionHead(ctx: Ctx, anchor: SchedulerCell, head: SchedulerCell): void {
  ctx.state.selection.set({ anchor, head, key: schedulerDaysKey(untrack(ctx.days)) });
  ctx.announceSelection();
}

/**
 * Shared prelude of a cell keydown: `Escape` clears / `Enter` commits a pending selection, the ContextMenu key emits
 * the slot context menu. Returns `true` when the key was consumed.
 */
export function cellKeyPrelude(event: KeyboardEvent, ctx: Ctx, cell: HTMLElement): boolean {
  if (event.key === "Escape" && liveSelection(ctx)) {
    event.preventDefault();
    ctx.state.selection.set(null);
    return true;
  }
  if (event.key === "Enter" && liveSelection(ctx)) {
    event.preventDefault();
    ctx.commitSelection();
    return true;
  }
  // Not cleared here: a slot menu opened over the pending selection takes it and clears it on close (`menus.tsx`).
  if (isContextMenuKey(event)) {
    cellKeyboardSlot(ctx, "contextmenu", cell, event);
    return true;
  }
  return false;
}

/** Ends a handled cell key: plain navigation / activation abandons a pending selection (malva rule). */
export function cellKeyHandled(event: KeyboardEvent, ctx: Ctx): void {
  if (untrack(ctx.state.selection)) ctx.state.selection.set(null);
  event.preventDefault();
}

/** Navigates to the period containing `day` and focuses its cell (`minutes`) after render (malva `_jump`). */
export function jump(ctx: Ctx, root: Element | null, day: number, minutes: number | null): void {
  requestFocus(ctx, root, { eventId: null, day, minutes });
  ctx.goTo(day);
}
