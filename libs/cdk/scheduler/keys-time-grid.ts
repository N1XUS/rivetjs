// Ported from @malva-ui/scheduler (src/lib/time-grid/scheduler-time-grid.ts `_onKeydown` / `_extendSelection` /
// `_moveDay` / `_jump` / `_focusCell` / `_chipAt` / `_emitKeyboardSlot`), MIT, © 2026 Malva UI.
// Rivet: the time grid's delegated keydown (one listener on the sheet), leaf chunk on `keys.ts`; `_chipAt` reads the
// chips' server-rendered owning slot (`data-rv-slot`) instead of the layout.
import { untrack } from "@rivetjs/reactivity";
import { DAY_INDEX_ATTR, EVENT_ID_ATTR, schedulerRootOf } from "./behaviour.ts";
import {
  CHIP,
  SLOT_ATTR,
  cellKeyHandled,
  cellKeyPrelude,
  cellKeyboardSlot,
  cellPosition,
  chipKeyDown,
  focusCell,
  isCell,
  jump,
  liveSelection,
  logicalArrow,
  setSelectionHead,
} from "./keys.ts";
import type { SchedulerCell } from "./selection.ts";
import type { SchedulerContextValue } from "./context.tsx";

/**
 * Time-grid keydown (on the sheet): chips first, then the focused slot / all-day cell — ←→ one rendered day (past the
 * edge: the next rendered weekday), ↑↓ one slot (above the first slot: the all-day cell; below it: the first slot),
 * `Home` / `End` first / last day at the same time (`Ctrl`: first / last slot), `PageUp` / `PageDown` ±1 day (day
 * view) or ±7 days, `Space` slot action, `Enter` the chip starting in the slot (else slot action), `Shift+Arrow` /
 * `Enter` / `Escape` keyboard range selection.
 */
export function timeGridKeyDown(event: KeyboardEvent, ctx: SchedulerContextValue<any>): void {
  const target = event.target as HTMLElement | null;
  if (!target?.closest) return;
  const chip = target.closest<HTMLElement>("[" + EVENT_ID_ATTR + "]");
  if (chip) return chipKeyDown(event, ctx, chip);
  // The target itself, never a bubbled key: an all-day chip is a descendant of its cell (malva guard).
  if (!isCell(target)) return;
  if (cellKeyPrelude(event, ctx, target)) return;
  const arrow = logicalArrow(event, target);
  if (event.shiftKey && arrow !== null && untrack(ctx.selectable)) {
    event.preventDefault();
    extendSelection(ctx, cellPosition(target), arrow);
    return;
  }
  const position = cellPosition(target);
  const { dayIndex, minutes } = position;
  const days = untrack(ctx.days);
  const root = schedulerRootOf(target);
  const axis = untrack(ctx.axis);
  switch (arrow ?? event.key) {
    case "ArrowRight":
    case "ArrowLeft": {
      const direction = arrow === "ArrowRight" ? 1 : -1;
      const next = dayIndex + direction;
      if (next >= 0 && next < days.length) {
        if (root) focusCell(root, next, minutes);
      } else jump(ctx, root, ctx.stepDay(days[dayIndex]!, direction), minutes);
      break;
    }
    case "ArrowDown":
      if (root) focusCell(root, dayIndex, minutes === null ? axis.min : Math.min(axis.last, minutes + axis.slot));
      break;
    case "ArrowUp":
      if (root) focusCell(root, dayIndex, minutes === null || minutes === axis.min ? null : minutes - axis.slot);
      break;
    case "Home":
      if (root) focusCell(root, 0, event.ctrlKey ? axis.min : minutes);
      break;
    case "End":
      if (root) focusCell(root, days.length - 1, event.ctrlKey ? axis.last : minutes);
      break;
    case "PageUp":
    case "PageDown": {
      const step = untrack(ctx.view) === "day" ? 1 : 7;
      jump(ctx, root, days[dayIndex]! + (event.key === "PageUp" ? -step : step), minutes);
      break;
    }
    case " ":
      cellKeyboardSlot(ctx, "click", target, event);
      break;
    case "Enter": {
      const stop = chipAt(target, minutes);
      if (stop) stop.focus();
      else cellKeyboardSlot(ctx, "click", target, event);
      break;
    }
    default:
      return;
  }
  cellKeyHandled(event, ctx);
}

/** First chip starting in the slot (owning slot = this one), or the all-day cell's first chip; never the ghost. */
function chipAt(cell: HTMLElement, minutes: number | null): HTMLElement | null {
  if (minutes === null) return cell.querySelector<HTMLElement>(CHIP);
  const column = cell.parentElement?.closest("[" + DAY_INDEX_ATTR + "]");
  return column?.querySelector<HTMLElement>(CHIP + "[" + SLOT_ATTR + '="' + minutes + '"]') ?? null;
}

/**
 * Grows / shrinks the keyboard selection by one cell (malva `_extendSelection`): ←→ one day (clamped), ↑↓ one slot
 * (clamped to the rendered rows; nothing on the all-day row); a clamped step neither writes nor re-announces.
 */
function extendSelection(ctx: SchedulerContextValue<any>, focus: SchedulerCell, arrow: string): void {
  const current = liveSelection(ctx);
  const anchor = current?.anchor ?? focus;
  const head = current?.head ?? focus;
  const count = untrack(ctx.days).length;
  let { dayIndex, minutes } = head;
  if (arrow === "ArrowLeft" || arrow === "ArrowRight") dayIndex = Math.min(count - 1, Math.max(0, dayIndex + (arrow === "ArrowRight" ? 1 : -1)));
  else if (minutes !== null) {
    const axis = untrack(ctx.axis);
    minutes = Math.min(axis.last, Math.max(axis.min, minutes + axis.slot * (arrow === "ArrowDown" ? 1 : -1)));
  }
  if (current && dayIndex === head.dayIndex && minutes === head.minutes) return;
  setSelectionHead(ctx, anchor, { dayIndex, minutes });
}
