// Rivet addition (not part of @internationalized/date): date values as strings, so widget state
// stays plain JSON for resumability (the resume format refuses class instances). The string is the
// value's ISO 8601 form (`toString()`, always proleptic Gregorian) plus an RFC 9557 calendar
// annotation (`[u-ca=japanese]`) when the value is not Gregorian, so it parses back to the same
// class in the same calendar system:
//   CalendarDate      2026-10-04                       2026-10-04[u-ca=hebrew]
//   CalendarDateTime  2026-10-04T09:30:00
//   ZonedDateTime     2026-10-04T09:30:00+03:00[Europe/Kyiv]
//   Time              09:30:00
import { CalendarDate, CalendarDateTime, Time, ZonedDateTime } from "./CalendarDate.ts";
import { createCalendar } from "./createCalendar.ts";
import { toCalendar } from "./conversion.ts";
import { parseDate, parseDateTime, parseTime, parseZonedDateTime } from "./string.ts";
import type { Calendar, CalendarIdentifier } from "./types.ts";

export type AnyDateValue = CalendarDate | CalendarDateTime | ZonedDateTime;
export type AnyTimeValue = Time | CalendarDateTime | ZonedDateTime;
/** A serialized date / time value (see module comment). */
export type DateValueString = string;

const CALENDAR_ANNOTATION = /\[u-ca=([a-z0-9-]+)\]$/;
const cache = new Map<string, AnyDateValue | Time>();

/** The value as a string that `parseDateValue` turns back into an equal value (same class + calendar). */
export function stringifyDateValue(value: AnyDateValue | Time): DateValueString;
export function stringifyDateValue(value: AnyDateValue | Time | null | undefined): DateValueString | null;
export function stringifyDateValue(value: AnyDateValue | Time | null | undefined): DateValueString | null {
  if (value == null) return null;
  const text = value.toString();
  return "calendar" in value && value.calendar.identifier !== "gregory" ? text + "[u-ca=" + value.calendar.identifier + "]" : text;
}

/**
 * Parse a `stringifyDateValue` string (or a plain ISO 8601 date / date-time / zoned date-time /
 * time). Results are cached (values are immutable). `calendars` creates the annotated calendar
 * system (default: `createCalendar`).
 */
export function parseDateValue(text: DateValueString, calendars?: (id: CalendarIdentifier) => Calendar): AnyDateValue | Time;
export function parseDateValue(text: DateValueString | null | undefined, calendars?: (id: CalendarIdentifier) => Calendar): AnyDateValue | Time | null;
export function parseDateValue(text: DateValueString | null | undefined, calendars?: (id: CalendarIdentifier) => Calendar): AnyDateValue | Time | null {
  if (text == null || text === "") return null;
  const hit = calendars ? undefined : cache.get(text);
  if (hit) return hit;
  let body = text,
    calendar: CalendarIdentifier | null = null;
  const annotation = CALENDAR_ANNOTATION.exec(text);
  if (annotation) {
    calendar = annotation[1] as CalendarIdentifier;
    body = text.slice(0, annotation.index);
  }
  let value: AnyDateValue | Time;
  if (body.includes("[")) value = parseZonedDateTime(body);
  else if (body.includes("T")) value = parseDateTime(body);
  else if (/^\d{2}:/.test(body)) value = parseTime(body);
  else value = parseDate(body);
  if (calendar && calendar !== "gregory" && !(value instanceof Time)) value = toCalendar(value, (calendars ?? createCalendar)(calendar));
  if (!calendars) {
    if (cache.size > 512) cache.clear();
    cache.set(text, value);
  }
  return value;
}

/** Accept a value or its string form (component props), return the string form. */
export function toDateValueString(value: AnyDateValue | Time | DateValueString | null | undefined): DateValueString | null {
  return value == null ? null : typeof value === "string" ? value : stringifyDateValue(value);
}
