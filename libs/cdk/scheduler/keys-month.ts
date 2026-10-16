// Ported from @malva-ui/scheduler (src/lib/month/scheduler-month.ts `_onKeydown` / `_extendSelection` / `_moveFocus` /
// `_page` / `_jump` / `_focusCell` / `_firstChipOf` / `_emitKeyboardSlot`), MIT, © 2026 Malva UI.
// Rivet: the month grid's delegated keydown (one listener on the grid + the `+N more` panel), leaf chunk on `keys.ts`;
// navigation past the rendered range and month paging go through the root context (`goTo` / `stepDay` / `pageMonth`).
import { untrack } from "@rivetjs/reactivity";
import { DAY_INDEX_ATTR, EVENT_ID_ATTR, schedulerRootOf } from "./behaviour.ts";
import {
  CHIP,
  cellKeyHandled,
  cellKeyPrelude,
  cellKeyboardSlot,
  cellPosition,
  chipKeyDown,
  focusCell,
  jump,
  liveSelection,
  logicalArrow,
  moreKeyDown,
  setSelectionHead,
} from "./keys.ts";
import type { SchedulerContextValue } from "./context.tsx";

/**
 * Month keydown (grid and panel): chips and `+N more` first, then the focused cell — arrows (logical in RTL), `Home` /
 * `End` (row; `Ctrl` = grid), `PageUp` / `PageDown` (month), `Space` (slot action), `Enter` (first chip, else
 * `+N more`, else slot action), `Shift+Arrow` extends the range selection, `Enter` commits it, `Escape` clears it.
 */
export function monthKeyDown(event: KeyboardEvent, ctx: SchedulerContextValue<any>): void {
  const target = event.target as HTMLElement | null;
  if (!target?.closest) return;
  const chip = target.closest<HTMLElement>("[" + EVENT_ID_ATTR + "]");
  if (chip) return chipKeyDown(event, ctx, chip);
  if (target.hasAttribute("data-rv-more")) return moreKeyDown(event, target);
  if (target.getAttribute("role") !== "gridcell" || !target.hasAttribute(DAY_INDEX_ATTR)) return;
  if (cellKeyPrelude(event, ctx, target)) return;
  const dayIndex = cellPosition(target).dayIndex;
  const arrow = logicalArrow(event, target);
  const rowLength = untrack(ctx.rowLength);
  if (event.shiftKey && arrow !== null && untrack(ctx.selectable)) {
    event.preventDefault();
    extendSelection(ctx, dayIndex, arrow, rowLength);
    return;
  }
  const days = untrack(ctx.days);
  const root = schedulerRootOf(target);
  const rowStart = dayIndex - (dayIndex % rowLength);
  switch (arrow ?? event.key) {
    case "ArrowRight":
      moveFocus(ctx, root, dayIndex, 1);
      break;
    case "ArrowLeft":
      moveFocus(ctx, root, dayIndex, -1);
      break;
    case "ArrowDown":
      moveFocus(ctx, root, dayIndex, rowLength);
      break;
    case "ArrowUp":
      moveFocus(ctx, root, dayIndex, -rowLength);
      break;
    case "Home":
      if (root) focusCell(root, event.ctrlKey ? 0 : rowStart, null);
      break;
    case "End":
      if (root) focusCell(root, event.ctrlKey ? days.length - 1 : Math.min(days.length - 1, rowStart + rowLength - 1), null);
      break;
    case "PageUp":
    case "PageDown":
      jump(ctx, root, ctx.pageMonth(days[dayIndex]!, event.key === "PageUp" ? -1 : 1), null);
      break;
    case " ":
      cellKeyboardSlot(ctx, "click", target, event);
      break;
    case "Enter": {
      // `+N more` is a stop of the same ring and the only one when every lane is taken by bars that started earlier:
      // without this fallback those hidden events would have no keyboard path (WCAG 2.1.1).
      const stop = target.querySelector<HTMLElement>(CHIP) ?? target.querySelector<HTMLElement>("[data-rv-more]");
      if (stop) stop.focus();
      else cellKeyboardSlot(ctx, "click", target, event);
      break;
    }
    default:
      return;
  }
  cellKeyHandled(event, ctx);
}

/** Steps `delta` days inside the grid, or navigates past the edge (±1: next rendered weekday, ±row: ±7 days). */
function moveFocus(ctx: SchedulerContextValue<any>, root: Element | null, dayIndex: number, delta: number): void {
  const days = untrack(ctx.days);
  const next = dayIndex + delta;
  if (next >= 0 && next < days.length) {
    if (root) focusCell(root, next, null);
    return;
  }
  const direction: -1 | 1 = delta < 0 ? -1 : 1;
  const day = days[dayIndex]!;
  jump(ctx, root, Math.abs(delta) === 1 ? ctx.stepDay(day, direction) : day + 7 * direction, null);
}

/**
 * Grows / shrinks the keyboard selection by one day (←→) or one week row (↑↓) from the focused cell (malva
 * `_extendSelection`): horizontal steps clamp to the range, a vertical one that would leave the grid stays put, and
 * a clamped step neither writes nor re-announces.
 */
function extendSelection(ctx: SchedulerContextValue<any>, dayIndex: number, arrow: string, rowLength: number): void {
  const focus = { dayIndex, minutes: null };
  const current = liveSelection(ctx);
  const anchor = current?.anchor ?? focus;
  const head = current?.head ?? focus;
  const delta = arrow === "ArrowRight" ? 1 : arrow === "ArrowLeft" ? -1 : arrow === "ArrowDown" ? rowLength : -rowLength;
  const length = untrack(ctx.days).length;
  const target = head.dayIndex + delta;
  const next = Math.abs(delta) === 1 ? Math.min(length - 1, Math.max(0, target)) : target >= 0 && target < length ? target : head.dayIndex;
  if (current && next === head.dayIndex) return;
  setSelectionHead(ctx, anchor, { dayIndex: next, minutes: null });
}
