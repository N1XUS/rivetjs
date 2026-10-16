// Rivet-only (no React Aria counterpart): live controlled date values (live props P5). The date states keep values
// as strings (`@rivetjs/cdk/date` serialize: resumable); a live `value={date()}` arrives as a getter of a date object
// (or an array / range of them). `liveDateValue` turns it into an accessor of the string form, which the states take
// as a controlled value: read on every use, never written (changes only call `onChange`, upstream's controlled prop).
// A `.tsx` module (resume-compiled): the accessor is a resumable symbol over a narrow props view.
import { untrack } from "@rivetjs/reactivity";
import { splitProps } from "@rivetjs/runtime/props";
import { toDateValueString } from "../date/serialize.ts";
import { isLive, liveAssign } from "../utils/live.tsx";

type Text = string | null;

/** A date value (single, multiple or range) in the states' string form. */
export function dateValueText(value: unknown): Text | Text[] | { start: Text; end: Text } | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => toDateValueString(v));
  const range = value as { start?: unknown; end?: unknown; calendar?: unknown };
  if (!("calendar" in range) && "start" in range && "end" in range)
    return { start: toDateValueString(range.start as never), end: toDateValueString(range.end as never) };
  return toDateValueString(value as never);
}

/**
 * The `value` option for a date state: a live, defined, non-Signal `value` becomes an accessor of its string form
 * (controlled, never written); a Signal (two-way), `undefined` (uncontrolled) or a static value is returned as is.
 */
export function liveDateValue<T extends { value?: unknown }>(props: T): T["value"] {
  if (!isLive(props, "value")) return props.value;
  const now = untrack(() => props.value);
  if (now === undefined || typeof now === "function") return now as T["value"];
  const view = splitProps(props as Record<string, unknown>, ["value"])[0] as { value?: unknown };
  return (() => dateValueText(view.value)) as T["value"];
}

/**
 * `props` with a live controlled `value` replaced by its string-form accessor (`liveDateValue`), other keys forwarded
 * unread — spread it into the state options: the copy reads no `value` getter (a resumed region is not re-created
 * on a value change). Static props / no live `value`: `props` itself.
 */
export function liveDateProps<T extends { value?: unknown }>(props: T): T {
  const value = liveDateValue(props);
  return typeof value === "function" && value !== untrack(() => props.value) ? liveAssign(props, { value }) : props;
}
