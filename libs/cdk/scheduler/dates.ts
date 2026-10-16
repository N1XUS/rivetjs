// Rivet-authored date bridge of `@rivetjs/cdk/scheduler` (replaces malva's `MlvDateAdapter<D>` calls in
// @malva-ui/scheduler `layout/*.ts`, MIT, © 2026 Malva UI — mapping table in `scheduler/CLAUDE.md`).
// Layout runs on integers only:
// - `day`  = days since 1970-01-01, proleptic Gregorian (`dayFromCivil`), weekday `(day + 4) % 7` (0 = Sunday);
// - `minute` = minutes of day 0…1440; "wall minutes" = `day * 1440 + minute` (one integer per instant on the
//   wall clock of the scheduler `timeZone`; arithmetic = wall-clock arithmetic, so a 00:00 → 24:00 event covers
//   the whole day on a DST day too).
// Inputs: `CalendarDate` / `CalendarDateTime` / `ZonedDateTime` (any calendar) or their `DateValueString` form
// (`@rivetjs/cdk/date` `stringifyDateValue`). A string's ISO body is always proleptic Gregorian (the `[u-ca=…]`
// annotation only names the calendar it parses back into), so strings are read with one regex and no calendar
// code. Results are written back by `fromLayout` in the form of a `like` value: string in → string out (same
// annotation), instance in → same class, calendar and zone out.
// Deviation: malva's "Invalid Date propagates" → an unparsable value reads as `null` (the event is not placed).
import { CalendarDate, CalendarDateTime, ZonedDateTime, type DateValue } from "../date/CalendarDate.ts";
import { GregorianCalendar } from "../date/calendars/GregorianCalendar.ts";
import { fromAbsolute, getTimeZoneOffset, toAbsolute, toCalendar } from "../date/conversion.ts";
import { now, today } from "../date/queries.ts";
import { DateFormatter } from "../date/DateFormatter.ts";
import { cachedIntl } from "../i18n/intl-cache.ts";
import type { DateValueString } from "../date/serialize.ts";
import { MINUTES_PER_DAY } from "./time.ts";

/** A scheduler date input: a `@rivetjs/cdk/date` value or its `DateValueString`. */
export type SchedulerDate = DateValue | DateValueString;

/** A point on the layout axis. */
export interface LayoutTime {
  /** Days since 1970-01-01 (proleptic Gregorian). */
  readonly day: number;
  /** Minutes of day, `0`–`1439`. */
  readonly minute: number;
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
let gregorian: GregorianCalendar | undefined;

/** Day number of a proleptic Gregorian date (`month` 1–12). */
export function dayFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** `[year, month (1–12), day]` of a day number. */
export function civilFromDay(dayNumber: number): [number, number, number] {
  const z = dayNumber + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return [yoe + era * 400 + (month <= 2 ? 1 : 0), month, day];
}

/** `day` plus `months` calendar months: same day of month, clamped to the target month's length (malva `addCalendarMonths`). */
export function addCalendarMonths(day: number, months: number): number {
  const [y, m, d] = civilFromDay(day);
  const month0 = m - 1 + months;
  const year = y + Math.floor(month0 / 12);
  const month = ((month0 % 12) + 12) % 12;
  const length = dayFromCivil(month === 11 ? year + 1 : year, month === 11 ? 1 : month + 2, 1) - dayFromCivil(year, month + 1, 1);
  return dayFromCivil(year, month + 1, Math.min(d, length));
}

/** Weekday of a day number, 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

/** The day number a wall-minute value falls on. */
export function dayOf(wall: number): number {
  return Math.floor(wall / MINUTES_PER_DAY);
}

/** Minutes of day of a wall-minute value (`0`–`1439`). */
export function minuteOf(wall: number): number {
  return wall - dayOf(wall) * MINUTES_PER_DAY;
}

const ISO = /^([+-]?\d{4,6})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:([+-])(\d{2}):(\d{2})(?::\d{2})?)?(?:\[([^\]=]+)\])?)?/;

/** Wall minutes of `ms` (epoch) on the wall clock of `timeZone`. */
function wallOfAbsolute(ms: number, timeZone: string): number {
  return Math.floor((ms + getTimeZoneOffset(ms, timeZone)) / MINUTE_MS);
}

/**
 * Wall minutes (`day * 1440 + minute`) of a date input on the wall clock of `timeZone`, or `null` when the input
 * does not parse. Dates read as midnight; `ZonedDateTime` (instance or string) converts from its own zone into
 * `timeZone`; `CalendarDateTime` is a wall-clock value already (no zone).
 */
export function toWallMinutes(value: SchedulerDate | null | undefined, timeZone = "UTC"): number | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const m = ISO.exec(value);
    if (!m) return null;
    const day = dayFromCivil(Number(m[1]), Number(m[2]), Number(m[3]));
    const local = day * MINUTES_PER_DAY + (m[4] ? Number(m[4]) * 60 + Number(m[5]) : 0);
    if (!m[7] || !m[10] || m[10] === timeZone) return Number.isFinite(local) ? local : null;
    const offset = (m[7] === "-" ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]));
    const seconds = m[6] ? Number(m[6]) : 0;
    return wallOfAbsolute((local - offset) * MINUTE_MS + seconds * 1000, timeZone);
  }
  let v: DateValue = value;
  if (v.calendar.identifier !== "gregory") v = toCalendar(v, (gregorian ??= new GregorianCalendar()));
  const year = v.era === "BC" ? 1 - v.year : v.year;
  const local = dayFromCivil(year, v.month, v.day) * MINUTES_PER_DAY + ("hour" in v ? v.hour * 60 + v.minute : 0);
  if (!(v instanceof ZonedDateTime) || v.timeZone === timeZone) return local;
  return wallOfAbsolute(local * MINUTE_MS + v.second * 1000 + v.millisecond - v.offset, timeZone);
}

/** `toWallMinutes` split into `{ day, minute }`. */
export function toLayoutTime(value: SchedulerDate | null | undefined, timeZone = "UTC"): LayoutTime | null {
  const wall = toWallMinutes(value, timeZone);
  return wall === null ? null : { day: dayOf(wall), minute: minuteOf(wall) };
}

const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

function isoYear(year: number): string {
  return year < 0 ? "-" + pad(-year, 6) : year > 9999 ? "+" + pad(year, 6) : pad(year, 4);
}

/**
 * The layout point `day` + `minute` (minutes past 1440 roll into the next days) written back in the form of
 * `like`: a string in → a string out (same shape and `[u-ca=…]` annotation); an instance in → the same class,
 * calendar and zone out. `allDay` (default: `like` is a plain date) picks a date-only result for a date `like`
 * and a timed one otherwise (`CalendarDate` → `CalendarDateTime`); date-time / zoned `like`s keep their class
 * (all-day = midnight). A wall time in a DST gap resolves `"compatible"` (later).
 */
export function fromLayout<V extends SchedulerDate>(day: number, minute: number, like: V, timeZone = "UTC", allDay?: boolean): V {
  const wall = day * MINUTES_PER_DAY + minute;
  const d = dayOf(wall);
  const mins = wall - d * MINUTES_PER_DAY;
  const [year, month, date] = civilFromDay(d);
  const hour = Math.floor(mins / 60);
  const min = mins % 60;
  if (typeof like === "string") {
    const m = ISO.exec(like);
    const annotation = /\[u-ca=[a-z0-9-]+\]$/.exec(like)?.[0] ?? "";
    const isDate = !m?.[4];
    const zone = m?.[10];
    const dateOnly = allDay ?? isDate;
    const body = isoYear(year) + "-" + pad(month) + "-" + pad(date);
    if (zone) {
      const ms = toAbsolute(new CalendarDateTime(year, month, date, hour, min), timeZone);
      const zoned = fromAbsolute(ms, zone);
      return (zoned.toString() + annotation) as V;
    }
    if (isDate && dateOnly) return (body + annotation) as V;
    return (body + "T" + pad(hour) + ":" + pad(min) + ":00" + annotation) as V;
  }
  const value = like as DateValue;
  const isDate = !("hour" in value);
  let out: DateValue;
  if (value instanceof ZonedDateTime) {
    const ms = toAbsolute(new CalendarDateTime(year, month, date, hour, min), timeZone);
    out = fromAbsolute(ms, value.timeZone);
  } else if (isDate && (allDay ?? true)) {
    out = new CalendarDate(year, month, date);
  } else {
    out = new CalendarDateTime(year, month, date, hour, min);
  }
  if (value.calendar.identifier !== "gregory") out = toCalendar(out, value.calendar);
  return out as V;
}

/** Today's day number on the wall clock of `timeZone`. */
export function todayDay(timeZone: string): number {
  const t = today(timeZone);
  return dayFromCivil(t.year, t.month, t.day);
}

/** The current wall minutes in `timeZone`. */
export function nowWall(timeZone: string): number {
  const n = now(timeZone);
  return dayFromCivil(n.year, n.month, n.day) * MINUTES_PER_DAY + n.hour * 60 + n.minute;
}

const Formatter = DateFormatter as new (locale: string | undefined, options: Intl.DateTimeFormatOptions) => DateFormatter;
const formatter = (locale: string, options: Intl.DateTimeFormatOptions): DateFormatter => cachedIntl(Formatter, locale, { ...options, timeZone: "UTC" });

/**
 * Formats a day number (labels: weekday names, day of month, titles). `options` are `Intl.DateTimeFormat` options;
 * the zone is fixed to UTC (day numbers are wall-clock days), the calendar follows the locale (`-u-ca-…`).
 * Formatters are cached per locale + options (`i18n/intl-cache`).
 */
export function formatDay(day: number, locale: string, options: Intl.DateTimeFormatOptions): string {
  return formatter(locale, options).format(new Date(day * DAY_MS));
}

/** Formats wall minutes (time labels) like `formatDay`. */
export function formatWall(wall: number, locale: string, options: Intl.DateTimeFormatOptions): string {
  return formatter(locale, options).format(new Date(wall * MINUTE_MS));
}

/** Formats a range of day numbers / wall minutes (`formatRange`, e.g. a week title). */
export function formatDayRange(start: number, end: number, locale: string, options: Intl.DateTimeFormatOptions): string {
  return formatter(locale, options).formatRange(new Date(start * DAY_MS), new Date(end * DAY_MS));
}
