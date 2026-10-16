// Rivet-only (no HeroUI counterpart): date props handed to cdk date parts in their string form.
import { toDateValueString } from "@rivetjs/cdk/date";
import type { AnyDateValue, DateValueString } from "@rivetjs/cdk/date";

type DateInput = AnyDateValue | DateValueString | null | undefined;
type DatePropValue = DateInput | readonly DateInput[] | { start: DateInput; end: DateInput } | ((...args: never[]) => unknown);

/**
 * A cdk date prop (`value`, `defaultValue`, `minValue`, `maxValue`, `focusedValue`, …) as its string form (`toDateValueString`:
 * keeps a non-gregorian calendar as a `[u-ca=…]` annotation): the cdk parts capture their props in resumable closures, and a
 * `CalendarDate` / `ZonedDateTime` instance is not serializable (the server render fails on a resumed page). Signals (functions),
 * strings and nullish values pass through; arrays (multiple selection) and `{ start, end }` ranges map per date.
 */
export function dateProp<T>(value: T): T {
  const v = value as DatePropValue;
  if (v == null || typeof v === "string" || typeof v === "function") return value;
  if (Array.isArray(v)) return v.map((d: DateInput) => toDateValueString(d)) as T;
  if ("start" in v && "end" in v && !("calendar" in v)) return { start: toDateValueString(v.start), end: toDateValueString(v.end) } as T;
  return toDateValueString(v as AnyDateValue) as T;
}

/** The passed (`!== undefined`) `keys` of `props` through `dateProp` (cdk tells controlled from uncontrolled by `!== undefined`). */
export function dateProps(props: object, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = (props as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = dateProp(value);
  }
  return out;
}
