// Ported from react-stately (react-spectrum, Apache-2.0, © Adobe): datepicker/useDateFieldState.ts,
// datepicker/IncompleteDate.ts, datepicker/placeholders.ts, datepicker/utils.ts and datepicker/types.ts.
//
// Rivet shape: the state is plain signals + JSON (resumable); every method of React Stately's
// DateFieldState is an exported function taking the state first (`state.increment('day')` →
// `increment(state, 'day')`), its values are accessors (`segments(state)`, `fieldValue(state)` …).
// Dates live in the signals as strings (`@rivetjs/cdk/date` serialize). The temporary display value
// (an `IncompleteDate` while the user edits, e.g. February 30th) is kept as plain fields next to the
// value string it was based on: a new value drops it (React Stately's "last value" reset).
// A field inside a DatePicker / DateRangePicker reads and writes the picker's value and shares its
// validation state (React Aria's `privateValidationStateProp`). Built-in validation (min / max /
// unavailable) is a signal refreshed on every write (no closures in state).
import type { SlotId } from "../slots/index.tsx";
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import {
  CalendarDate,
  DateFormatter,
  GregorianCalendar,
  Time,
  createCalendar as createAnyCalendar,
  getLocalTimeZone,
  now,
  parseDateValue,
  stringifyDateValue,
  toCalendar,
  toCalendarDate,
  toCalendarDateTime,
  toDateValueString,
  toTime,
  toZoned,
  today,
  type AnyDateValue,
  type CalendarDateTime,
  type DateValueString,
  type ZonedDateTime,
} from "@rivetjs/cdk/date";
import type { Calendar, CalendarIdentifier } from "@rivetjs/cdk/date";
import { controllable } from "@rivetjs/cdk/interactions";
import { createId } from "@rivetjs/cdk/id";
import { formatString, getStringsForLocale, resolveLocale, type LocalizedStrings } from "@rivetjs/cdk/i18n";
import { getDateFormatter } from "../i18n/date-formatter.ts";
import {
  VALID_VALIDITY_STATE,
  createFormValidationState,
  getValidationResult as customValidationResult,
  runValidate,
  displayValidation,
  isEqualValidation,
  mergeValidation,
  type FormValidationState,
  type MaybeAccessor,
  type ValidationBehavior,
  type ValidationErrors,
  type ValidationFunction,
  type ValidationResult,
} from "./form-validation.ts";
import { dateValidationMessages } from "./date-intl.ts";

// ---------------------------------------------------------------------------------------------
// types.ts

export type DateValue = AnyDateValue;
export type TimeValue = Time | CalendarDateTime | ZonedDateTime;
/** The date type emitted for a value of type `T`. */
export type MappedDateValue<T> = T extends ZonedDateTime
  ? ZonedDateTime
  : T extends CalendarDateTime
    ? CalendarDateTime
    : T extends CalendarDate
      ? CalendarDate
      : never;
/** The time type emitted for a value of type `T`. */
export type MappedTimeValue<T> = T extends ZonedDateTime ? ZonedDateTime : T extends CalendarDateTime ? CalendarDateTime : T extends Time ? Time : never;
export type { DateValueString } from "@rivetjs/cdk/date";
export type Granularity = "day" | "hour" | "minute" | "second";
export interface RangeValue<T> {
  start: T;
  end: T;
}
export type DateRange = RangeValue<DateValue>;
/** A date value or its string form (`2026-10-04`, `2026-10-04T09:30`, …). */
export type DateInput = DateValue | DateValueString;

export type DateSegmentType = "era" | "year" | "month" | "day" | "hour" | "minute" | "second" | "dayPeriod" | "literal" | "timeZoneName";

export interface DateSegment {
  /** The type of segment. */
  type: DateSegmentType;
  /** The formatted text for the segment. */
  text: string;
  /** The numeric value for the segment, if applicable. */
  value?: number | null;
  /** The minimum numeric value for the segment, if applicable. */
  minValue?: number;
  /** The maximum numeric value for the segment, if applicable. */
  maxValue?: number;
  /** Whether the value is a placeholder. */
  isPlaceholder: boolean;
  /** A placeholder string for the segment. */
  placeholder: string;
  /** Whether the segment is editable. */
  isEditable: boolean;
}

// ---------------------------------------------------------------------------------------------
// placeholders.ts

// These placeholders are based on the strings used by the <input type="date">
// implementations in Chrome and Firefox. Additional languages are supported
// here than React Spectrum's typical translations.
const placeholders: LocalizedStrings<"year" | "month" | "day"> = {
  ach: { year: "mwaka", month: "dwe", day: "nino" },
  af: { year: "jjjj", month: "mm", day: "dd" },
  am: { year: "ዓዓዓዓ", month: "ሚሜ", day: "ቀቀ" },
  an: { year: "aaaa", month: "mm", day: "dd" },
  ar: { year: "سنة", month: "شهر", day: "يوم" },
  ast: { year: "aaaa", month: "mm", day: "dd" },
  az: { year: "iiii", month: "aa", day: "gg" },
  be: { year: "гггг", month: "мм", day: "дд" },
  bg: { year: "гггг", month: "мм", day: "дд" },
  bn: { year: "yyyy", month: "মিমি", day: "dd" },
  br: { year: "bbbb", month: "mm", day: "dd" },
  bs: { year: "gggg", month: "mm", day: "dd" },
  ca: { year: "aaaa", month: "mm", day: "dd" },
  cak: { year: "jjjj", month: "ii", day: "q'q'" },
  ckb: { year: "ساڵ", month: "مانگ", day: "ڕۆژ" },
  cs: { year: "rrrr", month: "mm", day: "dd" },
  cy: { year: "bbbb", month: "mm", day: "dd" },
  da: { year: "åååå", month: "mm", day: "dd" },
  de: { year: "jjjj", month: "mm", day: "tt" },
  dsb: { year: "llll", month: "mm", day: "źź" },
  el: { year: "εεεε", month: "μμ", day: "ηη" },
  en: { year: "yyyy", month: "mm", day: "dd" },
  eo: { year: "jjjj", month: "mm", day: "tt" },
  es: { year: "aaaa", month: "mm", day: "dd" },
  et: { year: "aaaa", month: "kk", day: "pp" },
  eu: { year: "uuuu", month: "hh", day: "ee" },
  fa: { year: "سال", month: "ماه", day: "روز" },
  ff: { year: "hhhh", month: "ll", day: "ññ" },
  fi: { year: "vvvv", month: "kk", day: "pp" },
  fr: { year: "aaaa", month: "mm", day: "jj" },
  fy: { year: "jjjj", month: "mm", day: "dd" },
  ga: { year: "bbbb", month: "mm", day: "ll" },
  gd: { year: "bbbb", month: "mm", day: "ll" },
  gl: { year: "aaaa", month: "mm", day: "dd" },
  he: { year: "שנה", month: "חודש", day: "יום" },
  hr: { year: "gggg", month: "mm", day: "dd" },
  hsb: { year: "llll", month: "mm", day: "dd" },
  hu: { year: "éééé", month: "hh", day: "nn" },
  ia: { year: "aaaa", month: "mm", day: "dd" },
  id: { year: "tttt", month: "bb", day: "hh" },
  is: { year: "áááá", month: "mm", day: "dd" },
  it: { year: "aaaa", month: "mm", day: "gg" },
  ja: { year: "年", month: "月", day: "日" },
  ka: { year: "წწწწ", month: "თთ", day: "რრ" },
  kk: { year: "жжжж", month: "аа", day: "кк" },
  kn: { year: "ವವವವ", month: "ಮಿಮೀ", day: "ದಿದಿ" },
  ko: { year: "연도", month: "월", day: "일" },
  lb: { year: "jjjj", month: "mm", day: "dd" },
  lo: { year: "ປປປປ", month: "ດດ", day: "ວວ" },
  lt: { year: "mmmm", month: "mm", day: "dd" },
  lv: { year: "gggg", month: "mm", day: "dd" },
  meh: { year: "aaaa", month: "mm", day: "dd" },
  ml: { year: "വർഷം", month: "മാസം", day: "തീയതി" },
  ms: { year: "tttt", month: "mm", day: "hh" },
  nb: { year: "åååå", month: "mm", day: "dd" },
  nl: { year: "jjjj", month: "mm", day: "dd" },
  nn: { year: "åååå", month: "mm", day: "dd" },
  no: { year: "åååå", month: "mm", day: "dd" },
  oc: { year: "aaaa", month: "mm", day: "jj" },
  pl: { year: "rrrr", month: "mm", day: "dd" },
  pt: { year: "aaaa", month: "mm", day: "dd" },
  rm: { year: "oooo", month: "mm", day: "dd" },
  ro: { year: "aaaa", month: "ll", day: "zz" },
  ru: { year: "гггг", month: "мм", day: "дд" },
  sc: { year: "aaaa", month: "mm", day: "dd" },
  scn: { year: "aaaa", month: "mm", day: "jj" },
  sk: { year: "rrrr", month: "mm", day: "dd" },
  sl: { year: "llll", month: "mm", day: "dd" },
  sr: { year: "гггг", month: "мм", day: "дд" },
  "sr-Latn": { year: "gggg", month: "mm", day: "dd" },
  sv: { year: "åååå", month: "mm", day: "dd" },
  szl: { year: "rrrr", month: "mm", day: "dd" },
  tg: { year: "сссс", month: "мм", day: "рр" },
  th: { year: "ปปปป", month: "ดด", day: "วว" },
  tr: { year: "yyyy", month: "aa", day: "gg" },
  uk: { year: "рррр", month: "мм", day: "дд" },
  "zh-CN": { year: "年", month: "月", day: "日" },
  "zh-TW": { year: "年", month: "月", day: "日" },
};

export function getPlaceholder(field: string, value: string, locale: string): string {
  // Use the actual placeholder value for the era and day period fields.
  if (field === "era" || field === "dayPeriod") return value;
  if (field === "year" || field === "month" || field === "day") return getStringsForLocale(placeholders, locale, "en")[field];
  // For time fields (e.g. hour, minute, etc.), use two dashes as the placeholder.
  return "––";
}

// ---------------------------------------------------------------------------------------------
// utils.ts

function getLocale(): string {
  // Match browser language setting here, NOT react-aria's I18nProvider, so that we match other browser-provided
  // validation messages, which to not respect our provider's language.
  let locale = (typeof navigator !== "undefined" && navigator.language) || "en-US";
  // Validation only (a malformed tag throws); syntax-only, no formatter locale data loaded (`getDefaultLocale`).
  try {
    Intl.getCanonicalLocales(locale);
  } catch {
    locale = "en-US";
  }
  return locale;
}

export type FieldOptions = Pick<Intl.DateTimeFormatOptions, "year" | "month" | "day" | "hour" | "minute" | "second">;
export interface FormatterOptions {
  timeZone?: string;
  hideTimeZone?: boolean;
  granularity?: Granularity;
  maxGranularity?: "year" | "month" | Granularity;
  hourCycle?: 12 | 24;
  showEra?: boolean;
  shouldForceLeadingZeros?: boolean;
}

export function getValidationResult(
  value: DateValue | null,
  minValue: DateValue | null | undefined,
  maxValue: DateValue | null | undefined,
  isDateUnavailable: ((v: DateValue) => boolean) | undefined,
  options: FormatterOptions,
): ValidationResult {
  const rangeOverflow = value != null && maxValue != null && value.compare(maxValue) > 0;
  const rangeUnderflow = value != null && minValue != null && value.compare(minValue) < 0;
  const isUnavailable = (value != null && isDateUnavailable?.(value)) || false;
  const isInvalid = rangeOverflow || rangeUnderflow || isUnavailable;
  const errors: string[] = [];
  if (isInvalid) {
    const locale = getLocale();
    const strings = getStringsForLocale(dateValidationMessages, locale);
    const dateFormatter = new DateFormatter(locale, getFormatOptions({}, options));
    const timeZone = dateFormatter.resolvedOptions().timeZone;
    if (rangeUnderflow && minValue != null) errors.push(formatString(strings.rangeUnderflow, { minValue: dateFormatter.format(minValue.toDate(timeZone)) }));
    if (rangeOverflow && maxValue != null) errors.push(formatString(strings.rangeOverflow, { maxValue: dateFormatter.format(maxValue.toDate(timeZone)) }));
    if (isUnavailable) errors.push(strings.unavailableDate);
  }
  return {
    isInvalid,
    validationErrors: errors,
    validationDetails: {
      badInput: isUnavailable,
      customError: false,
      patternMismatch: false,
      rangeOverflow,
      rangeUnderflow,
      stepMismatch: false,
      tooLong: false,
      tooShort: false,
      typeMismatch: false,
      valueMissing: false,
      valid: !isInvalid,
    },
  };
}

export function getRangeValidationResult(
  value: RangeValue<DateValue | null> | null,
  minValue: DateValue | null | undefined,
  maxValue: DateValue | null | undefined,
  isDateUnavailable: ((v: DateValue) => boolean) | undefined,
  options: FormatterOptions,
): ValidationResult {
  const startValidation = getValidationResult(value?.start ?? null, minValue, maxValue, isDateUnavailable, options);
  const endValidation = getValidationResult(value?.end ?? null, minValue, maxValue, isDateUnavailable, options);
  let result = mergeValidation(startValidation, endValidation);
  if (value?.end != null && value.start != null && value.end.compare(value.start) < 0) {
    const strings = getStringsForLocale(dateValidationMessages, getLocale());
    result = mergeValidation(result, {
      isInvalid: true,
      validationErrors: [strings.rangeReversed],
      validationDetails: { ...VALID_VALIDITY_STATE, rangeUnderflow: true, rangeOverflow: true, valid: false },
    });
  }
  return result;
}

const DEFAULT_FIELD_OPTIONS: FieldOptions = { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" };
const TWO_DIGIT_FIELD_OPTIONS: FieldOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" };

export function getFormatOptions(fieldOptions: FieldOptions, options: FormatterOptions): Intl.DateTimeFormatOptions {
  const defaultFieldOptions = options.shouldForceLeadingZeros ? TWO_DIGIT_FIELD_OPTIONS : DEFAULT_FIELD_OPTIONS;
  fieldOptions = { ...defaultFieldOptions, ...fieldOptions };
  const granularity = options.granularity || "minute";
  const keys = Object.keys(fieldOptions);
  let startIdx = keys.indexOf(options.maxGranularity ?? "year");
  if (startIdx < 0) startIdx = 0;
  let endIdx = keys.indexOf(granularity);
  if (endIdx < 0) endIdx = 2;
  if (startIdx > endIdx) throw new Error("maxGranularity must be greater than granularity");
  const opts: Intl.DateTimeFormatOptions = keys.slice(startIdx, endIdx + 1).reduce((opts, key) => {
    (opts as Record<string, unknown>)[key] = fieldOptions[key as keyof FieldOptions];
    return opts;
  }, {} as Intl.DateTimeFormatOptions);
  if (options.hourCycle != null) opts.hour12 = options.hourCycle === 12;
  opts.timeZone = options.timeZone || "UTC";
  const hasTime = granularity === "hour" || granularity === "minute" || granularity === "second";
  if (hasTime && options.timeZone && !options.hideTimeZone) opts.timeZoneName = "short";
  if (options.showEra && startIdx === 0) opts.era = "short";
  return opts;
}

export function getPlaceholderTime(placeholderValue: DateValue | null | undefined): TimeValue {
  if (placeholderValue && "hour" in placeholderValue) return placeholderValue;
  return new Time();
}

export function convertValue(value: DateValue | null | undefined, calendar: Calendar): DateValue | null | undefined {
  if (value === null) return null;
  if (!value) return undefined;
  return toCalendar(value, calendar);
}

export function createPlaceholderDate(
  placeholderValue: DateValue | null | undefined,
  granularity: string,
  calendar: Calendar,
  timeZone: string | undefined,
): DateValue {
  if (placeholderValue) return convertValue(placeholderValue, calendar)!;
  const date = toCalendar(now(timeZone ?? getLocalTimeZone()).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }), calendar);
  if (granularity === "year" || granularity === "month" || granularity === "day") return toCalendarDate(date);
  if (!timeZone) return toCalendarDateTime(date);
  return date;
}

/** Granularity / time zone kept from the last non-null value (`useDefaultProps` state). */
export interface LastFormat {
  granularity: Granularity;
  timeZone: string | null;
}

/** `useDefaultProps`: default granularity and time zone from the value; when it is null, the last ones. */
export function defaultProps(v: DateValue | null, granularity: Granularity | undefined, last: LastFormat): [Granularity, string | undefined] {
  const defaultTimeZone = v && "timeZone" in v ? v.timeZone : undefined;
  const defaultGranularity: Granularity = v && "minute" in v ? "minute" : "day";
  // props.granularity must actually exist in the value if one is provided.
  if (v && granularity && !(granularity in v)) throw new Error("Invalid granularity " + granularity + " for value " + v.toString());
  if (!granularity) granularity = v ? defaultGranularity : last.granularity;
  const timeZone = v ? defaultTimeZone : (last.timeZone ?? undefined);
  return [granularity, timeZone];
}

/** The `LastFormat` of a non-null value. */
export const lastFormatOf = (v: DateValue): LastFormat => ({ granularity: "minute" in v ? "minute" : "day", timeZone: "timeZone" in v ? v.timeZone : null });

/** Record the format of `v` (React's `setLastValue` during render). */
export function noteLast(last: Signal<LastFormat>, v: DateValue | null): void {
  if (!v) return;
  const next = lastFormatOf(v),
    prev = untrack(last);
  if (prev.granularity !== next.granularity || prev.timeZone !== next.timeZone) last.set(next);
}

export const parseValue = (text: DateValueString | null | undefined): DateValue | null => (text ? (parseDateValue(text) as DateValue) : null);
export const parseInput = (value: DateInput | null | undefined): DateValue | null =>
  value == null ? null : typeof value === "string" ? parseValue(value) : value;

// ---------------------------------------------------------------------------------------------
// IncompleteDate.ts

export type HourCycle = "h12" | "h11" | "h23" | "h24";

/** Plain fields of an `IncompleteDate` (what the display signal stores). */
export interface IncompleteFields {
  era: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
  hour: number | null;
  dayPeriod: number | null;
  minute: number | null;
  second: number | null;
  millisecond: number | null;
  offset: number | null;
}

type DateFieldKey = "era" | "year" | "month" | "day" | "hour" | "dayPeriod" | "minute" | "second";

/**
 * This class represents a date that is incomplete or otherwise invalid as a result of user editing.
 * For example, it can represent temporary dates such as February 31st if the user edits the day
 * before the month. Times are represented according to an hour cycle rather than always in 24 hour
 * time. This enables the user to adjust the day period (e.g. am/pm) independently from the hour.
 */
export class IncompleteDate {
  calendar: Calendar;
  era: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
  hour: number | null;
  hourCycle: HourCycle;
  dayPeriod: number | null;
  minute: number | null;
  second: number | null;
  millisecond: number | null;
  offset: number | null;

  constructor(calendar: Calendar, hourCycle: HourCycle, dateValue?: Partial<Record<string, unknown>> | null) {
    const d = (dateValue ?? {}) as Partial<IncompleteFields>;
    this.era = d.era ?? null;
    this.calendar = calendar;
    this.year = d.year ?? null;
    this.month = d.month ?? null;
    this.day = d.day ?? null;
    this.hour = d.hour ?? null;
    this.hourCycle = hourCycle;
    this.dayPeriod = null;
    this.minute = d.minute ?? null;
    this.second = d.second ?? null;
    this.millisecond = d.millisecond ?? null;
    this.offset = "offset" in (dateValue ?? {}) ? ((dateValue as { offset: number }).offset ?? null) : null;
    // Convert the hour from 24 hour time to the given hour cycle.
    if (this.hour != null) {
      const [dayPeriod, hour] = toHourCycle(this.hour, hourCycle);
      this.dayPeriod = dayPeriod;
      this.hour = hour;
    }
  }

  /** Rivet: restore from plain fields (no hour cycle conversion). */
  static fromFields(calendar: Calendar, hourCycle: HourCycle, fields: IncompleteFields): IncompleteDate {
    const res = new IncompleteDate(calendar, hourCycle);
    Object.assign(res, fields);
    return res;
  }

  /** Rivet: the plain fields (JSON for the display signal). */
  toFields(): IncompleteFields {
    const { era, year, month, day, hour, dayPeriod, minute, second, millisecond, offset } = this;
    return { era, year, month, day, hour, dayPeriod, minute, second, millisecond, offset };
  }

  copy(): IncompleteDate {
    return IncompleteDate.fromFields(this.calendar, this.hourCycle, this.toFields());
  }

  /** Checks whether all the specified segments have a value. */
  isComplete(segments: DateSegmentType[]): boolean {
    return segments.every((segment) => this[segment as DateFieldKey] != null);
  }

  /** Checks whether the given date value matches this value for the specified segments. */
  validate(dt: DateValue, segments: DateSegmentType[]): boolean {
    return segments.every((segment) => {
      if ((segment === "hour" || segment === "dayPeriod") && "hour" in dt) {
        const [dayPeriod, hour] = toHourCycle(dt.hour, this.hourCycle);
        return this.dayPeriod === dayPeriod && this.hour === hour;
      }
      return this[segment as DateFieldKey] === (dt as unknown as Record<string, unknown>)[segment];
    });
  }

  /** Checks if the date is empty (i.e. all specified segments are null). */
  isCleared(segments: DateSegmentType[]): boolean {
    return segments.every((segment) => this[segment as DateFieldKey] === null);
  }

  /** Sets the given field. */
  set(field: DateSegmentType, value: number | string, placeholder: DateValue): IncompleteDate {
    const result = this.copy();
    (result as unknown as Record<string, unknown>)[field] = value;
    if (field === "hour" && result.dayPeriod == null && "hour" in placeholder) result.dayPeriod = toHourCycle(placeholder.hour, this.hourCycle)[0];
    if (field === "year" && result.era == null) result.era = placeholder.era;
    // clear offset when a date/time field changes since it may no longer be valid
    if (field !== "second" && field !== "literal" && field !== "timeZoneName") result.offset = null;
    return result;
  }

  /** Sets the given field to null. */
  clear(field: DateSegmentType): IncompleteDate {
    const result = this.copy();
    (result as unknown as Record<string, unknown>)[field] = null;
    if (field === "year") result.era = null;
    // clear offset when a field is cleared since it may no longer be valid
    result.offset = null;
    return result;
  }

  /**
   * Increments or decrements the given field. If it is null, then it is set to the placeholder
   * value.
   */
  cycle(field: DateSegmentType, amount: number, placeholder: DateValue, displaySegments: DateSegmentType[]): IncompleteDate {
    const res = this.copy();
    // If field is null, default to placeholder.
    if (res[field as DateFieldKey] == null && field !== "dayPeriod" && field !== "era") {
      if (field === "hour" && "hour" in placeholder) {
        const [dayPeriod, hour] = toHourCycle(placeholder.hour, this.hourCycle);
        res.dayPeriod = dayPeriod;
        res.hour = hour;
      } else {
        (res as unknown as Record<string, unknown>)[field] = (placeholder as unknown as Record<string, unknown>)[field];
      }
      if (field === "year" && res.era == null) res.era = placeholder.era;
      return res;
    }
    switch (field) {
      case "era": {
        const eras = this.calendar.getEras();
        let index = eras.indexOf(res.era!);
        index = cycleValue(index, amount, 0, eras.length - 1);
        res.era = eras[index]!;
        break;
      }
      case "year": {
        // Use CalendarDate to cycle so that we update the era when going between 1 AD and 1 BC.
        let date = new CalendarDate(this.calendar, this.era ?? placeholder.era, this.year ?? placeholder.year, this.month ?? 1, this.day ?? 1);
        date = date.cycle(field, amount, { round: field === "year" });
        res.era = date.era;
        res.year = date.year;
        break;
      }
      case "month":
        res.month = cycleValue(res.month ?? 1, amount, 1, this.calendar.getMaximumMonthsInYear());
        break;
      case "day":
        // Allow incrementing up to the maximum number of days in any month.
        res.day = cycleValue(res.day ?? 1, amount, 1, this.calendar.getMaximumDaysInMonth());
        break;
      case "hour": {
        // if date is fully defined or it is just a time field, and we have a time zone, use toValue to get a ZonedDateTime to cycle
        // so DST fallback is properly handled
        const hasDateSegements = displaySegments.some((s) => ["year", "month", "day"].includes(s));
        if ("timeZone" in placeholder && (!hasDateSegements || (res.year != null && res.month != null && res.day != null))) {
          let date = this.toValue(placeholder) as ZonedDateTime;
          date = date.cycle("hour", amount, { hourCycle: this.hourCycle === "h12" ? 12 : 24, round: false });
          const [dayPeriod, adjustedHour] = toHourCycle(date.hour, this.hourCycle);
          res.hour = adjustedHour;
          res.dayPeriod = dayPeriod;
          res.offset = date.offset;
        } else {
          const hours = res.hour ?? 0;
          const limits = this.getSegmentLimits("hour")!;
          res.hour = cycleValue(hours, amount, limits.minValue, limits.maxValue);
          if (res.dayPeriod == null && "hour" in placeholder) res.dayPeriod = toHourCycle(placeholder.hour, this.hourCycle)[0];
        }
        break;
      }
      case "dayPeriod":
        res.dayPeriod = cycleValue(res.dayPeriod ?? 0, amount, 0, 1);
        break;
      case "minute":
        res.minute = cycleValue(res.minute ?? 0, amount, 0, 59, true);
        break;
      case "second":
        res.second = cycleValue(res.second ?? 0, amount, 0, 59, true);
        break;
    }
    return res;
  }

  /**
   * Converts the incomplete date to a full date value, using the provided value for any unset
   * fields.
   */
  toValue(value: DateValue): DateValue {
    if ("hour" in value) {
      let hour = this.hour;
      if (hour != null) hour = fromHourCycle(hour, this.dayPeriod ?? 0, this.hourCycle);
      else if (this.hourCycle === "h12" || this.hourCycle === "h11") hour = this.dayPeriod === 1 ? 12 : 0;
      let res = (value as CalendarDateTime).set({
        era: this.era ?? value.era,
        year: this.year ?? value.year,
        month: this.month ?? value.month,
        day: this.day ?? value.day,
        hour: hour ?? value.hour,
        minute: this.minute ?? value.minute,
        second: this.second ?? value.second,
        millisecond: this.millisecond ?? value.millisecond,
      }) as CalendarDateTime | ZonedDateTime;
      if ("offset" in res && this.offset != null && res.offset !== this.offset) res = res.add({ milliseconds: res.offset - this.offset });
      return res;
    }
    return value.set({ era: this.era ?? value.era, year: this.year ?? value.year, month: this.month ?? value.month, day: this.day ?? value.day });
  }

  getSegmentLimits(type: string): { value: number | null; minValue: number; maxValue: number } | undefined {
    switch (type) {
      case "era": {
        const eras = this.calendar.getEras();
        return { value: this.era != null ? eras.indexOf(this.era) : eras.length - 1, minValue: 0, maxValue: eras.length - 1 };
      }
      case "year":
        return { value: this.year, minValue: 1, maxValue: 9999 };
      case "month":
        return { value: this.month, minValue: 1, maxValue: this.calendar.getMaximumMonthsInYear() };
      case "day":
        return { value: this.day, minValue: 1, maxValue: this.calendar.getMaximumDaysInMonth() };
      case "dayPeriod":
        return { value: this.dayPeriod, minValue: 0, maxValue: 1 };
      case "hour": {
        let minValue = 0;
        let maxValue = 23;
        if (this.hourCycle === "h12") {
          minValue = 1;
          maxValue = 12;
        } else if (this.hourCycle === "h11") {
          minValue = 0;
          maxValue = 11;
        }
        return { value: this.hour, minValue, maxValue };
      }
      case "minute":
        return { value: this.minute, minValue: 0, maxValue: 59 };
      case "second":
        return { value: this.second, minValue: 0, maxValue: 59 };
    }
    return undefined;
  }
}

function cycleValue(value: number, amount: number, min: number, max: number, round = false): number {
  if (round) {
    value += Math.sign(amount);
    if (value < min) value = max;
    const div = Math.abs(amount);
    if (amount > 0) value = Math.ceil(value / div) * div;
    else value = Math.floor(value / div) * div;
    if (value > max) value = min;
  } else {
    value += amount;
    if (value < min) value = max - (min - value - 1);
    else if (value > max) value = min + (value - max - 1);
  }
  return value;
}

function toHourCycle(hour: number, hourCycle: HourCycle): [number | null, number] {
  let dayPeriod: number | null = hour >= 12 ? 1 : 0;
  switch (hourCycle) {
    case "h11":
      // Hours are numbered from 0 to 11. Used in Japan.
      if (hour >= 12) hour -= 12;
      break;
    case "h12":
      // Hours are numbered from 12 (representing 0) to 11.
      if (hour === 0) hour = 12;
      else if (hour > 12) hour -= 12;
      break;
    case "h23":
      // 24 hour time, numbered 0 to 23.
      dayPeriod = null;
      break;
    case "h24":
      // 24 hour time numbered 24 to 23. Unused but supported by Intl.DateTimeFormat.
      hour += 1;
      dayPeriod = null;
  }
  return [dayPeriod, hour];
}

function fromHourCycle(hour: number, dayPeriod: number, hourCycle: HourCycle): number {
  switch (hourCycle) {
    case "h11":
      if (dayPeriod === 1) hour += 12;
      break;
    case "h12":
      if (hour === 12) hour = 0;
      if (dayPeriod === 1) hour += 12;
      break;
    case "h24":
      hour -= 1;
      break;
  }
  return hour;
}

// ---------------------------------------------------------------------------------------------
// Value owners: a standalone field owns its value + validation; a picker field uses the picker's.

/** A DateRangePicker's value: the committed complete range plus the partial one its fields edit. */
export interface RangeModel {
  /** Committed value (complete range, or null). */
  readonly value: Signal<RangeValue<DateValueString> | null>;
  /** The placeholder range the fields edit (React Stately `placeholderValue` state). */
  readonly partial: Signal<RangeValue<DateValueString | null>>;
  readonly onChange?: ((value: RangeValue<DateValue> | null) => void) | undefined;
}

/** The effective range (`controlledValue || placeholderValue`; a stale complete placeholder resets). */
export function rangeValueOf(model: RangeModel): RangeValue<DateValueString | null> {
  const committed = model.value();
  if (committed) return committed;
  const partial = model.partial();
  // Reset the placeholder if the value prop is set to null.
  return partial.start && partial.end ? { start: null, end: null } : partial;
}

export const isCompleteRange = <T>(value: RangeValue<T | null> | null | undefined): value is RangeValue<T> => value?.start != null && value.end != null;

/** A value cell the state may write: a Signal (two-way / internal). A read-only accessor (live controlled `value`) is
 *  never written: a change only calls `onChange`. */
export const isWritable = (cell: unknown): cell is { set(value: unknown): void } => typeof (cell as { set?: unknown }).set === "function";

/** React Stately `useDateRangePickerState` `setValue`: keeps the partial range, commits complete ones. */
export function writeRange(model: RangeModel, newValue: RangeValue<DateValue | null> | null): void {
  const value = newValue || { start: null, end: null };
  const partial = { start: stringifyDateValue(value.start), end: stringifyDateValue(value.end) };
  model.partial.set(partial);
  const before = untrack(model.value);
  if (isCompleteRange(value)) {
    const next = partial as RangeValue<DateValueString>;
    if (!before || before.start !== next.start || before.end !== next.end) {
      if (isWritable(model.value)) model.value.set(next);
      model.onChange?.(value);
    }
  } else if (before !== null) {
    if (isWritable(model.value)) model.value.set(null);
    model.onChange?.(null);
  }
}

/** Common props of a field / picker (formatting + built-in validation). */
export interface DateOwnerBase {
  readonly locale: string;
  readonly minValue: DateValueString | null;
  readonly maxValue: DateValueString | null;
  readonly placeholderValue: DateValueString | null;
  readonly granularityProp?: Granularity | undefined;
  readonly hourCycleProp?: 12 | 24 | undefined;
  readonly hideTimeZone?: boolean | undefined;
  readonly shouldForceLeadingZeros?: boolean | undefined;
  /** Flags at creation; read `ownerDisabled` / `ownerReadOnly` / `ownerRequired` (follow a live accessor). */
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly isRequired: boolean;
  /** Live `isDisabled` / `isReadOnly` / `isRequired` accessors (live props P5; created by the component). */
  readonly disabled?: (() => boolean | undefined) | undefined;
  readonly readOnly?: (() => boolean | undefined) | undefined;
  readonly required?: (() => boolean | undefined) | undefined;
  /** Format of the last non-null value (`useDefaultProps`). */
  readonly last: Signal<LastFormat>;
  /**
   * Client validation (`validate`, run on the date value) merged before the built-in one (min / max /
   * unavailable), refreshed on writes. Rivet: the user's `validate` runs here, not in the form
   * validation state, so it receives date objects while the state stays plain data.
   */
  readonly builtin: Signal<ValidationResult>;
  /** Custom client validation (`validate`): gets the value as date object(s). */
  readonly validate?: ValidationFunction<never> | undefined;
  readonly validation: FormValidationState;
}

/** A single value owner: a standalone DateField / TimeField or a DatePicker. */
export interface DateValueOwner extends DateOwnerBase {
  /** `time`: a TimeField (`value` holds a `TimeValue` string; the field edits it as a date-time). */
  readonly kind: "field" | "picker" | "time";
  readonly value: Signal<DateValueString | null>;
  readonly onChange?: ((value: never) => void) | undefined;
  readonly isDateUnavailable?: ((date: DateValue) => boolean) | undefined;
  /** TimeField: the time zone of `defaultValue` (useTimeFieldState `defaultValueTimeZone`). */
  readonly defaultTimeZone?: string | undefined;
}

/** A DateRangePicker (range value owner). */
export interface DateRangeOwner extends DateOwnerBase, RangeModel {
  readonly kind: "range";
  readonly isDateUnavailable?: ((date: DateValue, anchorDate: CalendarDate | null) => boolean) | undefined;
  /** Native validity of the start / end fields' inputs (React Aria's per-field validation refs). */
  readonly partValidity: Signal<RangeValue<ValidationResult>>;
}

export type DateOwner = DateValueOwner | DateRangeOwner;

/** Whether the field / picker is disabled now (its live `isDisabled` accessor, else the creation value). Reads. */
export const ownerDisabled = (owner: DateOwnerBase): boolean => (owner.disabled ? !!owner.disabled() : owner.isDisabled);
/** Whether the field / picker is read-only now. Reads. */
export const ownerReadOnly = (owner: DateOwnerBase): boolean => (owner.readOnly ? !!owner.readOnly() : owner.isReadOnly);
/** Whether the field / picker is required now. Reads. */
export const ownerRequired = (owner: DateOwnerBase): boolean => (owner.required ? !!owner.required() : owner.isRequired);

// useTimeFieldState.ts helpers ----------------------------------------------------------------

const parseTimeValue = (text: DateValueString | null | undefined): TimeValue | null => (text ? (parseDateValue(text) as TimeValue) : null);

/** useTimeFieldState `convertValue`: a `Time` as the date-time on `date` (default today); date-times unchanged. */
export function timeAsDateTime(value: TimeValue | null | undefined, date?: DateValue): DateValue | null {
  if (!value) return null;
  if ("day" in value) return value;
  return toCalendarDateTime(date ?? today(getLocalTimeZone()), value);
}

/** The owner's value as a date value string (a TimeField's `Time` becomes today's date-time). Reads. */
export function ownerValueString(owner: DateValueOwner): DateValueString | null {
  const text = owner.value();
  if (owner.kind !== "time" || !text) return text;
  const value = parseTimeValue(text)!;
  return "day" in value ? text : stringifyDateValue(timeAsDateTime(value));
}

/** TimeField: the date of its value (or placeholder) when it has one (useTimeFieldState `day`). */
function timeDay(owner: DateValueOwner): DateValue | undefined {
  const v = parseTimeValue(owner.value()) || parseTimeValue(owner.placeholderValue);
  return v && "day" in v ? v : undefined;
}

/** The placeholder date of an owner (TimeField: placeholder time, default midnight, on today, zoned like the value). Reads. */
export function ownerPlaceholder(owner: DateOwner): DateValue | null {
  if (owner.kind !== "time") return parseValue(owner.placeholderValue);
  const v = parseTimeValue(owner.value()) || parseTimeValue(owner.placeholderValue);
  const timeZone = (v && "timeZone" in v ? v.timeZone : undefined) || owner.defaultTimeZone;
  const placeholder = timeAsDateTime(parseTimeValue(owner.placeholderValue) ?? new Time())!;
  return timeZone ? toZoned(placeholder, timeZone) : placeholder;
}

/** min / max of an owner (TimeField: a `Time` bound on the value's date, else today). Reads. */
function ownerBound(owner: DateOwner, text: DateValueString | null): DateValue | null {
  if (owner.kind !== "time") return parseValue(text);
  return timeAsDateTime(parseTimeValue(text), timeDay(owner));
}

/** The value `validate` and `onChange` get: the owner's committed value as date object(s). Reads. */
function ownerUserValue(owner: DateOwner): unknown {
  if (owner.kind === "range") {
    const range = owner.value();
    return range ? { start: parseValue(range.start), end: parseValue(range.end) } : null;
  }
  return owner.kind === "time" ? parseTimeValue(owner.value()) : parseValue(owner.value());
}

/** Formatter options of an owner for its current value (validation messages, `formatValue`). */
export function ownerFormat(owner: DateOwner): FormatterOptions {
  let v: DateValue | null, showEra: boolean;
  if (owner.kind === "range") {
    const range = rangeValueOf(owner);
    const start = parseValue(range.start),
      end = parseValue(range.end);
    v = start || end || ownerPlaceholder(owner);
    showEra = (start?.calendar.identifier === "gregory" && start.era === "BC") || (end?.calendar.identifier === "gregory" && end.era === "BC");
  } else {
    const value = parseValue(ownerValueString(owner));
    v = value || ownerPlaceholder(owner);
    showEra = value?.calendar.identifier === "gregory" && value.era === "BC";
  }
  const [granularity, timeZone] = defaultProps(v, owner.granularityProp, owner.last());
  return {
    granularity,
    // useDateFieldState formatOpts: a field's maxGranularity (TimeField "hour": messages name the time only); pickers have none.
    ...(owner.kind === "picker" || owner.kind === "range" ? {} : { maxGranularity: (owner as StandaloneDateFieldState).maxGranularity }),
    timeZone,
    hideTimeZone: owner.hideTimeZone,
    hourCycle: owner.hourCycleProp,
    shouldForceLeadingZeros: owner.shouldForceLeadingZeros,
    showEra,
  };
}

/** Built-in validation of the owner's current value. Reads the value. */
export function builtinValidation(owner: DateOwner): ValidationResult {
  // useFormValidationState order: client (`validate`) errors win over the built-in ones.
  if (owner.validate) {
    const value = ownerUserValue(owner);
    const custom = value == null ? null : customValidationResult(runValidate(owner.validate as ValidationFunction<unknown>, value));
    if (custom) return custom;
  }
  const min = ownerBound(owner, owner.minValue),
    max = ownerBound(owner, owner.maxValue);
  if (owner.kind === "range") {
    const range = rangeValueOf(owner);
    const unavailable = owner.isDateUnavailable;
    return getRangeValidationResult(
      { start: parseValue(range.start), end: parseValue(range.end) },
      min,
      max,
      unavailable ? (date) => unavailable(date, null) : undefined,
      ownerFormat(owner),
    );
  }
  return getValidationResult(parseValue(ownerValueString(owner)), min, max, owner.isDateUnavailable, ownerFormat(owner));
}

/** Refresh the built-in validation signal (after a write, or before validity is synced). */
export function syncBuiltin(owner: DateOwner): void {
  const next = untrack(() => builtinValidation(owner));
  if (!isEqualValidation(untrack(owner.builtin), next)) owner.builtin.set(next);
}

/** Owner validation displayed (aria-invalid, data-invalid, error message). Reads. */
export const ownerDisplayValidation = (owner: DateOwner): ValidationResult => displayValidation(owner.validation);

// ---------------------------------------------------------------------------------------------
// useDateFieldState.ts

const EDITABLE_SEGMENTS: Partial<Record<string, boolean>> = {
  year: true,
  month: true,
  day: true,
  hour: true,
  minute: true,
  second: true,
  dayPeriod: true,
  era: true,
};
const PAGE_STEP: Partial<Record<string, number>> = { year: 5, month: 2, day: 7, hour: 2, minute: 15, second: 15 };
const TYPE_MAPPING: Partial<Record<string, string>> = {
  // Node seems to convert everything to lowercase...
  dayperiod: "dayPeriod",
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts#named_years
  relatedYear: "year",
  yearName: "literal", // not editable
  unknown: "literal",
};

export interface DateFieldBaseOptions {
  /** The minimum allowed date that a user may select. */
  minValue?: DateInput | null;
  /** The maximum allowed date that a user may select. */
  maxValue?: DateInput | null;
  /** A placeholder date that influences the format of the placeholder shown when no value is selected. Defaults to today's date at midnight. */
  placeholderValue?: DateInput | null;
  /** Whether to display the time in 12 or 24 hour format. By default, this is determined by the user's locale. */
  hourCycle?: 12 | 24;
  /** Determines the smallest unit that is displayed in the date picker. By default, this is `"day"` for dates, and `"minute"` for times. */
  granularity?: Granularity;
  /** Whether to hide the time zone abbreviation. */
  hideTimeZone?: boolean;
  /** Whether to always show leading zeros in the month, day, and hour fields. By default, this is determined by the user's locale. */
  shouldForceLeadingZeros?: boolean;
  /** Whether the field is disabled; an accessor stays live (`ownerDisabled`). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** Whether the value is immutable; an accessor stays live (`ownerReadOnly`). */
  isReadOnly?: boolean | (() => boolean | undefined);
  /** Whether a value is required; an accessor stays live (`ownerRequired`). */
  isRequired?: boolean | (() => boolean | undefined);
  /** Controlled invalid state; an accessor stays live. */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  /** @deprecated Use `isInvalid` instead. */
  validationState?: "valid" | "invalid";
  /** `native` (default for the components) or `aria`. */
  validationBehavior?: ValidationBehavior;
  /** Form field name (server errors of `<Form validationErrors>` apply by it). */
  name?: string;
  /** Server errors (from `<Form>` context, or passed directly). */
  validationErrors?: MaybeAccessor<ValidationErrors | undefined>;
  /** The locale to display and edit the value according to (default: the enclosing `I18nProvider`'s, `useLocale()`). */
  locale?: string;
  /** Creates the display calendar system for an identifier (default: `createCalendar` of `@rivetjs/cdk/date`). */
  createCalendar?: (identifier: CalendarIdentifier) => Calendar;
}

/**
 * A controlled date prop: a date (or its string form), a two-way signal of the string form (resumable), or a
 * read-only accessor of the string form (live props: `date-field/live-value.tsx` `liveDateValue`; never written).
 */
export type DateValueProp<T> = T | DateValueString | null | Signal<DateValueString | null> | (() => DateValueString | null);

/** A value prop as the state's value signal: the caller's signal (two-way), or one starting at the plain value / default. */
export function dateValueSignal<T extends DateValue | TimeValue>(
  value: DateValueProp<T> | undefined,
  defaultValue: T | DateValueString | null | undefined,
): Signal<DateValueString | null> {
  if (typeof value === "function") return controllable(value as Signal<DateValueString | null>, null);
  return controllable(undefined, toDateValueString(value !== undefined ? value : defaultValue));
}

export interface DateFieldStateOptions<T extends DateValue = DateValue> extends DateFieldBaseOptions {
  /** Controlled value: a date, or a two-way signal of its string form. */
  value?: DateValueProp<T>;
  /** Uncontrolled initial value. */
  defaultValue?: T | DateValueString | null;
  /** Called with the new value (date object, in the calendar of the original value). */
  onChange?: (value: MappedDateValue<T> | null) => void;
  /** Callback that is called for each date of the calendar. If it returns true, then the date is unavailable. */
  isDateUnavailable?: (date: DateValue) => boolean;
  /** Custom client validation of the value (a date object). */
  validate?: ValidationFunction<MappedDateValue<T>>;
  /** The maximum unit to display in the date field. @default 'year' */
  maxGranularity?: "year" | "month" | Granularity;
  id?: string;
}

/** Where a picker's field reads and writes its value (React Aria's `fieldProps` of useDatePicker / useDateRangePicker). */
export type DateFieldOwnerLink = { owner: DateValueOwner } | { owner: DateRangeOwner; part: "start" | "end" };

export interface DateFieldState {
  readonly id: string;
  readonly locale: string;
  /** Display calendar system identifier (from the locale). */
  readonly calendar: CalendarIdentifier;
  readonly createCalendar?: (identifier: CalendarIdentifier) => Calendar;
  /** Resolved hour cycle of the locale (and `hourCycle` prop). */
  readonly hourCycle: HourCycle;
  readonly maxGranularity: "year" | "month" | Granularity;
  /** The owner of the value: its picker (absent: a standalone field owns its value). */
  readonly owner?: DateOwner;
  /** Range picker field: which end it edits. */
  readonly part?: "start" | "end";
  /** Field default value (`defaultValue ?? initial value`; form reset). */
  readonly defaultValue: DateValueString | null;
  /** Temporary display override while editing (plain IncompleteDate fields + the value it was based on). */
  readonly display: Signal<{ base: DateValueString | null; fields: IncompleteFields } | null>;
  /**
   * Rivet: React Aria's `hookData` (useDateField → useDateSegment): the field's labelling, set by
   * `dateFieldProps` (`describedBy` is an accessor read by the first segment's binding).
   */
  /**
   * React Aria `hookData`: the field's labelling the segments read. Plain data only (no closure over the state:
   * the state would reference itself, a cycle the resume format rejects).
   */
  aria?: {
    label?: string | undefined;
    /** The user's `aria-labelledby`; a picker's field gets the picker's (an accessor: the picker label slot settles after mount). */
    ownLabelledBy?: string | (() => string | undefined) | undefined;
    hasLabel?: (() => boolean) | boolean | undefined;
    descriptionId?: SlotId | undefined;
    errorId?: SlotId | undefined;
    /** The user's `aria-describedby`; a picker's field gets the picker's (an accessor, RA `fieldProps['aria-describedby']`). */
    extraDescribedBy?: string | (() => string | undefined) | undefined;
    /** A picker's field (`role="presentation"`): described only by `extraDescribedBy` (RA useDateField `roleSymbol`). */
    presentation?: boolean | undefined;
  };
}

/** A standalone DateField (its own value owner). */
export interface StandaloneDateFieldState extends DateFieldState, DateValueOwner {}

function resolveCalendar(
  locale: string,
  hourCycle: 12 | 24 | undefined,
  create?: (id: CalendarIdentifier) => Calendar,
): { calendar: CalendarIdentifier; hourCycle: HourCycle } {
  // Resolve default hour cycle and calendar system. Pure per (locale, hour cycle) with the default calendar factory:
  // memoised (an `Intl.DateTimeFormat` per field state was ~3% of a DatePicker mount, HOTPATH 2026-10-09).
  const memo = create === undefined ? locale + "|" + hourCycle : null;
  let resolved = memo === null ? undefined : calendars.get(memo);
  if (resolved === undefined) {
    const formatter = new DateFormatter(locale, { dateStyle: "short", timeStyle: "short", hour12: hourCycle != null ? hourCycle === 12 : undefined });
    const opts = formatter.resolvedOptions();
    resolved = [(create ?? createAnyCalendar)(opts.calendar as CalendarIdentifier).identifier, opts.hourCycle! as HourCycle];
    if (memo !== null) {
      if (calendars.size >= 256) calendars.clear();
      calendars.set(memo, resolved);
    }
  }
  return { calendar: resolved[0], hourCycle: resolved[1] };
}
const calendars = new Map<string, readonly [CalendarIdentifier, HourCycle]>();

// `formatter.resolvedOptions()` per formatter (a fresh native object per call; the formatters are cached and their
// options fixed): read-only callers inside the cdk share one (segments, segment ARIA text / style).
const resolvedCache = new WeakMap<DateFormatter, Intl.ResolvedDateTimeFormatOptions>();
/** @internal Read-only `resolvedOptions()` of a (cached) formatter: never mutate the result. */
export function resolvedOptionsOf(formatter: DateFormatter): Intl.ResolvedDateTimeFormatOptions {
  let options = resolvedCache.get(formatter);
  if (options === undefined) resolvedCache.set(formatter, (options = formatter.resolvedOptions()));
  return options;
}

/** Owner fields shared by DateField / DatePicker / DateRangePicker state. */
export function ownerBase(
  options: DateFieldBaseOptions,
  v: DateValue | null,
  locale: string,
): Omit<DateOwnerBase, "builtin" | "validation"> & { builtin: Signal<ValidationResult> } {
  const { isDisabled: disabled, isReadOnly: readOnly, isRequired: required } = options;
  return {
    locale,
    minValue: toDateValueString(options.minValue),
    maxValue: toDateValueString(options.maxValue),
    placeholderValue: toDateValueString(options.placeholderValue),
    ...(options.granularity ? { granularityProp: options.granularity } : {}),
    ...(options.hourCycle ? { hourCycleProp: options.hourCycle } : {}),
    ...(options.hideTimeZone ? { hideTimeZone: true } : {}),
    ...(options.shouldForceLeadingZeros ? { shouldForceLeadingZeros: true } : {}),
    // Live props: an accessor flag is stored as is (created by the component, resumable) and read at use
    // (`ownerDisabled` / `ownerReadOnly` / `ownerRequired`); `isX` keeps the value at creation.
    isDisabled: typeof disabled === "function" ? !!untrack(disabled) : (disabled ?? false),
    isReadOnly: typeof readOnly === "function" ? !!untrack(readOnly) : (readOnly ?? false),
    isRequired: typeof required === "function" ? !!untrack(required) : (required ?? false),
    ...(typeof disabled === "function" ? { disabled } : {}),
    ...(typeof readOnly === "function" ? { readOnly } : {}),
    ...(typeof required === "function" ? { required } : {}),
    last: signal<LastFormat>(v ? lastFormatOf(v) : { granularity: "day", timeZone: null }),
    builtin: signal<ValidationResult>(VALID_VALIDITY_RESULT),
  };
}

const VALID_VALIDITY_RESULT: ValidationResult = { isInvalid: false, validationErrors: [], validationDetails: VALID_VALIDITY_STATE };

/**
 * `useDateFieldState`: state of a standalone DateField (its own value + validation). Pickers
 * create their fields with `createPickerFieldState`.
 */
export function createDateFieldState<T extends DateValue = DateValue>(options: DateFieldStateOptions<T> = {}): StandaloneDateFieldState {
  const value = dateValueSignal(options.value, options.defaultValue);
  return fieldState(options as DateFieldStateOptions, value, "field");
}

/** @internal A standalone field state (DateField, or TimeField with `kind: "time"`) over its value signal. */
export function fieldState(
  options: Omit<DateFieldStateOptions, "value" | "validate" | "onChange"> & { validate?: unknown; onChange?: unknown; defaultTimeZone?: string },
  value: Signal<DateValueString | null>,
  kind: "field" | "time",
): StandaloneDateFieldState {
  const locale = resolveLocale(options.locale);
  const initial = untrack(value);
  const time = kind === "time";
  const parse = (text: DateValueString | null | undefined) => (time ? timeAsDateTime(parseTimeValue(text)) : parseValue(text));
  const v = parse(initial) || parse(toDateValueString(options.defaultValue)) || parse(toDateValueString(options.placeholderValue));
  // props.granularity must actually exist in the value if one is provided.
  defaultProps(v, options.granularity, { granularity: "day", timeZone: null });
  const base = ownerBase(options, v, locale);
  // TimeField (useTimeFieldState): the calendar should not matter for time fields, so it is Gregorian. Rivet: the
  // identifier only (no `createCalendar` function in the state: it would not serialize).
  const { calendar, hourCycle } = resolveCalendar(locale, options.hourCycle, time ? () => new GregorianCalendar() : options.createCalendar);
  const state: StandaloneDateFieldState = {
    ...base,
    kind,
    id: options.id ?? createId(),
    calendar,
    ...(options.createCalendar ? { createCalendar: options.createCalendar } : {}),
    hourCycle,
    maxGranularity: options.maxGranularity ?? "year",
    value,
    // TimeField: the date-time the field edits (useTimeFieldState `defaultDateTime`).
    defaultValue: time ? stringifyDateValue(parse(toDateValueString(options.defaultValue) ?? initial)) : (toDateValueString(options.defaultValue) ?? initial),
    display: signal<{ base: DateValueString | null; fields: IncompleteFields } | null>(null),
    ...(options.defaultTimeZone ? { defaultTimeZone: options.defaultTimeZone } : {}),
    ...(options.onChange ? { onChange: options.onChange as (value: never) => void } : {}),
    ...(options.isDateUnavailable ? { isDateUnavailable: options.isDateUnavailable } : {}),
    ...(options.validate ? { validate: options.validate as ValidationFunction<never> } : {}),
    validation: createFormValidationState({
      isInvalid: options.isInvalid,
      validationState: options.validationState,
      validationBehavior: options.validationBehavior ?? "aria",
      name: options.name,
      validationErrors: options.validationErrors,
      builtinValidation: base.builtin,
      value,
    }),
  };
  state.builtin.set(untrack(() => builtinValidation(state)));
  return state;
}

/** The field of a DatePicker (`link.owner`) or one end of a DateRangePicker (`link.part`). */
export function createPickerFieldState(
  link: DateFieldOwnerLink,
  options: {
    id: string;
    locale: string;
    maxGranularity?: "year" | "month" | Granularity;
    createCalendar?: (identifier: CalendarIdentifier) => Calendar;
    defaultValue: DateValueString | null;
  },
): DateFieldState {
  const { calendar, hourCycle } = resolveCalendar(options.locale, link.owner.hourCycleProp, options.createCalendar);
  return {
    id: options.id,
    locale: options.locale,
    calendar,
    ...(options.createCalendar ? { createCalendar: options.createCalendar } : {}),
    hourCycle,
    maxGranularity: options.maxGranularity ?? "year",
    owner: link.owner,
    ...("part" in link ? { part: link.part } : {}),
    defaultValue: options.defaultValue,
    display: signal<{ base: DateValueString | null; fields: IncompleteFields } | null>(null),
  };
}

// Accessors ------------------------------------------------------------------------------------

/** The value owner of a field: its picker, or the (standalone) field itself. */
export const ownerOf = (state: DateFieldState): DateOwner => state.owner ?? (state as StandaloneDateFieldState);

/** The display calendar system of the field. */
export function calendarOf(state: Pick<DateFieldState, "calendar" | "createCalendar">): Calendar {
  return (state.createCalendar ?? createAnyCalendar)(state.calendar);
}

/** The field's value (string form; owner calendar). Reads. */
export function fieldValueString(state: DateFieldState): DateValueString | null {
  const owner = ownerOf(state);
  if (owner.kind === "range") return rangeValueOf(owner)[state.part!];
  return ownerValueString(owner);
}

/** The value the emitted dates keep the calendar of (`props.value || props.defaultValue || props.placeholderValue`). */
function originalValue(state: DateFieldState): DateValue | null {
  return parseValue(fieldValueString(state)) || parseValue(state.defaultValue) || ownerPlaceholder(ownerOf(state));
}

/** `[granularity, defaultTimeZone]` of the field. Reads. */
function fieldDefaults(state: DateFieldState): [Granularity, string | undefined] {
  return defaultProps(originalValue(state), ownerOf(state).granularityProp, ownerOf(state).last());
}

/** The granularity for the field, based on the `granularity` prop and current value. Reads. */
export const fieldGranularity = (state: DateFieldState): Granularity => fieldDefaults(state)[0];

/** The current value in the display calendar (React Stately `state.value`). Reads. */
export function fieldValue(state: DateFieldState): DateValue | null {
  return convertValue(parseValue(fieldValueString(state)), calendarOf(state)) ?? null;
}

/** The current display value: the editing override when it belongs to the current value, else the value. Reads. */
export function displayValue(state: DateFieldState): IncompleteDate {
  const override = state.display(),
    current = fieldValueString(state);
  if (override && override.base === current) return IncompleteDate.fromFields(calendarOf(state), state.hourCycle, override.fields);
  return new IncompleteDate(calendarOf(state), state.hourCycle, fieldValue(state) as unknown as Record<string, unknown> | null);
}

function formatOpts(state: DateFieldState, display: IncompleteDate): FormatterOptions {
  const [granularity, defaultTimeZone] = fieldDefaults(state);
  return {
    granularity,
    maxGranularity: state.maxGranularity,
    timeZone: defaultTimeZone,
    hideTimeZone: ownerOf(state).hideTimeZone,
    hourCycle: ownerOf(state).hourCycleProp,
    showEra: state.calendar === "gregory" && display.era === "BC",
    shouldForceLeadingZeros: ownerOf(state).shouldForceLeadingZeros,
  };
}

/** The placeholder date used for unset segments (today at midnight unless `placeholderValue`). Reads. */
export function placeholderDate(state: DateFieldState): DateValue {
  const [granularity, defaultTimeZone] = fieldDefaults(state);
  return createPlaceholderDate(ownerPlaceholder(ownerOf(state)), granularity, calendarOf(state), defaultTimeZone);
}

/** The segments the field displays (types only), from `maxGranularity` to the granularity. */
export function displaySegments(state: DateFieldState): DateSegmentType[] {
  const granularity = fieldGranularity(state);
  const is12HourClock = state.hourCycle === "h11" || state.hourCycle === "h12";
  const segments: DateSegmentType[] = ["era", "year", "month", "day", "hour", ...(is12HourClock ? ["dayPeriod" as const] : []), "minute", "second"];
  const minIndex = segments.indexOf(state.maxGranularity || "era");
  const maxIndex = segments.indexOf(granularity === "hour" && is12HourClock ? "dayPeriod" : granularity);
  return segments.slice(minIndex, maxIndex + 1);
}

/** The date formatter of the field (locale + format options). Reads. */
export function fieldDateFormatter(state: DateFieldState): DateFormatter {
  return getDateFormatter(state.locale, getFormatOptions({}, formatOpts(state, displayValue(state))));
}

/** The current value as a native `Date` (placeholder fields fill the unset ones). Reads. */
export function fieldDateValue(state: DateFieldState): Date {
  const display = displayValue(state);
  const [, defaultTimeZone] = fieldDefaults(state);
  return display.toValue(fieldValue(state) ?? placeholderDate(state)).toDate(defaultTimeZone || "UTC");
}

const segmentCache = new WeakMap<DateFieldState, { key: string; segments: DateSegment[] }>();

/** A list of segments for the current value. Reads. */
export function segments(state: DateFieldState): DateSegment[] {
  const display = displayValue(state);
  const [granularity, defaultTimeZone] = fieldDefaults(state);
  const key = JSON.stringify([fieldValueString(state), display.toFields(), granularity, defaultTimeZone]);
  const hit = segmentCache.get(state);
  if (hit && hit.key === key) return hit.segments;
  const opts = formatOpts(state, display);
  const dateFormatter = getDateFormatter(state.locale, getFormatOptions({}, opts));
  const dateValue = display.toValue(fieldValue(state) ?? placeholderDate(state)).toDate(defaultTimeZone || "UTC");
  const result = processSegments(dateValue, display, dateFormatter, resolvedOptionsOf(dateFormatter), calendarOf(state), state.locale, granularity);
  segmentCache.set(state, { key, segments: result });
  return result;
}

const numberFormatters = new Map<string, Intl.NumberFormat>();
function numberFormatter(locale: string, twoDigit: boolean): Intl.NumberFormat {
  const key = locale + (twoDigit ? "|2" : "");
  let formatter = numberFormatters.get(key);
  if (!formatter)
    numberFormatters.set(key, (formatter = new Intl.NumberFormat(locale, { useGrouping: false, ...(twoDigit ? { minimumIntegerDigits: 2 } : {}) })));
  return formatter;
}

function processSegments(
  dateValue: Date,
  displayValue: IncompleteDate,
  dateFormatter: DateFormatter,
  resolvedOptions: Intl.ResolvedDateTimeFormatOptions,
  calendar: Calendar,
  locale: string,
  granularity: Granularity,
): DateSegment[] {
  const timeValue = ["hour", "minute", "second"];
  const segments = dateFormatter.formatToParts(dateValue);
  // In order to allow formatting temporarily invalid dates during editing (e.g. February 30th),
  // use a NumberFormatter to manually format segments directly from raw numbers.
  // When the user blurs the date field, the invalid segments will be constrained.
  for (const segment of segments) {
    if (segment.type === "year" || segment.type === "month" || segment.type === "day" || segment.type === "hour") {
      const value = displayValue[segment.type] ?? 0;
      segment.value = numberFormatter(locale, resolvedOptions[segment.type] === "2-digit").format(value);
    }
  }
  const processedSegments: DateSegment[] = [];
  const literal = (text: string): DateSegment => ({ type: "literal", text, isPlaceholder: false, placeholder: "", isEditable: false });
  for (const segment of segments) {
    const type = (TYPE_MAPPING[segment.type] || segment.type) as DateSegmentType;
    let isEditable = !!EDITABLE_SEGMENTS[type];
    if (type === "era" && calendar.getEras().length === 1) isEditable = false;
    const isPlaceholder = !!EDITABLE_SEGMENTS[type] && (displayValue as unknown as Record<string, unknown>)[segment.type] == null;
    const placeholder = EDITABLE_SEGMENTS[type] ? getPlaceholder(type, segment.value, locale) : "";
    const dateSegment = {
      type,
      text: isPlaceholder ? placeholder : segment.value,
      ...displayValue.getSegmentLimits(type),
      isPlaceholder,
      placeholder,
      isEditable,
    } as DateSegment;
    // There is an issue in RTL languages where time fields render (minute:hour) instead of (hour:minute).
    // To force an LTR direction on the time field since, we wrap the time segments in LRI (left-to-right) isolate unicode. See https://www.w3.org/International/questions/qa-bidi-unicode-controls.
    // These unicode characters will be added to the array of processed segments as literals and will mark the start and end of the embedded direction change.
    if (type === "hour") {
      // This marks the start of the embedded direction change.
      processedSegments.push(literal("⁦"));
      processedSegments.push(dateSegment);
      // This marks the end of the embedded direction change in the case that the granularity it set to "hour".
      if (type === granularity) processedSegments.push(literal("⁩"));
    } else if (timeValue.includes(type) && type === granularity) {
      processedSegments.push(dateSegment);
      // This marks the end of the embedded direction change.
      processedSegments.push(literal("⁩"));
    } else {
      // We only want to "wrap" the unicode around segments that are hour, minute, or second. If they aren't, just process as normal.
      processedSegments.push(dateSegment);
    }
  }
  return processedSegments;
}

/** Owner validation displayed for the field. Reads. */
export const fieldDisplayValidation = (state: DateFieldState): ValidationResult => displayValidation(ownerOf(state).validation);
/** Whether the date field is invalid, based on the `isInvalid`, `minValue`, and `maxValue` props. Reads. */
export const isFieldInvalid = (state: DateFieldState): boolean => fieldDisplayValidation(state).isInvalid;
/** @deprecated Use `isFieldInvalid`. */
export const fieldValidationState = (state: DateFieldState): "invalid" | null => (isFieldInvalid(state) ? "invalid" : null);

// Writes ----------------------------------------------------------------------------------------

/** Emit `newValue` (owner calendar) to the owner. */
function setDate(state: DateFieldState, newValue: DateValue | null): void {
  const owner = ownerOf(state);
  if (owner.kind === "range") {
    // useDateRangePicker field `onChange`: state.setDateTime(part, value).
    const range = untrack(() => rangeValueOf(owner));
    const other = parseValue(state.part === "start" ? range.end : range.start);
    writeRange(owner, state.part === "start" ? { start: newValue, end: other } : { start: other, end: newValue });
  } else {
    let emitted: DateValue | TimeValue | null = newValue;
    // useTimeFieldState onChange: a Time unless the value / placeholder has a date or a time zone.
    if (owner.kind === "time" && newValue && !untrack(() => timeDay(owner)) && !owner.defaultTimeZone) emitted = toTime(newValue as CalendarDateTime);
    const text = stringifyDateValue(emitted);
    if (untrack(owner.value) !== text) {
      if (isWritable(owner.value)) owner.value.set(text);
      (owner.onChange as ((value: unknown) => void) | undefined)?.(emitted);
    }
  }
  noteLast(owner.last, newValue);
  syncBuiltin(owner);
}

const peekDisplay = (state: DateFieldState): IncompleteDate => untrack(() => displayValue(state));
const writeDisplay = (state: DateFieldState, display: IncompleteDate | null): void => {
  state.display.set(display ? { base: untrack(() => fieldValueString(state)), fields: display.toFields() } : null);
};

/** Sets the field's value: a date, or an (incomplete) display value while editing. */
export function setValue(state: DateFieldState, newValue: DateValue | IncompleteDate | null): void {
  const owner = ownerOf(state);
  if (ownerDisabled(owner) || ownerReadOnly(owner)) return;
  const segmentTypes = untrack(() => displaySegments(state));
  const original = untrack(() => originalValue(state));
  if (newValue == null || (newValue instanceof IncompleteDate && newValue.isCleared(segmentTypes))) {
    writeDisplay(state, null);
    setDate(state, null);
  } else if (!(newValue instanceof IncompleteDate)) {
    // The display calendar should not have any effect on the emitted value.
    // Emit dates in the same calendar as the original value, if any, otherwise gregorian.
    writeDisplay(state, null);
    setDate(state, toCalendar(newValue, original?.calendar || new GregorianCalendar()));
  } else {
    // If the new value is complete and valid, trigger onChange eagerly.
    // If it represents an incomplete or invalid value (e.g. February 30th),
    // wait until the field is blurred to trigger onChange.
    if (newValue.isComplete(segmentTypes)) {
      const { calendarValue, placeholder, value } = untrack(() => ({
        calendarValue: fieldValue(state),
        placeholder: placeholderDate(state),
        value: parseValue(fieldValueString(state)),
      }));
      const dateValue = newValue.toValue(calendarValue ?? placeholder);
      if (newValue.validate(dateValue, segmentTypes)) {
        const newDateValue = toCalendar(dateValue, original?.calendar || new GregorianCalendar());
        if (!value || newDateValue.compare(value) !== 0) {
          writeDisplay(state, null); // reset in case prop isn't updated
          setDate(state, newDateValue);
          return;
        }
      }
    }
    // Incomplete/invalid value. Set temporary display override.
    writeDisplay(state, newValue);
  }
}

function adjustSegment(state: DateFieldState, type: DateSegmentType, amount: number): void {
  const { display, placeholder, segmentTypes } = untrack(() => ({
    display: displayValue(state),
    placeholder: placeholderDate(state),
    segmentTypes: displaySegments(state),
  }));
  setValue(state, display.cycle(type, amount, placeholder, segmentTypes));
}

/** Increments the given segment. Upon reaching the minimum or maximum value, the value wraps around to the opposite limit. */
export const increment = (state: DateFieldState, part: DateSegmentType): void => adjustSegment(state, part, 1);
/** Decrements the given segment. Upon reaching the minimum or maximum value, the value wraps around to the opposite limit. */
export const decrement = (state: DateFieldState, part: DateSegmentType): void => adjustSegment(state, part, -1);
/** Increments the given segment by a larger amount, rounding it to the nearest increment (15 minutes, 7 days, 5 years …). */
export const incrementPage = (state: DateFieldState, part: DateSegmentType): void => adjustSegment(state, part, PAGE_STEP[part] || 1);
/** Decrements the given segment by a larger amount, rounding it to the nearest increment. */
export const decrementPage = (state: DateFieldState, part: DateSegmentType): void => adjustSegment(state, part, -(PAGE_STEP[part] || 1));

/** Increments the given segment to its maxiumum value. */
export function incrementToMax(state: DateFieldState, part: DateSegmentType): void {
  const display = peekDisplay(state);
  const maxValue = part === "hour" && state.hourCycle === "h12" ? 11 : display.getSegmentLimits(part)!.maxValue;
  setValue(
    state,
    display.set(
      part,
      maxValue,
      untrack(() => placeholderDate(state)),
    ),
  );
}

/** Decrements the given segment to its minimum value. */
export function decrementToMin(state: DateFieldState, part: DateSegmentType): void {
  const display = peekDisplay(state);
  const minValue = part === "hour" && state.hourCycle === "h12" ? 12 : display.getSegmentLimits(part)!.minValue;
  setValue(
    state,
    display.set(
      part,
      minValue,
      untrack(() => placeholderDate(state)),
    ),
  );
}

/** Sets the value of the given segment. */
export function setSegment(state: DateFieldState, part: DateSegmentType, v: string | number): void {
  setValue(
    state,
    peekDisplay(state).set(
      part,
      v,
      untrack(() => placeholderDate(state)),
    ),
  );
}

/** Updates the remaining unfilled segments with the placeholder value. */
export function confirmPlaceholder(state: DateFieldState): void {
  const owner = ownerOf(state);
  if (ownerDisabled(owner) || ownerReadOnly(owner)) return;
  const display = peekDisplay(state);
  // If the display value is complete but invalid, we need to constrain it and emit onChange on blur.
  if (display.isComplete(untrack(() => displaySegments(state)))) {
    const { calendarValue, placeholder, value, original } = untrack(() => ({
      calendarValue: fieldValue(state),
      placeholder: placeholderDate(state),
      value: parseValue(fieldValueString(state)),
      original: originalValue(state),
    }));
    const dateValue = display.toValue(calendarValue ?? placeholder);
    const newDateValue = toCalendar(dateValue, original?.calendar || new GregorianCalendar());
    if (!value || newDateValue.compare(value) !== 0) setDate(state, newDateValue);
    writeDisplay(state, null);
  }
}

/** Clears the value of the given segment, reverting it to the placeholder. */
export function clearSegment(state: DateFieldState, part: DateSegmentType): void {
  let value = peekDisplay(state);
  if (part !== "timeZoneName" && part !== "literal") value = value.clear(part);
  setValue(state, value);
}

/** Formats the current date value using the given options. Reads. */
export function formatValue(state: DateFieldState, fieldOptions: FieldOptions): string {
  if (!fieldValue(state)) return "";
  const formatOptions = getFormatOptions(fieldOptions, formatOpts(state, displayValue(state)));
  return new DateFormatter(state.locale, formatOptions).format(fieldDateValue(state));
}

/** Gets a formatter based on state's props. */
export function getFieldDateFormatter(state: DateFieldState, locale: string, formatOptions: FormatterOptions): DateFormatter {
  const newOptions = { ...untrack(() => formatOpts(state, displayValue(state))), ...formatOptions };
  return new DateFormatter(locale, getFormatOptions({}, newOptions));
}

export { CalendarDate };
