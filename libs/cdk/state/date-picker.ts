// Ported from react-stately (react-spectrum, Apache-2.0, © Adobe): datepicker/useDatePickerState.ts
// and datepicker/useDateRangePickerState.ts.
//
// Rivet shape: plain signals + JSON (resumable); React Stately's methods are functions taking the
// state first (`state.setDateValue(d)` → `setDateValue(state, d)`); DatePicker and DateRangePicker
// share `setOpen` / `isInvalid` / `formatValue` (dispatch on `kind`). Dates are strings in the
// signals. The overlay state is `createOverlayTriggerState`'s (the popover's open signal).
// The fields (`createPickerFieldState`, ./date-field.ts) read and write these values.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import {
  DateFormatter,
  stringifyDateValue,
  toCalendarDate,
  toCalendarDateTime,
  toDateValueString,
  type CalendarDate,
  type DateValueString,
} from "@rivetjs/cdk/date";
import { controllable } from "@rivetjs/cdk/interactions";
import { resumedId } from "@rivetjs/cdk/id";
import { resolveLocale } from "@rivetjs/cdk/i18n";
import {
  createFormValidationState,
  commitValidation,
  displayValidation,
  DEFAULT_VALIDATION_RESULT,
  type ValidationFunction,
  type ValidationResult,
} from "./form-validation.ts";
import { createOverlayTriggerState, setOpen as setOverlayOpen, type OverlayTriggerProps, type OverlayTriggerState } from "./overlays.ts";
import {
  builtinValidation,
  dateValueSignal,
  isWritable,
  defaultProps,
  getFormatOptions,
  getPlaceholderTime,
  isCompleteRange,
  noteLast,
  ownerBase,
  ownerFormat,
  parseInput,
  parseValue,
  rangeValueOf,
  writeRange,
  type DateFieldBaseOptions,
  type DateInput,
  type DateRangeOwner,
  type DateValue,
  type DateValueOwner,
  type DateValueProp,
  type FieldOptions,
  type MappedDateValue,
  type FormatterOptions,
  type Granularity,
  type RangeValue,
  type TimeValue,
} from "./date-field.ts";

export type { DateInput, DateValue, DateValueString, Granularity, RangeValue, TimeValue };
export type PageBehavior = "single" | "visible";
export type FirstDayOfWeek = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

interface DatePickerBaseOptions extends DateFieldBaseOptions, OverlayTriggerProps {
  /** Determines whether the date picker popover should close automatically when a date is selected. @default true */
  shouldCloseOnSelect?: boolean | (() => boolean);
  /** Controls the behavior of paging (the calendar's `pageBehavior`). @default visible */
  pageBehavior?: PageBehavior;
  /** The day that starts the week. */
  firstDayOfWeek?: FirstDayOfWeek;
  id?: string;
}

export interface DatePickerStateOptions<T extends DateValue = DateValue> extends DatePickerBaseOptions {
  /** Controlled value: a date, or a two-way signal of its string form. */
  value?: DateValueProp<T>;
  /** Uncontrolled initial value. */
  defaultValue?: T | DateValueString | null;
  /** Called with the new value (date object). */
  onChange?: (value: MappedDateValue<T> | null) => void;
  /** Callback that is called for each date of the calendar. If it returns true, then the date is unavailable. */
  isDateUnavailable?: (date: DateValue) => boolean;
  /** Custom client validation of the value (a date object). */
  validate?: ValidationFunction<MappedDateValue<T>>;
}

export interface DateRangePickerStateOptions<T extends DateValue = DateValue> extends DatePickerBaseOptions {
  /** Controlled value: a range of dates, or a two-way signal of `{ start, end }` string forms. */
  value?: RangeValue<T | DateValueString> | null | Signal<RangeValue<DateValueString> | null>;
  defaultValue?: RangeValue<T | DateValueString> | null;
  onChange?: (value: RangeValue<MappedDateValue<T>> | null) => void;
  /** When combined with `isDateUnavailable`, determines whether non-contiguous ranges, i.e. ranges containing unavailable dates, may be selected. */
  allowsNonContiguousRanges?: boolean;
  /** Callback that is called for each date of the calendar. If it returns true, then the date is unavailable. */
  isDateUnavailable?: (date: DateValue, anchorDate: CalendarDate | null) => boolean;
  /** Custom client validation of the range (date objects). */
  validate?: ValidationFunction<RangeValue<MappedDateValue<T>>>;
  /** The name of the start date input element, used when submitting an HTML form. */
  startName?: string;
  /** The name of the end date input element, used when submitting an HTML form. */
  endName?: string;
}

interface PickerStateBase extends OverlayTriggerState {
  readonly id: string;
  readonly shouldCloseOnSelect: boolean | (() => boolean);
  readonly pageBehavior?: PageBehavior | undefined;
  readonly firstDayOfWeek?: FirstDayOfWeek | undefined;
  /** Focus is within the picker (RAC `isFocusWithin`, `data-focus-within`). */
  readonly isFocusWithin: Signal<boolean>;
  /** Keyboard focus is within the picker (RAC `isFocusVisible`, `data-focus-visible`). */
  readonly isFocusVisible: Signal<boolean>;
}

export interface DatePickerState extends PickerStateBase, DateValueOwner {
  readonly kind: "picker";
  /** The default date (`defaultValue ?? initial value`). */
  readonly defaultValue: DateValueString | null;
  /** The date portion selected in the calendar before a time was (string form). */
  readonly selectedDate: Signal<DateValueString | null>;
  /** The time portion set before a date was (string form). */
  readonly selectedTime: Signal<DateValueString | null>;
}

export interface DateRangePickerState extends PickerStateBase, DateRangeOwner {
  /** The default selected date range. */
  readonly defaultValue: RangeValue<DateValueString> | null;
  readonly allowsNonContiguousRanges: boolean;
  readonly startName?: string | undefined;
  readonly endName?: string | undefined;
  /** The date portion of the selected range before a time range was. */
  readonly selectedDateRange: Signal<RangeValue<DateValueString | null> | null>;
  /** The time portion of the selected range before a date range was. */
  readonly selectedTimeRange: Signal<RangeValue<DateValueString | null> | null>;
}

export type AnyDatePickerState = DatePickerState | DateRangePickerState;

const pickerBase = (options: DatePickerBaseOptions): Omit<PickerStateBase, keyof OverlayTriggerState> & OverlayTriggerState => ({
  ...createOverlayTriggerState(options),
  id: options.id ?? resumedId(),
  shouldCloseOnSelect: options.shouldCloseOnSelect ?? true,
  ...(options.pageBehavior ? { pageBehavior: options.pageBehavior } : {}),
  ...(options.firstDayOfWeek ? { firstDayOfWeek: options.firstDayOfWeek } : {}),
  isFocusWithin: signal(false),
  isFocusVisible: signal(false),
});

/**
 * `useDatePickerState`: state of a date picker (a DateField plus a Calendar popover to enter or
 * select a date and time value).
 */
export function createDatePickerState<T extends DateValue = DateValue>(options: DatePickerStateOptions<T> = {}): DatePickerState {
  const locale = resolveLocale(options.locale);
  const value = dateValueSignal(options.value, options.defaultValue);
  const initial = untrack(value);
  const v = parseValue(initial) || parseInput(options.placeholderValue);
  // props.granularity must actually exist in the value if one is provided.
  const [granularity] = defaultProps(v, options.granularity, { granularity: "day", timeZone: null });
  if (v && !(granularity in v)) throw new Error("Invalid granularity " + granularity + " for value " + v.toString());
  const base = ownerBase(options, v, locale);
  const state: DatePickerState = {
    ...pickerBase(options),
    ...base,
    kind: "picker",
    value,
    defaultValue: toDateValueString(options.defaultValue) ?? initial,
    ...(options.onChange ? { onChange: options.onChange as (value: never) => void } : {}),
    ...(options.isDateUnavailable ? { isDateUnavailable: options.isDateUnavailable } : {}),
    ...(options.validate ? { validate: options.validate as ValidationFunction<never> } : {}),
    selectedDate: signal<DateValueString | null>(null),
    selectedTime: signal<DateValueString | null>(null),
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

/**
 * `useDateRangePickerState`: state of a date range picker (two DateFields plus a RangeCalendar
 * popover to enter or select a date and time range).
 */
export function createDateRangePickerState<T extends DateValue = DateValue>(options: DateRangePickerStateOptions<T> = {}): DateRangePickerState {
  const locale = resolveLocale(options.locale);
  const toText = (range: RangeValue<T | DateValueString> | null | undefined) =>
    range ? { start: toDateValueString(range.start)!, end: toDateValueString(range.end)! } : null;
  const defaultText = toText(options.defaultValue);
  const valueProp = options.value;
  // A plain controlled value is the state's starting value (Rivet: the signal form is two-way).
  const value =
    typeof valueProp === "function" ? controllable(valueProp, null) : controllable(undefined, valueProp !== undefined ? toText(valueProp) : defaultText);
  const initial = untrack(value);
  const partial = signal<RangeValue<DateValueString | null>>(initial || { start: null, end: null });
  const v = parseValue(initial?.start) || parseValue(initial?.end) || parseInput(options.placeholderValue);
  const [granularity] = defaultProps(v, options.granularity, { granularity: "day", timeZone: null });
  if (v && !(granularity in v)) throw new Error("Invalid granularity " + granularity + " for value " + v.toString());
  const base = ownerBase(options, v, locale);
  const names = [options.startName, options.endName].filter((n): n is string => n != null);
  const state: DateRangePickerState = {
    ...pickerBase(options),
    ...base,
    kind: "range",
    value,
    partial,
    defaultValue: defaultText ?? initial,
    ...(options.onChange ? { onChange: options.onChange as DateRangeOwner["onChange"] } : {}),
    ...(options.isDateUnavailable ? { isDateUnavailable: options.isDateUnavailable } : {}),
    ...(options.validate ? { validate: options.validate as ValidationFunction<never> } : {}),
    allowsNonContiguousRanges: options.allowsNonContiguousRanges ?? false,
    ...(options.startName != null ? { startName: options.startName } : {}),
    ...(options.endName != null ? { endName: options.endName } : {}),
    selectedDateRange: signal<RangeValue<DateValueString | null> | null>(null),
    selectedTimeRange: signal<RangeValue<DateValueString | null> | null>(null),
    partValidity: signal({ start: DEFAULT_VALIDATION_RESULT, end: DEFAULT_VALIDATION_RESULT }),
    validation: createFormValidationState({
      isInvalid: options.isInvalid,
      validationState: options.validationState,
      validationBehavior: options.validationBehavior ?? "aria",
      name: names,
      validationErrors: options.validationErrors,
      builtinValidation: base.builtin,
      value,
    }),
  };
  state.builtin.set(untrack(() => builtinValidation(state)));
  return state;
}

// ---------------------------------------------------------------------------------------------
// Accessors (reactive reads)

/** The currently selected date (DatePicker). */
export const pickerValue = (state: DatePickerState): DateValue | null => parseValue(state.value());

/** The current range (`{start, end}` may be partial while the fields are edited). */
export function pickerRangeValue(state: DateRangePickerState): RangeValue<DateValue | null> {
  const range = rangeValueOf(state);
  return { start: parseValue(range.start), end: parseValue(range.end) };
}

/** The granularity for the field, based on the `granularity` prop and current value. */
export function granularity(state: AnyDatePickerState): Granularity {
  return ownerFormat(state).granularity!;
}

/** Whether the date picker supports selecting a time, according to the `granularity` prop and current value. */
export function hasTime(state: AnyDatePickerState): boolean {
  const g = granularity(state);
  return g === "hour" || g === "minute" || g === "second";
}

/** The date portion of the value; may be set prior to `value` if a date was selected but no time yet. */
export function dateValue(state: DatePickerState): DateValue | null {
  return pickerValue(state) ?? parseValue(state.selectedDate());
}

/** The time portion of the value; may be set prior to `value` if a time was selected but no date yet. */
export function timeValue(state: DatePickerState): TimeValue | null {
  const value = pickerValue(state);
  if (value) return "hour" in value ? value : (parseValue(state.selectedTime()) as TimeValue | null);
  return parseTime(state.selectedTime());
}

const parseTime = (text: DateValueString | null): TimeValue | null => (text ? (parseInput(text) as unknown as TimeValue) : null);

/** The date portion of the selected range (DateRangePicker). */
export function dateRange(state: DateRangePickerState): RangeValue<DateValue | null> | null {
  const value = pickerRangeValue(state);
  if (isCompleteRange(value)) return value;
  const selected = state.selectedDateRange();
  return selected ? { start: parseValue(selected.start), end: parseValue(selected.end) } : null;
}

/** The time portion of the selected range (DateRangePicker). */
export function timeRange(state: DateRangePickerState): RangeValue<TimeValue | null> | null {
  const value = pickerRangeValue(state);
  if (isCompleteRange(value) && "hour" in value.start) return value as RangeValue<TimeValue>;
  const selected = state.selectedTimeRange();
  return selected ? { start: parseTime(selected.start), end: parseTime(selected.end) } : null;
}

/** Whether the date picker is invalid, based on the `isInvalid`, `minValue`, and `maxValue` props. */
export const isInvalid = (state: AnyDatePickerState): boolean => displayValidation(state.validation).isInvalid;
/** @deprecated Use `isInvalid` instead. */
export const validationState = (state: AnyDatePickerState): "invalid" | null => (isInvalid(state) ? "invalid" : null);
/** The displayed validation (`state.displayValidation`). */
export const pickerDisplayValidation = (state: AnyDatePickerState): ValidationResult => displayValidation(state.validation);

// ---------------------------------------------------------------------------------------------
// Writes

const shouldClose = (state: AnyDatePickerState): boolean =>
  typeof state.shouldCloseOnSelect === "function" ? state.shouldCloseOnSelect() : state.shouldCloseOnSelect;

const afterWrite = (state: AnyDatePickerState, v: DateValue | null): void => {
  noteLast(state.last, v);
  state.builtin.set(untrack(() => builtinValidation(state)));
};

/** Sets the selected date (DatePicker) or range (DateRangePicker). */
export function setValue(state: DatePickerState, value: DateValue | null): void;
export function setValue(state: DateRangePickerState, value: RangeValue<DateValue | null> | null): void;
export function setValue(state: AnyDatePickerState, value: DateValue | RangeValue<DateValue | null> | null): void {
  if (state.kind === "range") {
    const range = value as RangeValue<DateValue | null> | null;
    writeRange(state, range);
    afterWrite(state, range?.start ?? range?.end ?? null);
    return;
  }
  const text = stringifyDateValue(value as DateValue | null);
  if (untrack(state.value) !== text) {
    if (isWritable(state.value)) state.value.set(text);
    (state.onChange as ((value: unknown) => void) | undefined)?.(value);
  }
  afterWrite(state, value as DateValue | null);
}

function commitValue(state: DatePickerState, date: DateValue, time: TimeValue, beforeCommit?: () => void): void {
  setValue(state, "timeZone" in time ? time.set(toCalendarDate(date)) : toCalendarDateTime(date, time));
  state.selectedDate.set(null);
  state.selectedTime.set(null);
  beforeCommit?.();
  commitValidation(state.validation);
}

/**
 * Sets the date portion of the value (the Calendar's `onChange`); intercepts so a time is not changed by date selection.
 * `beforeCommit` runs after the value is written, right before the validation commit (the picker syncs its hidden
 * inputs there, so the commit sees their new native validity: RA reads it in a layout effect after the update).
 */
export function setDateValue(state: DatePickerState, newValue: DateValue, beforeCommit?: () => void): void {
  const close = shouldClose(state);
  if (untrack(() => hasTime(state))) {
    const selectedTime = untrack(() => timeValue(state));
    if (selectedTime || close)
      commitValue(state, newValue, selectedTime || getPlaceholderTime(parseValue(state.defaultValue) || parseValue(state.placeholderValue)), beforeCommit);
    else state.selectedDate.set(stringifyDateValue(newValue));
  } else {
    setValue(state, newValue);
    beforeCommit?.();
    commitValidation(state.validation);
  }
  if (close) setOverlayOpen(state, false);
}

/** Sets the time portion of the value. */
export function setTimeValue(state: DatePickerState, newValue: TimeValue): void {
  const selectedDate = untrack(() => dateValue(state));
  if (selectedDate && newValue) commitValue(state, selectedDate, newValue);
  else state.selectedTime.set(stringifyDateValue(newValue));
}

function commitRange(state: DateRangePickerState, range: RangeValue<DateValue>, time: RangeValue<TimeValue>, beforeCommit?: () => void): void {
  setValue(state, {
    start: "timeZone" in time.start ? time.start.set(toCalendarDate(range.start)) : toCalendarDateTime(range.start, time.start),
    end: "timeZone" in time.end ? time.end.set(toCalendarDate(range.end)) : toCalendarDateTime(range.end, time.end),
  });
  state.selectedDateRange.set(null);
  state.selectedTimeRange.set(null);
  beforeCommit?.();
  commitValidation(state.validation);
}

const rangeText = (range: RangeValue<DateValue | TimeValue | null>): RangeValue<DateValueString | null> => ({
  start: stringifyDateValue(range.start),
  end: stringifyDateValue(range.end),
});

/** Sets the date portion of the selected range (the RangeCalendar's `onChange`); `beforeCommit` as `setDateValue`. */
export function setDateRange(state: DateRangePickerState, range: RangeValue<DateValue | null>, beforeCommit?: () => void): void {
  const close = shouldClose(state);
  const time = untrack(() => timeRange(state));
  const placeholder = parseValue(state.placeholderValue);
  if (untrack(() => hasTime(state))) {
    // Set a placeholder time if the popover is closing so we don't leave the field in an incomplete state.
    if (isCompleteRange(range) && (close || (time?.start && time?.end)))
      commitRange(state, range, { start: time?.start || getPlaceholderTime(placeholder), end: time?.end || getPlaceholderTime(placeholder) }, beforeCommit);
    else state.selectedDateRange.set(rangeText(range));
  } else if (isCompleteRange(range)) {
    setValue(state, range);
    beforeCommit?.();
    commitValidation(state.validation);
  } else state.selectedDateRange.set(rangeText(range));
  if (close) setOverlayOpen(state, false);
}

/** Sets the time portion of the selected range. */
export function setTimeRange(state: DateRangePickerState, range: RangeValue<TimeValue | null>): void {
  const dates = untrack(() => dateRange(state));
  if (isCompleteRange(dates) && isCompleteRange(range)) commitRange(state, dates, range);
  else state.selectedTimeRange.set(rangeText(range));
}

/** Sets the date portion of either the start or end of the selected range. */
export function setDate(state: DateRangePickerState, part: "start" | "end", date: DateValue | null): void {
  const dates = untrack(() => dateRange(state));
  setDateRange(state, part === "start" ? { start: date, end: dates?.end ?? null } : { start: dates?.start ?? null, end: date });
}

/** Sets the time portion of either the start or end of the selected range. */
export function setTime(state: DateRangePickerState, part: "start" | "end", time: TimeValue | null): void {
  const times = untrack(() => timeRange(state));
  setTimeRange(state, part === "start" ? { start: time, end: times?.end ?? null } : { start: times?.start ?? null, end: time });
}

/** Sets the date and time of either the start or end of the selected range. */
export function setDateTime(state: DateRangePickerState, part: "start" | "end", dateTime: DateValue | null): void {
  const value = untrack(() => pickerRangeValue(state));
  setValue(state, part === "start" ? { start: dateTime, end: value.end } : { start: value.start, end: dateTime });
}

/**
 * Sets whether the calendar popover is open. Closing commits a selected date (range) without a time
 * using a placeholder time; if only the time was set, nothing commits (kept until the next open).
 */
export function setOpen(state: AnyDatePickerState, isOpen: boolean): void {
  if (!isOpen) commitOnClose(state);
  setOverlayOpen(state, isOpen);
}

/** The commit `setOpen(false)` does (also run when the popover closes by Escape / outside press). */
export function commitOnClose(state: AnyDatePickerState): void {
  if (!untrack(() => hasTime(state))) return;
  const placeholder = parseValue(state.placeholderValue);
  if (state.kind === "range") {
    const value = untrack(() => pickerRangeValue(state)),
      dates = untrack(() => dateRange(state)),
      time = untrack(() => timeRange(state));
    if (!(value.start && value.end) && isCompleteRange(dates))
      commitRange(state, dates, { start: time?.start || getPlaceholderTime(placeholder), end: time?.end || getPlaceholderTime(placeholder) });
    return;
  }
  const value = untrack(() => pickerValue(state)),
    selectedDate = parseValue(untrack(state.selectedDate));
  if (!value && selectedDate)
    commitValue(state, selectedDate, parseTime(untrack(state.selectedTime)) || getPlaceholderTime(parseValue(state.defaultValue) || placeholder));
}

// ---------------------------------------------------------------------------------------------
// Formatting

/** Formats the selected value (DatePicker: a string; DateRangePicker: `{start, end}` or null). */
export function formatValue(state: DatePickerState, locale: string, fieldOptions: FieldOptions): string;
export function formatValue(state: DateRangePickerState, locale: string, fieldOptions: FieldOptions): { start: string; end: string } | null;
export function formatValue(state: AnyDatePickerState, locale: string, fieldOptions: FieldOptions): string | { start: string; end: string } | null {
  if (state.kind === "range") return formatRange(state, locale, fieldOptions);
  const value = pickerValue(state);
  if (!value) return "";
  const formatOpts = ownerFormat(state);
  const formatter = new DateFormatter(locale, getFormatOptions(fieldOptions, formatOpts));
  return formatter.format(value.toDate(formatOpts.timeZone ?? "UTC"));
}

function formatRange(state: DateRangePickerState, locale: string, fieldOptions: FieldOptions): { start: string; end: string } | null {
  const value = pickerRangeValue(state);
  if (!value || !value.start || !value.end) return null;
  const startTimeZone = "timeZone" in value.start ? value.start.timeZone : undefined;
  const startGranularity = state.granularityProp || (value.start && "minute" in value.start ? "minute" : "day");
  const endTimeZone = "timeZone" in value.end ? value.end.timeZone : undefined;
  const endGranularity = state.granularityProp || (value.end && "minute" in value.end ? "minute" : "day");
  const startOptions = getFormatOptions(fieldOptions, {
    granularity: startGranularity,
    timeZone: startTimeZone,
    hideTimeZone: state.hideTimeZone,
    hourCycle: state.hourCycleProp,
    showEra:
      (value.start.calendar.identifier === "gregory" && value.start.era === "BC") || (value.end.calendar.identifier === "gregory" && value.end.era === "BC"),
  });
  const startDate = value.start.toDate(startTimeZone || "UTC");
  const endDate = value.end.toDate(endTimeZone || "UTC");
  const startFormatter = new DateFormatter(locale, startOptions);
  let endFormatter: DateFormatter;
  if (startTimeZone === endTimeZone && startGranularity === endGranularity && value.start.compare(value.end) !== 0) {
    // Use formatRange, as it results in shorter output when some of the fields
    // are shared between the start and end dates (e.g. the same month).
    // Formatting will fail if the end date is before the start date. Fall back below when that happens.
    try {
      const parts = startFormatter.formatRangeToParts(startDate, endDate);
      // Find the separator between the start and end date. This is determined
      // by finding the last shared literal before the end range.
      let separatorIndex = -1;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        if (part.source === "shared" && part.type === "literal") separatorIndex = i;
        else if (part.source === "endRange") break;
      }
      // Now we can combine the parts into start and end strings.
      let start = "";
      let end = "";
      for (let i = 0; i < parts.length; i++) {
        if (i < separatorIndex) start += parts[i]!.value;
        else if (i > separatorIndex) end += parts[i]!.value;
      }
      return { start, end };
    } catch {
      // ignore
    }
    endFormatter = startFormatter;
  } else {
    const endOptions = getFormatOptions(fieldOptions, {
      granularity: endGranularity,
      timeZone: endTimeZone,
      hideTimeZone: state.hideTimeZone,
      hourCycle: state.hourCycleProp,
    });
    endFormatter = new DateFormatter(locale, endOptions);
  }
  return { start: startFormatter.format(startDate), end: endFormatter.format(endDate) };
}

/** Gets a formatter based on state's props. */
export function getDateFormatter(state: AnyDatePickerState, locale: string, formatOptions: FormatterOptions): DateFormatter {
  const newOptions = { ...untrack(() => ownerFormat(state)), ...formatOptions };
  return new DateFormatter(locale, getFormatOptions({}, newOptions));
}
