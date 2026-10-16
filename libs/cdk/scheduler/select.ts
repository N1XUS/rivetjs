// Ported from @malva-ui/scheduler (src/lib/month/scheduler-month.ts + src/lib/time-grid/scheduler-time-grid.ts: the
// range-select `attachPointerDrag` trackers, `_positionAt`, pending anchor), MIT, © 2026 Malva UI.
// Rivet: one tracker for both views, started by `behaviour.ts` `schedulerPress` from the pointerdown that loaded this
// chunk (`startPointerDrag`); the selection is `state.selection` (keyed by the rendered days, the views paint it);
// the trailing click is swallowed once (`swallowNextClick`, 300 ms, inside the surface, not after touch) instead of
// malva's `_ignoreClicksUntil`.
import { untrack } from "@rivetjs/reactivity";
import { TOUCH_GESTURE_DELAY, elementAt, startPointerDrag, swallowNextClick } from "./pointer.ts";
import { commitSelection, schedulerDays, schedulerDaysKey, type SchedulerCell, type SchedulerState } from "./state.ts";

const CELL = "[data-rv-day-index][data-rv-minutes]";

/** Grid position of the cell `element` sits in, `null` outside every cell (malva `_positionAt`). */
export function cellPositionOf(element: Element | null): SchedulerCell | null {
  const cell = element?.closest<HTMLElement>(CELL);
  if (!cell) return null;
  const raw = cell.getAttribute("data-rv-minutes")!;
  return { dayIndex: Number(cell.getAttribute("data-rv-day-index")), minutes: raw === "all-day" ? null : Number(raw) };
}

/**
 * Range selection from the press on `surface` (month grid / time-grid sheet): the anchor is the pressed cell, the
 * gesture arms after 5 px (touch: after a 200 ms rest, so a swipe pans), the head follows the cell under the POINTER
 * (`elementAt`: a touch pointer stays captured by the pressed cell) and never crosses between the all-day row and the
 * time slots; release commits `onRangeSelect` and swallows its click; Escape / pointercancel clear (and swallow the
 * click the release still fires when something was painted).
 */
export function startRangeSelect(state: SchedulerState<any>, press: PointerEvent, surface: HTMLElement, anchor: SchedulerCell, released: boolean): void {
  const doc = surface.ownerDocument;
  let started = false;
  startPointerDrag(
    press,
    surface,
    {
      onStart: () => {
        started = true;
        const key = untrack(() => schedulerDaysKey(schedulerDays(state)));
        state.selection.set({ anchor, head: anchor, key });
      },
      onMove: (at, event) => {
        const current = untrack(state.selection);
        const hit = elementAt(doc, at, event.target) as Element | null;
        const pos = hit && surface.contains(hit) ? cellPositionOf(hit) : null;
        if (!current || !pos || (pos.minutes === null) !== (current.anchor.minutes === null)) return;
        if (pos.dayIndex === current.head.dayIndex && pos.minutes === current.head.minutes) return;
        state.selection.set({ ...current, head: pos });
      },
      onEnd: (_at, moved) => {
        // Only a drag that painted a selection commits one and swallows the click that trails it.
        if (!moved || !untrack(state.selection)) return;
        swallowNextClick(doc, press, [surface]);
        commitSelection(state, "pointer");
      },
      onCancel: () => {
        // A cancel before the threshold (touch swipe in the arm delay, Escape on a still press) leaves a pending
        // keyboard selection alone.
        if (!started) return;
        // Swallow from the tracker's own state: an Escape on the focused pressed cell reaches the view's key handler
        // first, which clears the selection before this document listener runs (review T7+T8 #2; malva's reason for
        // the swallow). `onStart` painted the anchor, so a started gesture always painted something.
        swallowNextClick(doc, press, [surface]);
        state.selection.set(null);
      },
    },
    { capture: false, threshold: 5, touchDelay: TOUCH_GESTURE_DELAY, released: () => released },
  );
}
