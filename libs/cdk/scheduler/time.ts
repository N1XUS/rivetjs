// Ported from @malva-ui/scheduler (src/lib/layout/scheduler-time.ts), MIT, © 2026 Malva UI.
// Rivet:
// - `MlvSchedulerOffsetBound` → `SchedulerOffsetBound`; everything else 1:1 (names, throw texts, rounding rules).
// - Pure and server-safe: no DOM, no date objects (minutes of day only).

/** Minutes in one calendar day. */
export const MINUTES_PER_DAY = 1440;

/** Weekdays (0 = Sunday) `SchedulerBusinessHours.days` defaults to. */
export const DEFAULT_BUSINESS_DAYS: readonly number[] = [1, 2, 3, 4, 5];

const TIME_PATTERN = /^([01]\d|2[0-4]):([0-5]\d)$/;

/** Parses `'HH:mm'` (two-digit hours, `'24:00'` allowed) into minutes of day. */
export function parseTime(value: string): number {
  const match = TIME_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid time "${value}". Expected "HH:mm" between 00:00 and 24:00.`);
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes > MINUTES_PER_DAY) throw new Error(`Invalid time "${value}". Expected "HH:mm" between 00:00 and 24:00.`);
  return minutes;
}

/**
 * Rounds to the nearest multiple of `snap`. A non-positive `snap` means "no snapping", which still rounds to a
 * whole minute: layout minutes are integers (written back through `fromLayout`, which takes whole minutes).
 */
export function snapMinutes(minutes: number, snap: number): number {
  if (snap <= 0) return Math.round(minutes);
  return Math.round(minutes / snap) * snap;
}

/** Clamps into `[min, max]`. */
export function clampMinutes(minutes: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, minutes));
}

/**
 * What the caller does with the minutes `minutesFromOffset` returns.
 *
 * - `'end'` — an edge. `maxMinutes` is legal: an event may end at the window's close, midnight included.
 * - `'start'` — the start of a slot or of a dropped event. `maxMinutes` is **not** legal there: no slot starts at
 *   the window's close, and a start of `MINUTES_PER_DAY` rolls onto the next day. The ceiling drops one snap step
 *   below `maxMinutes`.
 */
export type SchedulerOffsetBound = "start" | "end";

/**
 * Maps a block offset inside a time column to snapped minutes of day. `offsetPx` is measured from the column's
 * block-start edge; the column spans `[minMinutes, maxMinutes)` over `heightPx`.
 *
 * Snapping is relative to `minMinutes`, not to midnight, so an unaligned window (`08:15`–`18:15`) still snaps onto
 * its own slot boundaries. Aligned windows are unaffected.
 */
export function minutesFromOffset(
  offsetPx: number,
  heightPx: number,
  minMinutes: number,
  maxMinutes: number,
  snap: number,
  bound: SchedulerOffsetBound = "end",
): number {
  if (heightPx <= 0) return minMinutes;
  const raw = (offsetPx / heightPx) * (maxMinutes - minMinutes);
  const step = snap > 0 ? snap : 1;
  const ceiling = bound === "start" ? Math.max(minMinutes, maxMinutes - step) : maxMinutes;
  return clampMinutes(minMinutes + snapMinutes(raw, snap), minMinutes, ceiling);
}

/**
 * Number of slot rows needed to cover `[minMinutes, maxMinutes)`. Throws on a non-positive `slotDuration`: the
 * caller renders one row per slot, and a zero or negative duration makes that count infinite.
 */
export function slotCount(minMinutes: number, maxMinutes: number, slotDuration: number): number {
  if (!(slotDuration > 0)) throw new Error(`Invalid slotDuration ${slotDuration}. Expected positive minutes.`);
  return Math.max(1, Math.ceil((maxMinutes - minMinutes) / slotDuration));
}
