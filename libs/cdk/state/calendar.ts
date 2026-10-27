// Ported from react-stately (react-spectrum, Apache-2.0, © Adobe): calendar/useCalendarState.ts,
// calendar/useRangeCalendarState.ts and calendar/utils.ts.
//
// Rivet shape: the state is plain signals + JSON (resumable); every method of React Stately's
// CalendarState / RangeCalendarState is an exported function taking the state first
// (`state.focusNextDay()` → `focusNextDay(state)`). Dates live in the signals as strings
// (`@rivetjs/cdk/date` `stringifyDateValue`), read back as `CalendarDate` objects by the accessors
// (`focusedDate(state)`, `calendarValue(state)`, `visibleRange(state)` …). React Stately's
// render-time corrections (focus outside the visible range moves the range, focus outside
// [min, max] is constrained) run after every write and again on read, so controlled `focusedValue`
// signals written from outside behave the same.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import {
  CalendarDate,
  DateFormatter,
  GregorianCalendar,
  createCalendar as createAnyCalendar,
  endOfMonth,
  endOfWeek,
  getDayOfWeek,
  getWeeksInMonth as weeksIn,
  isSameDay,
  maxDate,
  minDate,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toCalendar,
  toCalendarDate,
  today,
  type Calendar,
  type CalendarIdentifier,
  type DateDuration,
} from "@rivetjs/cdk/date";
import { parseDateValue, stringifyDateValue, toDateValueString, type AnyDateValue, type DateValueString } from "@rivetjs/cdk/date";
import type { CalendarDateTime, ZonedDateTime } from "@rivetjs/cdk/date";
import { resumedId } from "@rivetjs/cdk/id";
import { formatString, getStringsForLocale, resolveLocale } from "@rivetjs/cdk/i18n";
import { calendarMessages, type CalendarMessageKey } from "../calendar/intl.ts";

export type DateValue = AnyDateValue;
export type { DateValueString } from "@rivetjs/cdk/date";
/** The date type emitted for a value of type `T` (types.ts). */
export type MappedDateValue<T> = T extends ZonedDateTime
  ? ZonedDateTime
  : T extends CalendarDateTime
    ? CalendarDateTime
    : T extends CalendarDate
      ? CalendarDate
      : never;
export type PageBehavior = "single" | "visible";
export type CalendarSelectionMode = "single" | "multiple";
/** `T` for single selection, `T[]` for multiple (types.ts). */
export type CalendarValueType<T, M extends CalendarSelectionMode> = M extends "single" ? T : T[];
export type FirstDayOfWeek = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export interface RangeValue<T> {
  start: T;
  end: T;
}
/** A date value or its string form (`2026-10-04`, `2026-10-04T09:30`, …). */
export type DateInput = DateValue | DateValueString;

export interface CalendarPropsBase {
  /** The minimum allowed date that a user may select. */
  minValue?: DateInput | null;
  /** The maximum allowed date that a user may select. */
  maxValue?: DateInput | null;
  /** Whether the calendar is disabled (an accessor stays live: `isCalendarDisabled`). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** Whether the calendar value is immutable (an accessor stays live: `isCalendarReadOnly`). */
  isReadOnly?: boolean | (() => boolean | undefined);
  /** Whether to automatically focus the calendar when it mounts. */
  autoFocus?: boolean;
  /** Controls the currently focused date: a date, or a two-way signal of its string form. */
  focusedValue?: DateValue | null | Signal<DateValueString>;
  /** The date that is focused when the calendar first mounts (uncontrolled). */
  defaultFocusedValue?: DateInput | null;
  /** Handler that is called when the focused date changes. */
  onFocusChange?: (date: CalendarDate) => void;
  /** @deprecated Use `isInvalid` instead. */
  validationState?: "valid" | "invalid";
  /** Whether the current selection is invalid according to application logic (an accessor stays live). */
  isInvalid?: boolean | (() => boolean | undefined);
  /** Paging by the visible duration (default) or one unit of it. */
  pageBehavior?: PageBehavior;
  /** The day that starts the week. */
  firstDayOfWeek?: FirstDayOfWeek;
  /** Alignment of the visible months on first render around the selection / today. */
  selectionAlignment?: "start" | "center" | "end";
  /** The number of weeks in a month (overrides the locale's). */
  weeksInMonth?: number;
}

/**
 * Props of `useCalendarState` (CalendarProps + CalendarStateOptions). Controlled `value`: a date
 * (array for `selectionMode="multiple"`), or a two-way signal of its string form(s) (resumable).
 */
export interface CalendarStateOptions<T extends DateValue = DateValue, M extends CalendarSelectionMode = CalendarSelectionMode> extends CalendarPropsBase {
  /** Whether single or multiple selection is enabled. Default `single`. */
  selectionMode?: M;
  /** Controlled value: a date (multiple: dates), or a signal of the string form (multiple: array of strings). */
  value?: CalendarValueType<T | DateValueString | null, M> | Signal<DateValueString | null> | Signal<DateValueString[]>;
  /** Uncontrolled initial value. */
  defaultValue?: CalendarValueType<T | DateValueString | null, M> | readonly DateInput[];
  /** Called with the new value (date objects, in the calendar of the original value). */
  onChange?: (value: CalendarValueType<MappedDateValue<T>, M>) => void;
  /** Returns true for dates that cannot be selected. */
  isDateUnavailable?: (date: CalendarDate) => boolean;
  /** The locale to display and edit the value according to (default: the enclosing `I18nProvider`'s, `useLocale()`). */
  locale?: string;
  /** Creates the display calendar system for an identifier (default: `createCalendar` of `@rivetjs/cdk/date`). */
  createCalendar?: (identifier: CalendarIdentifier) => Calendar;
  /** The amount of days that will be displayed at once. Default `{ months: 1 }`. */
  visibleDuration?: DateDuration;
  id?: string;
}

/** Props of `useRangeCalendarState`. Controlled `value`: a range of dates, or a two-way signal of `{ start, end }` string forms. */
export interface RangeCalendarStateOptions<T extends DateValue = DateValue> extends CalendarPropsBase {
  /** Controlled value: a range of dates, or a signal of `{ start, end }` string forms, or null. */
  value?: RangeValue<T | DateValueString> | null | Signal<RangeValue<DateValueString> | null>;
  defaultValue?: RangeValue<T | DateValueString> | null;
  onChange?: (value: RangeValue<MappedDateValue<T>>) => void;
  /** Whether non-contiguous ranges (containing unavailable dates) may be selected. */
  allowsNonContiguousRanges?: boolean;
  /** Returns true for dates that cannot be selected; `anchorDate` is the date the selection started on. */
  isDateUnavailable?: (date: CalendarDate, anchorDate: CalendarDate | null) => boolean;
  /** The locale (default: `useLocale()`). */
  locale?: string;
  createCalendar?: (identifier: CalendarIdentifier) => Calendar;
  visibleDuration?: DateDuration;
  id?: string;
}

// `Signal<any>`: Signal is invariant, so a `Signal<unknown>` guard would not narrow `X | Signal<Y>`.
const isSignal = (value: unknown): value is Signal<any> => typeof value === "function";
const isWritable = (cell: unknown): boolean => typeof (cell as { set?: unknown }).set === "function";

export type CalendarStrings = Record<CalendarMessageKey, string>;

interface StateBase {
  readonly id: string;
  readonly locale: string;
  /** Display calendar system identifier (from the locale). */
  readonly calendar: CalendarIdentifier;
  readonly createCalendar?: (identifier: CalendarIdentifier) => Calendar;
  readonly timeZone: string;
  readonly visibleDuration: DateDuration;
  readonly pageBehavior: PageBehavior;
  readonly firstDayOfWeek?: FirstDayOfWeek;
  readonly weeksInMonth?: number;
  /** Flags at creation; read `isCalendarDisabled` / `isCalendarReadOnly` (follow a live accessor). */
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  /** Live `isDisabled` / `isReadOnly` / `isInvalid` accessors (live props P5; created by the component). */
  readonly disabled?: (() => boolean | undefined) | undefined;
  readonly readOnly?: (() => boolean | undefined) | undefined;
  readonly invalid?: (() => boolean | undefined) | undefined;
  /** A static `isInvalid` / `validationState="invalid"` prop (a live `isInvalid` is `invalid`). */
  readonly invalidProp: boolean;
  readonly minValue: DateValueString | null;
  readonly maxValue: DateValueString | null;
  readonly onFocusChange?: (date: CalendarDate) => void;
  /** Focused date (display calendar, string form). */
  readonly focused: Signal<DateValueString>;
  /** First visible date (string form). */
  readonly start: Signal<DateValueString>;
  /** Rivet: `focusedValue` is the caller's signal (writes from outside the calendar may leave the visible range). */
  readonly focusControlled: boolean;
  /** Focus is within the grid. */
  readonly isFocused: Signal<boolean>;
  /**
   * Rivet: the cell interaction states RAC CalendarCell keeps per cell (useHover / usePress /
   * useFocusRing), as the `cellKey` of the hovered / pressed / keyboard-focused cell (written by the
   * grid's delegated handlers; read by the cells' `isHovered` / `isPressed` / `isFocusVisible`).
   */
  readonly hoveredCell: Signal<string | null>;
  readonly pressedCell: Signal<string | null>;
  readonly focusVisibleCell: Signal<string | null>;
  readonly strings: CalendarStrings;
  /** Rivet: React Aria's `hookData` (useCalendarBase → useCalendarGrid): the calendar's labelling, set by `calendarProps`. */
  aria?: { label?: string | undefined; labelledBy?: string | undefined };
}

export interface CalendarState extends StateBase {
  readonly mode: "single";
  readonly selectionMode: CalendarSelectionMode;
  readonly value: Signal<DateValueString | null> | Signal<DateValueString[]>;
  readonly isDateUnavailable?: (date: CalendarDate) => boolean;
  readonly onChange?: (value: never) => void;
}

export interface RangeCalendarState extends StateBase {
  readonly mode: "range";
  readonly value: Signal<RangeValue<DateValueString> | null>;
  /** Range selection anchor (string form), null when not selecting. */
  readonly anchor: Signal<DateValueString | null>;
  readonly dragging: Signal<boolean>;
  readonly allowsNonContiguousRanges: boolean;
  readonly rangeUnavailable?: (date: CalendarDate, anchorDate: CalendarDate | null) => boolean;
  readonly onChange?: (value: never) => void;
}

export type AnyCalendarState = CalendarState | RangeCalendarState;

// ---------------------------------------------------------------------------------------------
// utils.ts

export function isInvalid(date: DateValue, minValue?: DateValue | null, maxValue?: DateValue | null): boolean {
  return (minValue != null && date.compare(minValue) < 0) || (maxValue != null && date.compare(maxValue) > 0);
}

export function alignCenter(
  date: CalendarDate,
  duration: DateDuration,
  locale: string,
  minValue?: DateValue | null,
  maxValue?: DateValue | null,
): CalendarDate {
  const halfDuration: DateDuration = {};
  for (const key in duration) {
    const k = key as keyof DateDuration;
    halfDuration[k] = Math.floor(duration[k]! / 2);
    if (halfDuration[k]! > 0 && duration[k]! % 2 === 0) halfDuration[k]!--;
  }
  const aligned = alignStart(date, duration, locale).subtract(halfDuration);
  return constrainStart(date, aligned, duration, locale, minValue, maxValue);
}

export function alignStart(date: CalendarDate, duration: DateDuration, locale: string, minValue?: DateValue | null, maxValue?: DateValue | null): CalendarDate {
  // align to the start of the largest unit
  let aligned = date;
  if (duration.years) aligned = startOfYear(date);
  else if (duration.months) aligned = startOfMonth(date);
  else if (duration.weeks || (duration.days && duration.days > 7)) aligned = startOfWeek(date, locale);
  return constrainStart(date, aligned, duration, locale, minValue, maxValue);
}

export function alignEnd(date: CalendarDate, duration: DateDuration, locale: string, minValue?: DateValue | null, maxValue?: DateValue | null): CalendarDate {
  const d = { ...duration };
  // subtract 1 from the smallest unit
  if (d.days) d.days--;
  else if (d.weeks) d.weeks--;
  else if (d.months) d.months--;
  else if (d.years) d.years--;
  const aligned = alignStart(date, duration, locale).subtract(d);
  return constrainStart(date, aligned, duration, locale, minValue, maxValue);
}

export function constrainStart(
  date: CalendarDate,
  aligned: CalendarDate,
  duration: DateDuration,
  locale: string,
  minValue?: DateValue | null,
  maxValue?: DateValue | null,
): CalendarDate {
  if (minValue && date.compare(minValue) >= 0) {
    const newDate = maxDate(aligned, alignStart(toCalendarDate(minValue), duration, locale));
    if (newDate) aligned = newDate;
  }
  if (maxValue && date.compare(maxValue) <= 0) {
    const newDate = minDate(aligned, alignEnd(toCalendarDate(maxValue), duration, locale));
    if (newDate) aligned = newDate;
  }
  return aligned;
}

export function constrainValue(date: CalendarDate, minValue?: DateValue | null, maxValue?: DateValue | null): CalendarDate {
  if (minValue) {
    const newDate = maxDate(date, toCalendarDate(minValue));
    if (newDate) date = newDate;
  }
  if (maxValue) {
    const newDate = minDate(date, toCalendarDate(maxValue));
    if (newDate) date = newDate;
  }
  return date;
}

export function previousAvailableDate(date: CalendarDate, minValue: DateValue, isDateUnavailable?: (date: CalendarDate) => boolean): CalendarDate | null {
  if (!isDateUnavailable) return date;
  while (date.compare(minValue) >= 0 && isDateUnavailable(date)) date = date.subtract({ days: 1 });
  return date.compare(minValue) >= 0 ? date : null;
}

export function isEqualDuration(a: DateDuration, b: DateDuration): boolean {
  if (a === b) return true;
  return a.days === b.days && a.weeks === b.weeks && a.months === b.months && a.years === b.years;
}

function unitDuration(duration: DateDuration): DateDuration {
  const unit: DateDuration = { ...duration };
  for (const key in duration) unit[key as keyof DateDuration] = 1;
  return unit;
}

// ---------------------------------------------------------------------------------------------
// Construction

function displayCalendar(locale: string, createCalendar?: (id: CalendarIdentifier) => Calendar): { id: CalendarIdentifier; timeZone: string } {
  const resolved = new DateFormatter(locale).resolvedOptions();
  const id = (createCalendar ?? createAnyCalendar)(resolved.calendar as CalendarIdentifier).identifier;
  return { id, timeZone: resolved.timeZone };
}

/** The display calendar of `state`. */
export function getCalendar(state: Pick<StateBase, "calendar" | "createCalendar">): Calendar {
  return (state.createCalendar ?? createAnyCalendar)(state.calendar);
}

const toDisplay = (state: Pick<StateBase, "calendar" | "createCalendar">, value: DateValue): CalendarDate => {
  const date = toCalendarDate(value);
  return date.calendar.identifier === state.calendar && !state.createCalendar ? date : toCalendar(date, getCalendar(state));
};

/** Parse a display-calendar date string of the state. */
export function readDate(state: Pick<StateBase, "calendar" | "createCalendar">, text: DateValueString): CalendarDate {
  return toDisplay(state, parseDateValue(text) as DateValue);
}

const writeDate = (date: CalendarDate): DateValueString => stringifyDateValue(toCalendar(date, new GregorianCalendar()));

const parseInput = (value: DateInput | null | undefined): DateValue | null =>
  value == null ? null : typeof value === "string" ? (parseDateValue(value) as DateValue) : value;

function baseState(
  options: CalendarPropsBase & { locale?: string; createCalendar?: (id: CalendarIdentifier) => Calendar; visibleDuration?: DateDuration; id?: string },
  first: DateValue | null,
  alignment: "start" | "center" | "end" | undefined,
  effectiveMin: DateValue | null,
  effectiveMax: DateValue | null,
): Omit<StateBase, "focused" | "start" | "focusControlled"> & { focusedDate: CalendarDate; startDate: CalendarDate } {
  const locale = resolveLocale(options.locale);
  const { id: calendar, timeZone: runtimeZone } = displayCalendar(locale, options.createCalendar);
  const visibleDuration = options.visibleDuration ?? { months: 1 };
  const timeZone = first && "timeZone" in first ? first.timeZone : runtimeZone;
  const ctx = { calendar, createCalendar: options.createCalendar };
  const minValue = toDateValueString(options.minValue),
    maxValue = toDateValueString(options.maxValue);
  const focusedProp = options.focusedValue;
  const { isDisabled: disabled, isReadOnly: readOnly, isInvalid: invalid } = options;
  const defaultFocused = parseInput(isSignal(focusedProp) ? untrack(focusedProp) : (focusedProp ?? options.defaultFocusedValue));
  const focusedDate = constrainValue(
    defaultFocused ? toDisplay(ctx, defaultFocused) : first ? toDisplay(ctx, first) : toCalendar(today(timeZone), getCalendar(ctx)),
    effectiveMin,
    effectiveMax,
  );
  const startDate =
    alignment === "start"
      ? alignStart(focusedDate, visibleDuration, locale, effectiveMin, effectiveMax)
      : alignment === "end"
        ? alignEnd(focusedDate, visibleDuration, locale, effectiveMin, effectiveMax)
        : alignCenter(focusedDate, visibleDuration, locale, effectiveMin, effectiveMax);
  return {
    id: options.id ?? resumedId(),
    locale,
    calendar,
    ...(options.createCalendar ? { createCalendar: options.createCalendar } : {}),
    timeZone,
    visibleDuration,
    pageBehavior: options.pageBehavior ?? "visible",
    ...(options.firstDayOfWeek ? { firstDayOfWeek: options.firstDayOfWeek } : {}),
    ...(options.weeksInMonth ? { weeksInMonth: options.weeksInMonth } : {}),
    isDisabled: typeof disabled === "function" ? !!untrack(disabled) : (disabled ?? false),
    isReadOnly: typeof readOnly === "function" ? !!untrack(readOnly) : (readOnly ?? false),
    ...(typeof disabled === "function" ? { disabled } : {}),
    ...(typeof readOnly === "function" ? { readOnly } : {}),
    ...(typeof invalid === "function" ? { invalid } : {}),
    invalidProp: (typeof invalid !== "function" && !!invalid) || options.validationState === "invalid",
    minValue,
    maxValue,
    ...(options.onFocusChange ? { onFocusChange: options.onFocusChange } : {}),
    isFocused: signal(options.autoFocus ?? false),
    hoveredCell: signal<string | null>(null),
    pressedCell: signal<string | null>(null),
    focusVisibleCell: signal<string | null>(null),
    strings: getStringsForLocale(calendarMessages, locale),
    focusedDate,
    startDate,
  };
}

/** `useCalendarState`: state of a Calendar (single or multiple selection). */
export function createCalendarState<T extends DateValue = DateValue, M extends CalendarSelectionMode = "single">(
  options: CalendarStateOptions<T, M> = {},
): CalendarState {
  const selectionMode: CalendarSelectionMode = options.selectionMode ?? "single";
  const valueProp = options.value as unknown;
  const toText = (input: unknown): DateValueString | null | DateValueString[] =>
    Array.isArray(input) ? (input as DateInput[]).map((v) => toDateValueString(v)!) : toDateValueString(input as DateInput | null | undefined);
  // A plain controlled value is the state's starting value (Rivet: the signal form is two-way).
  const initial = isSignal(valueProp) ? untrack(valueProp) : valueProp !== undefined ? toText(valueProp) : toText(options.defaultValue);
  const value = (isSignal(valueProp) ? valueProp : signal(initial ?? (selectionMode === "multiple" ? [] : null))) as CalendarState["value"];
  const firstString = Array.isArray(initial) ? initial[0] : initial;
  const first = firstString ? (parseDateValue(firstString) as DateValue) : null;
  const min = parseInput(options.minValue),
    max = parseInput(options.maxValue);
  const { focusedDate, startDate, ...base } = baseState(options, first, options.selectionAlignment, min, max);
  const state: CalendarState = {
    ...base,
    mode: "single",
    selectionMode,
    value,
    focused: isSignal(options.focusedValue) ? options.focusedValue : signal(writeDate(focusedDate)),
    start: signal(writeDate(startDate)),
    focusControlled: isSignal(options.focusedValue),
    ...(options.isDateUnavailable ? { isDateUnavailable: options.isDateUnavailable } : {}),
    ...(options.onChange ? { onChange: options.onChange as (value: never) => void } : {}),
  };
  return state;
}

/** `useRangeCalendarState`: state of a RangeCalendar. */
export function createRangeCalendarState<T extends DateValue = DateValue>(options: RangeCalendarStateOptions<T> = {}): RangeCalendarState {
  const valueProp = options.value;
  const toText = (range: RangeValue<T | DateValueString> | null | undefined): RangeValue<DateValueString> | null =>
    range ? { start: toDateValueString(range.start)!, end: toDateValueString(range.end)! } : null;
  // A plain controlled value is the state's starting value (Rivet: the signal form is two-way).
  const initial = isSignal(valueProp) ? untrack(valueProp) : toText((valueProp !== undefined ? valueProp : options.defaultValue) as RangeValue<T | DateValueString> | null | undefined);
  const value = isSignal(valueProp) ? valueProp : signal<RangeValue<DateValueString> | null>(initial);
  const locale = resolveLocale(options.locale);
  const visibleDuration = options.visibleDuration ?? { months: 1 };
  const min = parseInput(options.minValue),
    max = parseInput(options.maxValue);
  let alignment: "center" | "start" = "center";
  if (initial && initial.start && initial.end) {
    const start = alignCenter(toCalendarDate(parseDateValue(initial.start) as DateValue), visibleDuration, locale, min, max);
    const end = start.add(visibleDuration).subtract({ days: 1 });
    if ((parseDateValue(initial.end) as DateValue).compare(end) > 0) alignment = "start";
  }
  const first = initial?.start ? (parseDateValue(initial.start) as DateValue) : null;
  const { focusedDate, startDate, ...base } = baseState({ ...options, locale }, first, options.selectionAlignment ?? alignment, min, max);
  return {
    ...base,
    mode: "range",
    value,
    anchor: signal<DateValueString | null>(null),
    dragging: signal(false),
    allowsNonContiguousRanges: options.allowsNonContiguousRanges ?? false,
    focused: isSignal(options.focusedValue) ? options.focusedValue : signal(writeDate(focusedDate)),
    start: signal(writeDate(startDate)),
    focusControlled: isSignal(options.focusedValue),
    ...(options.isDateUnavailable ? { rangeUnavailable: options.isDateUnavailable } : {}),
    ...(options.onChange ? { onChange: options.onChange as (value: never) => void } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Derived values (reactive reads)

/** Props-level min (string → value). */
export const minValueOf = (state: StateBase): DateValue | null => (state.minValue ? (parseDateValue(state.minValue) as DateValue) : null);
export const maxValueOf = (state: StateBase): DateValue | null => (state.maxValue ? (parseDateValue(state.maxValue) as DateValue) : null);

/** Range calendar: the anchor date. Reads `anchor`. */
export function anchorDate(state: AnyCalendarState): CalendarDate | null {
  if (state.mode !== "range") return null;
  const anchor = state.anchor();
  return anchor ? readDate(state, anchor) : null;
}

/** `isDateUnavailable` as the inner calendar sees it (range: bound to the anchor). Reads `anchor`. */
export function unavailablePredicate(state: AnyCalendarState): ((date: CalendarDate) => boolean) | undefined {
  if (state.mode === "single") return state.isDateUnavailable;
  const fn = state.rangeUnavailable;
  if (!fn) return undefined;
  const anchor = anchorDate(state);
  return (date) => fn(date, anchor);
}

function nextUnavailableDate(
  anchor: CalendarDate,
  isDateUnavailable: (date: CalendarDate) => boolean,
  visibleDuration: DateDuration,
  dir: number,
): CalendarDate | undefined {
  let nextDate = anchor.add({ days: dir });
  const lo = anchor.subtract(visibleDuration),
    hi = anchor.add(visibleDuration);
  while ((dir < 0 ? nextDate.compare(lo) >= 0 : nextDate.compare(hi) <= 0) && !isDateUnavailable(nextDate)) nextDate = nextDate.add({ days: dir });
  if (isDateUnavailable(nextDate)) return nextDate.add({ days: -dir });
  return undefined;
}

function availableRangeFor(state: RangeCalendarState, anchor: CalendarDate | null): { start?: CalendarDate; end?: CalendarDate } | null {
  const fn = state.rangeUnavailable;
  if (anchor && fn && !state.allowsNonContiguousRanges) {
    const isUnavailable = (date: CalendarDate) => fn(date, anchor);
    return {
      start: nextUnavailableDate(anchor, isUnavailable, state.visibleDuration, -1),
      end: nextUnavailableDate(anchor, isUnavailable, state.visibleDuration, 1),
    };
  }
  return null;
}

/**
 * Range calendar: the range available around the anchor. Reads `anchor` only when it can narrow
 * anything (`isDateUnavailable` without `allowsNonContiguousRanges`): Rivet (resume) — a page button
 * or grid reading it would otherwise be re-created on the first anchor change of a resumed page.
 */
export function availableRange(state: AnyCalendarState): { start?: CalendarDate; end?: CalendarDate } | null {
  if (state.mode !== "range" || !state.rangeUnavailable || state.allowsNonContiguousRanges) return null;
  return availableRangeFor(state, anchorDate(state));
}

/** Effective min (range: narrowed to the available range). Reads `anchor`. */
export function effectiveMin(state: AnyCalendarState): DateValue | null {
  const min = minValueOf(state);
  if (state.mode !== "range") return min;
  return maxDate(min, availableRange(state)?.start) ?? null;
}
/** Effective max. Reads `anchor`. */
export function effectiveMax(state: AnyCalendarState): DateValue | null {
  const max = maxValueOf(state);
  if (state.mode !== "range") return max;
  return minDate(max, availableRange(state)?.end) ?? null;
}

/** The currently focused date (constrained to min / max). Reads `focused` (+ `anchor`). */
export function focusedDate(state: AnyCalendarState): CalendarDate {
  return constrainValue(readDate(state, state.focused()), effectiveMin(state), effectiveMax(state));
}

function endFor(state: StateBase, start: CalendarDate): CalendarDate {
  const duration = { ...state.visibleDuration };
  if (duration.days) duration.days--;
  else duration.days = -1;
  return start.add(duration);
}

/** First visible date, corrected so the focused date is visible (React Stately's render-time correction). Reads `start`, `focused`. */
function correctedStart(state: AnyCalendarState): CalendarDate {
  const start = readDate(state, state.start());
  const focused = focusedDate(state);
  const min = effectiveMin(state),
    max = effectiveMax(state);
  if (focused.compare(start) < 0) return alignEnd(focused, state.visibleDuration, state.locale, min, max);
  if (focused.compare(endFor(state, start)) > 0) return alignStart(focused, state.visibleDuration, state.locale, min, max);
  return start;
}

/**
 * First visible date. Rivet (resume): every focus write inside the calendar keeps `start` corrected
 * (`syncStart`), so an uncontrolled focus reads `start` only; a `focusedValue` signal may be written from
 * outside, so it reads the corrected start (`start`, `focused`). On a resumed page a binding wakes on the
 * first change of any signal it read on the server (not the computed it read through): the grid rows,
 * weekday header and page buttons depending on `focused` would be re-created on the first focus move /
 * range anchor, replacing the focused cell.
 */
export function visibleStart(state: AnyCalendarState): CalendarDate {
  return state.focusControlled ? correctedStart(state) : readDate(state, state.start());
}

/** The date range that is currently visible. Reads `start` (+ `focused` when focus is controlled). */
export function visibleRange(state: AnyCalendarState): RangeValue<CalendarDate> {
  const start = visibleStart(state);
  return { start, end: endFor(state, start) };
}

/** Selected value in the display calendar (single: date or null; multiple: dates; range: `{start, end}` of the value). Reads `value`. */
export function calendarValue(state: CalendarState): CalendarDate | null | CalendarDate[] {
  const value = state.value();
  if (Array.isArray(value)) return value.map((v) => toDisplay(state, parseDateValue(v) as DateValue));
  return value ? toDisplay(state, parseDateValue(value) as DateValue) : null;
}

/** Range value in the display calendar. Reads `value`. */
export function rangeValue(state: RangeCalendarState): RangeValue<CalendarDate> | null {
  const value = state.value();
  return value && value.start && value.end
    ? { start: toDisplay(state, parseDateValue(value.start) as DateValue), end: toDisplay(state, parseDateValue(value.end) as DateValue) }
    : null;
}

/** Range value as the original date values (calendar + time kept). Reads `value`. */
export function rangeDateValue(state: RangeCalendarState): RangeValue<DateValue> | null {
  const value = state.value();
  return value && value.start && value.end ? { start: parseDateValue(value.start) as DateValue, end: parseDateValue(value.end) as DateValue } : null;
}

function makeRange(start: DateValue | null | undefined, end: DateValue | null | undefined): RangeValue<CalendarDate> | null {
  if (!start || !end) return null;
  if (end.compare(start) < 0) [start, end] = [end, start];
  return { start: toCalendarDate(start), end: toCalendarDate(end) };
}

/** Range calendar: the highlighted range (anchor → focused while selecting, else the value). Reads `anchor`, `focused`, `value`. */
export function highlightedRange(state: AnyCalendarState): RangeValue<CalendarDate> | null {
  if (state.mode !== "range") return null;
  const anchor = anchorDate(state);
  if (anchor) return makeRange(anchor, focusedDate(state));
  const value = rangeValue(state);
  return value && makeRange(value.start, value.end);
}

/** Whether the calendar is disabled now (its live `isDisabled` accessor, else the creation value). Reads. */
export const isCalendarDisabled = (state: AnyCalendarState): boolean => (state.disabled ? !!state.disabled() : state.isDisabled);
/** Whether the calendar is read-only now. Reads. */
export const isCalendarReadOnly = (state: AnyCalendarState): boolean => (state.readOnly ? !!state.readOnly() : state.isReadOnly);

/** Whether the selection is invalid (unavailable / outside min-max, or `isInvalid`). */
export function isValueInvalid(state: AnyCalendarState): boolean {
  if (state.invalidProp || (state.invalid && state.invalid())) return true;
  const min = minValueOf(state),
    max = maxValueOf(state);
  if (state.mode === "range") {
    const value = rangeValue(state);
    if (!value || hasAnchor(state)) return false;
    const fn = unavailablePredicate(state);
    if (fn && (fn(value.start) || fn(value.end))) return true;
    return isInvalid(value.start, min, max) || isInvalid(value.end, min, max);
  }
  const value = calendarValue(state);
  if (!value) return false;
  const fn = state.isDateUnavailable;
  if (Array.isArray(value)) return value.some((date) => fn?.(date) || isInvalid(date, min, max));
  return !!fn?.(value) || isInvalid(value, min, max);
}
const hasAnchor = (state: RangeCalendarState): boolean => state.anchor() != null;

/** Deprecated `validationState`. */
export const validationState = (state: AnyCalendarState): "invalid" | null => (isValueInvalid(state) ? "invalid" : null);

// ---------------------------------------------------------------------------------------------
// Focus movement

const peek = <T>(fn: () => T): T => untrack(fn);

/** Write the focused date (+ the corrections React Stately applies on the next render). */
function writeFocused(state: AnyCalendarState, date: CalendarDate): void {
  const previous = peek(() => readDate(state, state.focused()));
  if (!isSameDay(previous, date) || previous.calendar.identifier !== date.calendar.identifier) {
    state.focused.set(writeDate(date));
    state.onFocusChange?.(date);
  }
  syncStart(state);
}

/** Keep `start` covering the focused date (React Stately's render-time correction). */
function syncStart(state: AnyCalendarState): void {
  const corrected = peek(() => writeDate(correctedStart(state)));
  if (corrected !== peek(state.start)) state.start.set(corrected);
}

function focusCell(state: AnyCalendarState, date: CalendarDate): void {
  writeFocused(
    state,
    constrainValue(
      date,
      peek(() => effectiveMin(state)),
      peek(() => effectiveMax(state)),
    ),
  );
}

/** Sets the focused date. */
export const setFocusedDate = (state: AnyCalendarState, date: CalendarDate): void => focusCell(state, date);
/** Sets whether focus is within the calendar. */
export const setFocused = (state: AnyCalendarState, value: boolean): void => {
  state.isFocused.set(value);
};

/** Moves focus to the next calendar date. */
export function focusNextDay(state: AnyCalendarState): void {
  focusCell(state, peek(() => focusedDate(state)).add({ days: 1 }));
}
/** Moves focus to the previous calendar date. */
export function focusPreviousDay(state: AnyCalendarState): void {
  focusCell(state, peek(() => focusedDate(state)).subtract({ days: 1 }));
}
/** Moves focus to the next row of dates, e.g. the next week. */
export function focusNextRow(state: AnyCalendarState): void {
  const d = state.visibleDuration;
  if (d.days) focusNextPage(state);
  else if (d.weeks || d.months || d.years) focusCell(state, peek(() => focusedDate(state)).add({ weeks: 1 }));
}
/** Moves focus to the previous row of dates. */
export function focusPreviousRow(state: AnyCalendarState): void {
  const d = state.visibleDuration;
  if (d.days) focusPreviousPage(state);
  else if (d.weeks || d.months || d.years) focusCell(state, peek(() => focusedDate(state)).subtract({ weeks: 1 }));
}

const pageDuration = (state: AnyCalendarState): DateDuration =>
  state.pageBehavior === "visible" ? state.visibleDuration : unitDuration(state.visibleDuration);

function page(state: AnyCalendarState, dir: 1 | -1): void {
  const duration = pageDuration(state);
  const { focused, startDate, min, max } = peek(() => ({
    focused: focusedDate(state),
    startDate: visibleStart(state),
    min: effectiveMin(state),
    max: effectiveMax(state),
  }));
  const start = dir > 0 ? startDate.add(duration) : startDate.subtract(duration);
  const nextFocused = constrainValue(dir > 0 ? focused.add(duration) : focused.subtract(duration), min, max);
  state.start.set(writeDate(alignStart(constrainStart(focused, start, duration, state.locale, min, max), duration, state.locale)));
  writeFocused(state, nextFocused);
}
/** Moves focus to the next page of dates, e.g. the next month if one month is visible. */
export const focusNextPage = (state: AnyCalendarState): void => page(state, 1);
/** Moves focus to the previous page of dates. */
export const focusPreviousPage = (state: AnyCalendarState): void => page(state, -1);

/** Moves focus to the start of the current section of dates, e.g. the start of the current month. */
export function focusSectionStart(state: AnyCalendarState): void {
  const d = state.visibleDuration,
    focused = peek(() => focusedDate(state));
  if (d.days)
    focusCell(
      state,
      peek(() => visibleStart(state)),
    );
  else if (d.weeks) focusCell(state, startOfWeek(focused, state.locale));
  else if (d.months || d.years) focusCell(state, startOfMonth(focused));
}
/** Moves focus to the end of the current section of dates. */
export function focusSectionEnd(state: AnyCalendarState): void {
  const d = state.visibleDuration,
    focused = peek(() => focusedDate(state));
  if (d.days)
    focusCell(
      state,
      peek(() => visibleRange(state).end),
    );
  else if (d.weeks) focusCell(state, endOfWeek(focused, state.locale));
  else if (d.months || d.years) focusCell(state, endOfMonth(focused));
}
/** Moves focus to the next section (one displayed unit, or the next larger unit with `larger`). */
export function focusNextSection(state: AnyCalendarState, larger?: boolean): void {
  const d = state.visibleDuration,
    focused = peek(() => focusedDate(state));
  if (!larger && !d.days) return focusCell(state, focused.add(unitDuration(d)));
  if (d.days) focusNextPage(state);
  else if (d.weeks) focusCell(state, focused.add({ months: 1 }));
  else if (d.months || d.years) focusCell(state, focused.add({ years: 1 }));
}
/** Moves focus to the previous section. */
export function focusPreviousSection(state: AnyCalendarState, larger?: boolean): void {
  const d = state.visibleDuration,
    focused = peek(() => focusedDate(state));
  if (!larger && !d.days) return focusCell(state, focused.subtract(unitDuration(d)));
  if (d.days) focusPreviousPage(state);
  else if (d.weeks) focusCell(state, focused.subtract({ months: 1 }));
  else if (d.months || d.years) focusCell(state, focused.subtract({ years: 1 }));
}

// ---------------------------------------------------------------------------------------------
// Selection

function originalCalendarOf(state: CalendarState): DateValue | null {
  const raw = peek(state.value as () => DateValueString | DateValueString[] | null);
  const first = Array.isArray(raw) ? raw[0] : raw;
  return first ? (parseDateValue(first) as DateValue) : null;
}

/** Emit `date` in the calendar of the original value (default Gregorian), keeping its time. */
function convertValue(date: CalendarDate, oldValue?: DateValue | null): DateValue {
  const converted = toCalendar(date, oldValue?.calendar || new GregorianCalendar());
  if (oldValue && "hour" in oldValue) return oldValue.set(converted);
  return converted;
}

function normalizeValue(state: CalendarState, newValue: CalendarDate): DateValue | null {
  const { min, max, startDate } = peek(() => ({ min: effectiveMin(state), max: effectiveMax(state), startDate: visibleStart(state) }));
  const constrained = constrainValue(newValue, min, max);
  const lowerBound = min ?? minDate(constrained, startDate)!;
  const prev = previousAvailableDate(constrained, lowerBound, state.isDateUnavailable);
  if (!prev) return null;
  return convertValue(prev, originalCalendarOf(state));
}

function emit(state: CalendarState, next: DateValue | DateValue[] | null): void {
  const before = peek(state.value as Signal<unknown>);
  const text = Array.isArray(next) ? next.map((v) => stringifyDateValue(v)) : stringifyDateValue(next);
  if (next === null && (before === null || (Array.isArray(before) && before.length === 0 && Array.isArray(text)))) return;
  // A read-only accessor (live controlled `value`, string form) is never written: only `onChange` reports.
  if (isWritable(state.value)) (state.value as Signal<unknown>).set(text);
  (state.onChange as ((value: unknown) => void) | undefined)?.(next);
}

/** Sets the selected value (React Stately `setValue`). */
export function setValue(state: CalendarState, newValue: CalendarDate | CalendarDate[] | null): void {
  if (isCalendarDisabled(state) || isCalendarReadOnly(state)) return;
  if (newValue === null) return emit(state, state.selectionMode === "multiple" ? [] : null);
  if (Array.isArray(newValue))
    emit(
      state,
      newValue.map((d) => normalizeValue(state, d)).filter((v): v is DateValue => !!v),
    );
  else {
    const local = normalizeValue(state, newValue);
    if (local) emit(state, local);
  }
}

/** Selects the given date (range: anchors or completes the range). */
export function selectDate(state: AnyCalendarState, date: CalendarDate): void {
  if (state.mode === "range") return selectRangeDate(state, date);
  if (isCalendarDisabled(state) || isCalendarReadOnly(state)) return;
  if (state.selectionMode === "multiple" && date != null) {
    const newDate = normalizeValue(state, date);
    if (!newDate) return;
    const raw = peek(state.value as Signal<DateValueString | DateValueString[] | null>);
    const base: DateValue[] = Array.isArray(raw) ? raw.map((v) => parseDateValue(v) as DateValue) : raw != null ? [parseDateValue(raw) as DateValue] : [];
    const index = base.findIndex((value) => isSameDay(value, newDate));
    emit(state, index >= 0 ? base.slice(0, index).concat(base.slice(index + 1)) : [...base, newDate]);
  } else setValue(state, date);
}

/** Selects the currently focused date (unless unavailable). */
export function selectFocusedDate(state: AnyCalendarState): void {
  const focused = peek(() => focusedDate(state));
  if (state.mode === "range") {
    if (!peek(() => isCellUnavailable(state, focused))) selectRangeDate(state, focused);
    return;
  }
  if (!(state.isDateUnavailable && state.isDateUnavailable(focused))) selectDate(state, focused);
}

// Range selection ------------------------------------------------------------------------------

function selectRangeDate(state: RangeCalendarState, date: CalendarDate): void {
  if (isCalendarReadOnly(state)) return;
  const { min, max, startDate, unavailable, anchor } = peek(() => ({
    min: effectiveMin(state),
    max: effectiveMax(state),
    startDate: visibleStart(state),
    unavailable: unavailablePredicate(state),
    anchor: anchorDate(state),
  }));
  const constrainedDate = constrainValue(date, min, max);
  const previous = previousAvailableDate(constrainedDate, startDate, unavailable);
  if (!previous) return;
  if (!anchor) setAnchorDate(state, previous);
  else {
    const range = makeRange(anchor, previous);
    if (range) {
      const old = peek(() => rangeDateValue(state));
      const next = { start: convertValue(range.start, old?.start), end: convertValue(range.end, old?.end) };
      if (isWritable(state.value)) state.value.set({ start: stringifyDateValue(next.start), end: stringifyDateValue(next.end) });
      (state.onChange as ((value: unknown) => void) | undefined)?.(next);
    }
    setAnchorDate(state, null);
  }
}

/** Sets the range selection anchor. */
export function setAnchorDate(state: AnyCalendarState, date: CalendarDate | null): void {
  if (state.mode !== "range") return;
  state.anchor.set(date ? writeDate(date) : null);
  // Effective min / max follow the anchor: re-apply the focus constraints.
  const focused = peek(() => focusedDate(state));
  writeFocused(state, focused);
}

/** Range: sets the value (React Stately `setValue`). */
export function setRangeValue(state: RangeCalendarState, value: RangeValue<DateValue> | null): void {
  if (isWritable(state.value)) state.value.set(value ? { start: stringifyDateValue(value.start), end: stringifyDateValue(value.end) } : null);
  (state.onChange as ((value: unknown) => void) | undefined)?.(value);
}

/** Highlights the given date during range selection (hover / drag). */
export function highlightDate(state: AnyCalendarState, date: CalendarDate): void {
  if (state.mode === "range" && peek(state.anchor)) setFocusedDate(state, date);
}

/** Commits the current selection (selects the focused date). */
export function commitSelection(state: AnyCalendarState): void {
  if (state.mode === "range")
    selectRangeDate(
      state,
      peek(() => focusedDate(state)),
    );
}

/** Clears the current selection. */
export function clearSelection(state: AnyCalendarState): void {
  if (state.mode !== "range") return;
  setAnchorDate(state, null);
  setRangeValue(state, null);
}

/** Sets whether the user is dragging over the calendar. */
export function setDragging(state: AnyCalendarState, value: boolean): void {
  if (state.mode === "range") state.dragging.set(value);
}

/** Focuses the next available day before or after `anchor`. */
export function focusNearestAvailableDate(state: AnyCalendarState, anchor: CalendarDate): void {
  if (state.mode !== "range") return;
  const range = availableRangeFor(state, anchor);
  const isDateInvalid = (date: CalendarDate) => peek(() => isInvalidDate(state, date)) || isInvalid(date, range?.start, range?.end);
  let nextDay = anchor.add({ days: 1 });
  if (isDateInvalid(nextDay)) nextDay = anchor.subtract({ days: 1 });
  if (!isDateInvalid(nextDay)) {
    setFocusedDate(state, nextDay);
    setFocused(state, true);
  }
}

// ---------------------------------------------------------------------------------------------
// Cell queries (reactive reads)

/** Whether the date is outside min / max (range: also outside the available range). */
export function isInvalidDate(state: AnyCalendarState, date: CalendarDate): boolean {
  const invalid = isInvalid(date, effectiveMin(state), effectiveMax(state));
  if (state.mode !== "range") return invalid;
  const range = availableRange(state);
  return invalid || isInvalid(date, range?.start, range?.end);
}

/** Whether the date is currently selected. */
export function isSelected(state: AnyCalendarState, date: CalendarDate): boolean {
  if (state.mode === "range") {
    const range = highlightedRange(state);
    return Boolean(range && date.compare(range.start) >= 0 && date.compare(range.end) <= 0 && !isCellDisabled(state, date) && !isCellUnavailable(state, date));
  }
  const value = calendarValue(state);
  if (!value || isCellDisabled(state, date) || isCellUnavailable(state, date)) return false;
  return Array.isArray(value) ? value.some((v) => isSameDay(v, date)) : isSameDay(date, value);
}

/** Whether the date is focused (focus within the grid). */
export function isCellFocused(state: AnyCalendarState, date: CalendarDate): boolean {
  return state.isFocused() && isSameDay(date, focusedDate(state));
}

/** Whether the date is disabled (min / max, outside the visible range, or `isDisabled`). */
export function isCellDisabled(state: AnyCalendarState, date: CalendarDate): boolean {
  const range = visibleRange(state);
  // The range calendar's base cells use the base `isInvalid` (min / max narrowed by the anchor).
  const invalid = isInvalid(date, effectiveMin(state), effectiveMax(state));
  return isCalendarDisabled(state) || date.compare(range.start) < 0 || date.compare(range.end) > 0 || invalid;
}

/** Whether the date is unavailable (`isDateUnavailable`). */
export function isCellUnavailable(state: AnyCalendarState, date: CalendarDate): boolean {
  const fn = unavailablePredicate(state);
  return fn ? fn(date) : false;
}

/** Whether the previous visible range is out of bounds. */
export function isPreviousVisibleRangeInvalid(state: AnyCalendarState): boolean {
  const start = visibleRange(state).start;
  const prev = start.subtract({ days: 1 });
  return isSameDay(prev, start) || isInvalidDate(state, prev);
}

/** Whether the next visible range is out of bounds. */
export function isNextVisibleRangeInvalid(state: AnyCalendarState): boolean {
  const end = visibleRange(state).end;
  // Adding may return the same date if we reached the end of time (e.g. 9999-12-31).
  const next = end.add({ days: 1 });
  return isSameDay(next, end) || isInvalidDate(state, next);
}

/** Dates in week `weekIndex` from `from` (default: the first visible date); null where the calendar system has no date. */
export function getDatesInWeek(state: AnyCalendarState, weekIndex: number, from?: CalendarDate): (CalendarDate | null)[] {
  let date = (from ?? visibleStart(state)).add({ weeks: weekIndex });
  const dates: (CalendarDate | null)[] = [];
  const d = state.visibleDuration;
  const days = d.days && d.days < 7 ? d.days : 7;
  if (days === 7) {
    date = startOfWeek(date, state.locale, state.firstDayOfWeek);
    // startOfWeek clamps within the calendar system's range, which may start mid-week.
    const dayOfWeek = getDayOfWeek(date, state.locale, state.firstDayOfWeek);
    for (let i = 0; i < dayOfWeek; i++) dates.push(null);
  }
  while (dates.length < days) {
    dates.push(date);
    const nextDate = date.add({ days: 1 });
    if (isSameDay(date, nextDate)) break; // end of the calendar system
    date = nextDate;
  }
  while (dates.length < days) dates.push(null);
  return dates;
}

/** Number of weeks displayed for the month of `from` (default: the first visible date). */
export function getWeeksInMonth(state: AnyCalendarState, from?: CalendarDate): number {
  let weeks = state.weeksInMonth || weeksIn(from ?? visibleStart(state), state.locale, state.firstDayOfWeek);
  const d = state.visibleDuration;
  if (d.weeks || d.days) {
    weeks = d.weeks ?? 0;
    if (d.days) weeks += Math.ceil(d.days / 7);
  }
  return weeks;
}

/** Format a localized string of the calendar. */
export const message = (state: StateBase, key: CalendarMessageKey, variables?: Record<string, string>): string => formatString(state.strings[key], variables);

export { CalendarDate };
