// Ported from @malva-ui/scheduler (src/lib/month/scheduler-month.ts + src/lib/time-grid/scheduler-time-grid.ts
// `_selectedBounds` / `_isSelected`, src/lib/scheduler/scheduler.ts `selectable`), MIT, © 2026 Malva UI.
// Rivet: the range-selection helpers in a leaf module (no intl, no layout, no date code): the views' bindings and the
// delegated press handler (`behaviour.ts`) import it without pulling `state.ts` + `intl.ts` into the handler chunks
// (`docs/guides/resumability.md` "App guidance", `tests/scheduler-chunks.test.ts`). `state.ts` re-exports it.
import type { SchedulerState } from "./state.ts";

const read = <T>(value: T | (() => T)): T => (typeof value === "function" ? (value as () => T)() : value);

/** A grid position: a day (month cell / all-day cell: `minutes` `null`) or a time slot. */
export interface SchedulerCell {
  readonly dayIndex: number;
  readonly minutes: number | null;
}

/** A pending range selection (pointer drag or `Shift+Arrow`). */
export interface SchedulerSelection {
  readonly anchor: SchedulerCell;
  readonly head: SchedulerCell;
  /** The rendered days it was made on (`schedulerDaysKey`): a selection of another range is stale (malva `linkedSignal`). */
  readonly key: string;
}

/** Ordered selection span (malva `_selectedBounds`): days by index, minutes on the first / last day. */
export interface SchedulerSelectionBounds {
  readonly allDay: boolean;
  readonly dayFrom: number;
  readonly dayTo: number;
  /** Start minute on `dayFrom` (0 when all-day). */
  readonly from: number;
  /** Start minute of the last selected slot on `dayTo` (0 when all-day). */
  readonly to: number;
}

/** Identity of the rendered days (selection staleness). */
export function schedulerDaysKey(days: readonly number[]): string {
  return days.length ? days.length + ":" + days[0] : "";
}

/**
 * The selection ordered as `(dayIndex, minutes)` tuples (malva `_selectedBounds`: a backwards multi-day drag Tue 14:00
 * → Wed 09:00 is Tue 14:00 → Wed 09:00, never per component), `null` without one or when it belongs to other days.
 */
export function schedulerSelectionBounds(selection: SchedulerSelection | null, days: readonly number[]): SchedulerSelectionBounds | null {
  if (!selection || selection.key !== schedulerDaysKey(days)) return null;
  const { anchor, head } = selection;
  const allDay = anchor.minutes === null;
  const a = anchor.minutes ?? 0;
  const h = head.minutes ?? a;
  const anchorFirst = anchor.dayIndex === head.dayIndex ? a <= h : anchor.dayIndex < head.dayIndex;
  return {
    allDay,
    dayFrom: Math.min(anchor.dayIndex, head.dayIndex),
    dayTo: Math.max(anchor.dayIndex, head.dayIndex),
    from: allDay ? 0 : anchorFirst ? a : h,
    to: allDay ? 0 : anchorFirst ? h : a,
  };
}

/** Whether a cell is painted (malva `_isSelected`: CONTINUOUS — first day from its minute, middle days full, last day up to its minute). */
export function isCellSelected(bounds: SchedulerSelectionBounds | null, dayIndex: number, minutes: number | null): boolean {
  if (!bounds || dayIndex < bounds.dayFrom || dayIndex > bounds.dayTo) return false;
  if (bounds.allDay) return minutes === null;
  if (minutes === null) return false;
  return (dayIndex > bounds.dayFrom || minutes >= bounds.from) && (dayIndex < bounds.dayTo || minutes <= bounds.to);
}

/** Whether range selection is allowed. */
export function schedulerSelectable(state: SchedulerState<any>): boolean {
  return read(state.options.allowsRangeSelection) ?? true;
}
