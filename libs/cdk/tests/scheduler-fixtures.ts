// Shared fixtures of the scheduler suites (port of @malva-ui/scheduler `src/lib/testing/*` helpers, MIT, © 2026 Malva
// UI). malva's specs build `new Date(y, m, d, h, min)` literals (month 0-based); here the same literals build
// `CalendarDateTime` values, and `w()` / `dn()` read them back as layout integers (wall minutes / day numbers).
import { CalendarDateTime } from "../date/CalendarDate.ts";
import { dayOf, toWallMinutes, type SchedulerDate } from "../scheduler/dates.ts";
import { normalizeEvent, type SchedulerEvent, type SchedulerLayoutRange, type SchedulerNormalizedEvent } from "../scheduler/layout.ts";

/** malva `new Date(y, month0, day, h, min)`. */
export const date = (y: number, month0: number, day: number, h = 0, min = 0): CalendarDateTime => new CalendarDateTime(y, month0 + 1, day, h, min);

/** malva's `d(day, h, m, month = 8)` (September 2026 by default). */
export const d = (day: number, h = 0, m = 0, month = 8): CalendarDateTime => date(2026, month, day, h, m);

/** Wall minutes of a value (UTC wall clock unless `timeZone`). */
export const w = (value: SchedulerDate, timeZone?: string): number => {
  const wall = toWallMinutes(value, timeZone);
  if (wall === null) throw new Error(`unparsable fixture date ${String(value)}`);
  return wall;
};

/** Day number of a value. */
export const dn = (value: SchedulerDate): number => dayOf(w(value));

export const ev = (id: string, start: SchedulerDate, end: SchedulerDate, extra: Partial<SchedulerEvent> = {}): SchedulerEvent => ({
  id,
  title: id,
  start,
  end,
  ...extra,
});

/** `normalizeEvent` that must succeed. */
export const n = <T>(event: SchedulerEvent<T>, defaultEventDuration = 60, timeZone?: string): SchedulerNormalizedEvent<T> => {
  const normalized = normalizeEvent(event, defaultEventDuration, timeZone);
  if (!normalized) throw new Error(`event ${event.id} did not normalize`);
  return normalized;
};

/** A layout range from two fixture values (malva `{ start, end, allDay }` expectations). */
export const range = (start: SchedulerDate, end: SchedulerDate, allDay: boolean): SchedulerLayoutRange => ({ start: w(start), end: w(end), allDay });
