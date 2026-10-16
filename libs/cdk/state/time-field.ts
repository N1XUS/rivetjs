// Ported from react-stately (react-spectrum) src/datepicker/useTimeFieldState.ts, Apache-2.0, © Adobe.
// Rivet:
// - The state is a standalone date field state (`./date-field.ts`) with `kind: "time"`: `value`
//   holds the TimeValue's string form (`Time` "11:45:00", or a date-time when it has a date);
//   the field edits it as a date-time on the value's date (else today), as React Stately's
//   `convertValue` does, and emits a `Time` unless the value / placeholder has a date or the
//   default value has a time zone.
// - Methods are the date field's functions (`increment(state, "hour")` …); `timeValue(state)` is
//   React Stately's `state.timeValue`.
// Deviation: none in behaviour; the date-time conversion runs on read instead of per render.
import { parseDateValue, toTime, type DateValueString, type Time } from "@rivetjs/cdk/date";
import type { Signal } from "@rivetjs/reactivity";
import type { ValidationFunction } from "./form-validation.ts";
import {
  dateValueSignal,
  fieldState,
  type DateFieldBaseOptions,
  type DateValueProp,
  type MappedTimeValue,
  type StandaloneDateFieldState,
  type TimeValue,
} from "./date-field.ts";

export type { MappedTimeValue, TimeValue } from "./date-field.ts";

/** useTimeFieldState props (TimePickerProps + `locale`). */
export interface TimeFieldStateOptions<T extends TimeValue = TimeValue> extends Omit<
  DateFieldBaseOptions,
  "minValue" | "maxValue" | "placeholderValue" | "granularity" | "createCalendar"
> {
  /** Controlled value: a time value, or a two-way signal of its string form. */
  value?: DateValueProp<T>;
  /** Uncontrolled initial value. */
  defaultValue?: T | DateValueString | null;
  /** Handler that is called when the value changes. */
  onChange?: (value: MappedTimeValue<T> | null) => void;
  /** The minimum allowed time that a user may select. */
  minValue?: TimeValue | DateValueString | null;
  /** The maximum allowed time that a user may select. */
  maxValue?: TimeValue | DateValueString | null;
  /** A placeholder time that influences the format of the placeholder shown when no value is selected. Defaults to 12:00 AM or 00:00 depending on the hour cycle. */
  placeholderValue?: TimeValue | DateValueString | null;
  /** Determines the smallest unit that is displayed in the time picker. @default 'minute' */
  granularity?: "hour" | "minute" | "second";
  /** Custom client validation of the value (a time object). */
  validate?: ValidationFunction<MappedTimeValue<T>>;
  id?: string;
}

/** A TimeField's state (DateFieldState with `kind: "time"`). */
export type TimeFieldState = StandaloneDateFieldState;

/**
 * `useTimeFieldState`: state of a time field (time values entered and edited segment by segment).
 */
export function createTimeFieldState<T extends TimeValue = TimeValue>(options: TimeFieldStateOptions<T> = {}): TimeFieldState {
  const value: Signal<DateValueString | null> = dateValueSignal(options.value, options.defaultValue);
  const defaultValue = typeof options.defaultValue === "string" ? (parseDateValue(options.defaultValue) as TimeValue) : options.defaultValue;
  const defaultTimeZone = defaultValue && "timeZone" in defaultValue ? defaultValue.timeZone : undefined;
  return fieldState(
    {
      ...options,
      granularity: options.granularity || "minute",
      maxGranularity: "hour",
      ...(defaultTimeZone ? { defaultTimeZone } : {}),
    } as Parameters<typeof fieldState>[0],
    value,
    "time",
  );
}

/** The current time value (React Stately `state.timeValue`). Reads. */
export function timeValue(state: TimeFieldState): Time | null {
  const text = state.value();
  if (!text) return null;
  const value = parseDateValue(text) as TimeValue;
  return "day" in value ? toTime(value) : value;
}
