// Rivet-authored (no upstream): binds `@rivetjs/cdk/wheel-picker` drums to a TimeField's state (`@rivetjs/cdk/state/time-field`,
// React Stately useTimeFieldState port). The drums read and write the same state the segments do (the display value =
// React Stately's `IncompleteDate`, the value = the same `Time` / date-time string), so segments and drums stay in sync
// both ways.
// - Drums: one per editable time segment (`hour`, `minute`, `second`, `dayPeriod`) in the locale's segment order; the
//   hour drum follows the field's hour cycle (h12: 12, 1 … 11; h11: 0 … 11; h23: 0 … 23; h24: 1 … 24); labels use the
//   locale's digits (2-digit like the field's formatter), AM / PM from `Intl.DateTimeFormat` `dayPeriod` parts.
// - Shown value of a drum: the display value's field, else the placeholder's (React Stately `placeholderDate`); minute /
//   second drums with a step show the step at or below it.
// - Commit: a drum change sets every drum's field at once (the shown values of the others), so the first spin of an
//   empty field completes it (iOS wheels always show a full time), then clamps to `minValue` / `maxValue`.
// - Disabled options: an option whose whole span (the hour, the minute, the second, the half day) lies outside
//   `minValue` … `maxValue`, given the other drums' shown values, is disabled (skipped by the drum). Times compare as
//   seconds of the day (a date part of min / max is ignored).
import { parseDateValue } from "@rivetjs/cdk/date";
import { untrack } from "@rivetjs/reactivity";
import type { WheelOption } from "../wheel-picker/behaviour.ts";
import {
  IncompleteDate,
  calendarOf,
  displayValue,
  ownerDisabled,
  ownerOf,
  ownerReadOnly,
  placeholderDate,
  setValue,
  type DateFieldState,
  type HourCycle,
} from "../state/date-field.ts";

export type TimeWheelType = "hour" | "minute" | "second" | "dayPeriod";
export const TIME_WHEEL_TYPES: readonly TimeWheelType[] = ["hour", "minute", "second", "dayPeriod"];

/** Plain configuration shared by the drums of one TimeWheels (resumable data). */
export interface TimeWheelsConfig {
  /** Drum types in display order. */
  types: TimeWheelType[];
  /** Minute drum step. */
  minuteStep: number;
  /** Second drum step. */
  secondStep: number;
}

type Fields = Record<TimeWheelType, number>;

const toHourCycle = (hour: number, hc: HourCycle): [number, number] => {
  const dayPeriod = hour >= 12 ? 1 : 0;
  if (hc === "h11") return [dayPeriod, hour % 12];
  if (hc === "h12") return [dayPeriod, hour % 12 || 12];
  if (hc === "h24") return [dayPeriod, hour + 1];
  return [dayPeriod, hour];
};
const fromHourCycle = (hour: number, dayPeriod: number, hc: HourCycle): number => {
  if (hc === "h11") return hour + (dayPeriod ? 12 : 0);
  if (hc === "h12") return (hour === 12 ? 0 : hour) + (dayPeriod ? 12 : 0);
  if (hc === "h24") return hour - 1;
  return hour;
};
const is12 = (hc: HourCycle): boolean => hc === "h12" || hc === "h11";

const numberFormats = new Map<string, Intl.NumberFormat>();
function formatNumber(locale: string, value: number, twoDigit: boolean): string {
  const key = locale + (twoDigit ? "|2" : "");
  let format = numberFormats.get(key);
  if (!format) numberFormats.set(key, (format = new Intl.NumberFormat(locale, { useGrouping: false, ...(twoDigit ? { minimumIntegerDigits: 2 } : {}) })));
  return format.format(value);
}

/** AM / PM labels of `locale` (`Intl.DateTimeFormat` `dayPeriod` parts at 00:00 and 12:00). */
export function dayPeriodLabels(locale: string): [string, string] {
  const format = new Intl.DateTimeFormat(locale, { hour: "numeric", hourCycle: "h12", timeZone: "UTC" });
  const part = (hour: number): string =>
    format.formatToParts(new Date(Date.UTC(2000, 0, 1, hour))).find((p) => p.type === "dayPeriod")?.value ?? (hour ? "PM" : "AM");
  return [part(0), part(12)];
}

/** The options of a drum. */
export function timeWheelOptions(
  type: TimeWheelType,
  options: { locale: string; hourCycle: HourCycle; twoDigitHour?: boolean; minuteStep?: number; secondStep?: number },
): WheelOption<number>[] {
  const { locale, hourCycle } = options;
  if (type === "dayPeriod") {
    const [am, pm] = dayPeriodLabels(locale);
    return [
      { value: 0, label: am },
      { value: 1, label: pm },
    ];
  }
  if (type === "hour") {
    const hours =
      hourCycle === "h12"
        ? [12, ...Array.from({ length: 11 }, (_, i) => i + 1)]
        : hourCycle === "h11"
          ? Array.from({ length: 12 }, (_, i) => i)
          : hourCycle === "h24"
            ? Array.from({ length: 24 }, (_, i) => i + 1)
            : Array.from({ length: 24 }, (_, i) => i);
    return hours.map((h) => ({ value: h, label: formatNumber(locale, h, !!options.twoDigitHour) }));
  }
  const step = Math.max(1, Math.floor((type === "minute" ? options.minuteStep : options.secondStep) ?? 1));
  const values: number[] = [];
  for (let v = 0; v < 60; v += step) values.push(v);
  return values.map((v) => ({ value: v, label: formatNumber(locale, v, true) }));
}

/** Every drum's shown value (display value, else the placeholder; stepped drums round down). Reads. */
function shownFields(state: DateFieldState, config: TimeWheelsConfig): Fields {
  const display = displayValue(state);
  const placeholder = new IncompleteDate(calendarOf(state), state.hourCycle, placeholderDate(state) as unknown as Record<string, unknown>);
  const pick = (type: TimeWheelType): number => (display[type] ?? placeholder[type] ?? 0) as number;
  const minute = pick("minute"),
    second = pick("second");
  return {
    hour: pick("hour"),
    dayPeriod: is12(state.hourCycle) ? pick("dayPeriod") : 0,
    minute: minute - (minute % config.minuteStep),
    second: second - (second % config.secondStep),
  };
}

/** The value a drum shows. Reads. */
export function timeWheelValue(state: DateFieldState, type: TimeWheelType, config: TimeWheelsConfig): number {
  return shownFields(state, config)[type];
}

const seconds = (f: Fields, hc: HourCycle): number => fromHourCycle(f.hour, f.dayPeriod, hc) * 3600 + f.minute * 60 + f.second;

function boundOf(text: string | null): number | null {
  if (!text) return null;
  const value = parseDateValue(text) as { hour?: number; minute?: number; second?: number } | null;
  if (!value) return null;
  return (value.hour ?? 0) * 3600 + (value.minute ?? 0) * 60 + (value.second ?? 0);
}

/** `[min, max]` seconds of the day of the field's `minValue` / `maxValue` (`null` = unbounded). */
function bounds(state: DateFieldState): [number | null, number | null] {
  const owner = ownerOf(state);
  return [boundOf(owner.minValue), boundOf(owner.maxValue)];
}

/** Whether option `value` of drum `type` is outside `minValue` … `maxValue` for its whole span. Reads. */
export function isTimeWheelOptionDisabled(state: DateFieldState, type: TimeWheelType, value: number, config: TimeWheelsConfig): boolean {
  const [min, max] = bounds(state);
  if (min == null && max == null) return false;
  const fields = { ...shownFields(state, config), [type]: value };
  const hc = state.hourCycle;
  const has = (t: TimeWheelType): boolean => config.types.includes(t);
  let lo: number, hi: number;
  if (type === "dayPeriod") {
    lo = value * 43200;
    hi = lo + 43199;
  } else if (type === "hour") {
    lo = fromHourCycle(value, fields.dayPeriod, hc) * 3600;
    hi = lo + 3599;
  } else if (type === "minute") {
    lo = fromHourCycle(fields.hour, fields.dayPeriod, hc) * 3600 + value * 60;
    hi = lo + (has("second") ? 59 : 0);
  } else {
    lo = hi = seconds(fields, hc);
  }
  return (max != null && lo > max) || (min != null && hi < min);
}

/** Drum `type` settled on `value`: sets every drum's field (completing an empty field), clamped to min / max. */
export function setTimeWheelValue(state: DateFieldState, type: TimeWheelType, value: number, config: TimeWheelsConfig): void {
  const owner = ownerOf(state);
  if (ownerDisabled(owner) || ownerReadOnly(owner)) return;
  const hc = state.hourCycle;
  let fields: Fields = { ...untrack(() => shownFields(state, config)), [type]: value };
  const [min, max] = untrack(() => bounds(state));
  const total = seconds(fields, hc);
  const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, total));
  if (clamped !== total) {
    const [dayPeriod, hour] = toHourCycle(Math.floor(clamped / 3600), hc);
    const rest = clamped % 3600;
    fields = { hour, dayPeriod, minute: Math.floor(rest / 60), second: rest % 60 };
  }
  const placeholder = untrack(() => placeholderDate(state));
  let next = untrack(() => displayValue(state));
  for (const t of config.types) next = next.set(t, fields[t], placeholder);
  setValue(state, next);
}
