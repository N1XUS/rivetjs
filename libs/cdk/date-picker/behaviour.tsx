// Ported from react-aria (react-spectrum) src/datepicker/useDatePicker.ts, useDateRangePicker.ts and
// useDatePickerGroup.ts, Apache-2.0, © Adobe.
// Rivet:
// - Naming: `useDatePicker` → `datePickerProps(props, state)` ({ groupProps, labelProps, fieldProps, buttonProps,
//   dialogProps, calendarProps, descriptionProps, errorMessageProps, isInvalid, validationErrors,
//   validationDetails }), `useDateRangePicker` → `dateRangePickerProps` (`startFieldProps` / `endFieldProps`).
//   State-dependent values are accessors; handlers are free functions `(event, state)`. `.tsx`: the closures resume.
// - `fieldProps` carry the picker's field state (`pickerField`, sharing the picker's value: React Aria passes
//   `value` / `onChange`) and `forward` (a resumed page runs only the nearest element's handler of an event: the
//   field forwards its keydown / focusin / focusout to the picker group's logic).
// - `calendarProps` values the Calendar reads when it renders (each open) are accessors: `defaultValue`,
//   `defaultFocusedValue`, `isInvalid` (React Aria: `value` / `onChange` of the current render).
// - Ids derive from the picker's base id (`<id>-label`, `<id>-field` / `-start` / `-end`, `<id>-button`,
//   `<id>-dialog` …). On open, focus moves to the calendar's focused cell (RAC Calendar `autoFocus`).
// Deviation: closing commits (`commitOnClose`, React Stately `setOpen(false)`) from the component (`PickerCommit` in
// index.tsx, mounted while open), so Escape / outside press commit like the state's `setOpen`.
import { untrack } from "@rivetjs/reactivity";
import { createFocusManager, focusSafely } from "@rivetjs/cdk/focus";
import { isFocusVisible, syncModalityFromFocus } from "@rivetjs/cdk/interactions/focus-visible";
import { createSlotId, slotIdRef } from "../slots/index.tsx";
import { labelsProps } from "../label/behaviour.ts";
import { displayValidation, type ValidationResult } from "../state/form-validation.ts";
import {
  dateGroupPointerDown,
  dateGroupPointerUp,
  syncFieldInput,
  arrowNavigation,
  message,
  wasHandled,
  focusWithinEvent,
  onceFor,
  ownerFlag,
  ownerFlagAttr,
  type AriaDateFieldOptions,
  type FocusWithinHandlers,
} from "../date-field/behaviour.tsx";
import { createPickerFieldState, ownerDisabled, ownerReadOnly, type DateFieldState, type DateValue } from "../state/date-field.ts";
import {
  dateRange,
  dateValue,
  formatValue,
  isInvalid as pickerIsInvalid,
  setDateRange,
  setDateValue,
  setOpen,
  type AnyDatePickerState,
  type DatePickerState,
  type DateRangePickerState,
  type RangeValue,
} from "../state/date-picker.ts";
import { stringifyDateValue, type CalendarDate, type DateValueString } from "@rivetjs/cdk/date";

export const labelId = (state: AnyDatePickerState): string => state.id + "-label";
export const buttonId = (state: AnyDatePickerState): string => state.id + "-button";
export const dialogId = (state: AnyDatePickerState): string => state.id + "-dialog";
/** The selected-value description (React Aria `useDescription`). */
export const valueDescriptionId = (state: AnyDatePickerState): string => state.id + "-value";
/** DatePicker field id; DateRangePicker: `<id>-start` / `<id>-end`. */
export const fieldId = (state: AnyDatePickerState, part?: "start" | "end"): string => state.id + "-" + (part ?? "field");

/** The selected-value description (`Selected Date: …` / `Selected Range: … to …`). Reads. */
export function pickerValueDescription(state: AnyDatePickerState): string {
  if (state.kind === "range") {
    const range = formatValue(state, state.locale, { month: "long" });
    return range ? message(state.locale, "selectedRangeDescription", { startDate: range.start, endDate: range.end }) : "";
  }
  const date = formatValue(state, state.locale, { month: "long" });
  return date ? message(state.locale, "selectedDateDescription", { date }) : "";
}

/**
 * keydown in the group (useDatePickerGroup + useDatePicker): Alt+ArrowDown / Alt+ArrowUp open the
 * popover; ArrowLeft / ArrowRight move between the segments and the button. A segment's own keys
 * (handled by its field) are skipped. Runs on the group and forwarded by the fields.
 */
export function datePickerGroupKeyDown(event: KeyboardEvent, state: AnyDatePickerState): void {
  if (untrack(state.isOpen) || wasHandled(event)) return;
  const group = (event.target as Element).ownerDocument.getElementById(state.id);
  if (!group?.contains(event.target as Node)) return;
  if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(state, true);
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (arrowNavigation(state.locale, group, event.target as HTMLElement, event)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

/** Label click: focus the first segment (DateRangePicker: the start field's). */
export function datePickerLabelClick(event: MouseEvent, state: AnyDatePickerState): void {
  const group = (event.currentTarget as Element).ownerDocument.getElementById(state.id);
  if (group) createFocusManager(() => group, { accept: (element) => element.id !== buttonId(state) }).focusFirst();
}

const pickerRoot = (state: AnyDatePickerState, event: Event): Element | null =>
  (event.target as Element).ownerDocument.getElementById(state.id)?.closest("[data-rv-date-picker]") ?? null;

/** focusin within the picker (RAC useFocusRing({within}) of the root: `data-focus-within`, `data-focus-visible`). */
export function datePickerFocusIn(event: FocusEvent, state: AnyDatePickerState): void {
  syncModalityFromFocus(event.target as Element);
  if (!untrack(state.isFocusWithin)) state.isFocusWithin.set(true);
  const visible = isFocusVisible();
  if (untrack(state.isFocusVisible) !== visible) state.isFocusVisible.set(visible);
}

/** focusout within the picker: focus within ends when focus leaves the root (the portalled popover is outside). */
export function datePickerFocusOut(event: FocusEvent, state: AnyDatePickerState): void {
  if (pickerRoot(state, event)?.contains(event.relatedTarget as Node | null)) return;
  state.isFocusWithin.set(false);
  state.isFocusVisible.set(false);
}

/** The user's FocusableProps of a picker (React Aria useDatePicker: on the group, not while the popover is open). */
export interface PickerUserEvents extends FocusWithinHandlers {
  onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
}

/**
 * The user's handler of a group keydown / focusin / focusout (after the picker's own): once
 * per event (fields forward theirs and client-created events also bubble), skipped while open.
 */
export function datePickerUserEvent(event: Event, state: AnyDatePickerState, user: PickerUserEvents | undefined): void {
  if (!user) return;
  const group = (event.target as Element).ownerDocument.getElementById(state.id);
  if (!group) return;
  const isOpen = untrack(state.isOpen);
  if (event.type === "focusin" || event.type === "focusout") {
    if (group.contains(event.target as Node)) focusWithinEvent(group, event as FocusEvent, user, isOpen);
    return;
  }
  if (isOpen || !group.contains(event.target as Node) || !onceFor(group, event)) return;
  if (event.type === "keydown") user.onKeyDown?.(event as KeyboardEvent);
}

/** Events a picker field forwards to the picker after its own handler (resumed handlers do not bubble to ancestors). */
export function datePickerFieldEvent(event: Event, state: AnyDatePickerState, user?: PickerUserEvents): void {
  if (event.type === "keydown") datePickerGroupKeyDown(event as KeyboardEvent, state);
  else if (event.type === "focusin") datePickerFocusIn(event as FocusEvent, state);
  else if (event.type === "focusout") datePickerFocusOut(event as FocusEvent, state);
  datePickerUserEvent(event, state, user);
}

/** The popover opened: move focus to the calendar's focused cell (RAC Calendar `autoFocus`). */
export function datePickerPopoverOpened(element: Element | null | undefined): void {
  if (!element) return;
  const cell = element.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]');
  if (cell && !cell.contains(element.ownerDocument.activeElement)) focusSafely(cell);
}

/** Sync the hidden inputs of the picker's fields (after a value written from the calendar / on close). */
export function syncPickerInputs(state: AnyDatePickerState, doc: Document): void {
  // Field views over the picker's value (cheap; the inputs show committed values only).
  const parts: ("start" | "end" | undefined)[] = state.kind === "range" ? ["start", "end"] : [undefined];
  for (const part of parts) {
    const link = part ? { owner: state as DateRangePickerState, part } : { owner: state as DatePickerState };
    syncFieldInput(createPickerFieldState(link, { id: fieldId(state, part), locale: state.locale, defaultValue: null }), doc);
  }
}

// useDatePicker / useDateRangePicker --------------------------------------------------------------

type Accessor<T> = () => T;

/** The calendar button's `isDisabled` (disabled or read-only): the creation value, or an accessor while a flag is live. */
function buttonDisabled(state: AnyDatePickerState): Accessor<boolean> | boolean {
  return state.disabled || state.readOnly ? buttonDisabledReader(state) : state.isDisabled || state.isReadOnly;
}
function buttonDisabledReader(state: AnyDatePickerState): Accessor<boolean> {
  return () => ownerDisabled(state) || ownerReadOnly(state);
}

export interface AriaDatePickerOptions extends PickerUserEvents {
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-details"?: string | undefined;
  /** Whether a visible label renders (RAC `useSlot`). */
  label?: boolean | Accessor<boolean> | undefined;
  onKeyUp?: ((event: KeyboardEvent) => void) | undefined;
  name?: string | undefined;
  /** DateRangePicker: the names of the start / end hidden inputs. */
  startName?: string | undefined;
  endName?: string | undefined;
  form?: string | undefined;
  validationBehavior?: "native" | "aria" | undefined;
  /** Calendar props from the picker (forwarded to CalendarContext / RangeCalendarContext). */
  isDateUnavailable?: ((date: CalendarDate, anchorDate?: CalendarDate | null) => boolean) | undefined;
  allowsNonContiguousRanges?: boolean | undefined;
  createCalendar?: unknown;
}

export interface DatePickerAria {
  groupProps: Record<string, unknown>;
  labelProps: Record<string, unknown>;
  /** DatePicker: the DateInput's props (DateFieldContext). */
  fieldProps: AriaDateFieldOptions & { pickerField: DateFieldState };
  buttonProps: Record<string, unknown>;
  dialogProps: Record<string, unknown>;
  calendarProps: Record<string, unknown>;
  descriptionProps: { id: ReturnType<typeof createSlotId> };
  errorMessageProps: { id: ReturnType<typeof createSlotId> };
  isInvalid: Accessor<boolean>;
  validationErrors: Accessor<string[]>;
  validationDetails: Accessor<ValidationResult["validationDetails"]>;
}

export interface DateRangePickerAria extends Omit<DatePickerAria, "fieldProps"> {
  startFieldProps: AriaDateFieldOptions & { pickerField: DateFieldState };
  endFieldProps: AriaDateFieldOptions & { pickerField: DateFieldState };
}

function pickerBase(props: AriaDatePickerOptions, state: AnyDatePickerState) {
  // Locals: a resumable closure reading `props.x` would capture the whole props object.
  const label = props.label;
  // A function (createSlot's `hasSlot`, resumable) or a plain boolean: an arrow made in a ternary would not serialize.
  const labelled = typeof label === "function" ? label : !!label;
  const hasLabel = (): boolean => (typeof labelled === "function" ? labelled() : labelled);
  const ariaLabel = props["aria-label"];
  const ownLabelledBy = props["aria-labelledby"];
  const extraDescribedBy = props["aria-describedby"];
  const isInvalid = () => pickerIsInvalid(state);
  const descriptionId = createSlotId(state.id + "-description");
  const errorId = createSlotId(state.id + "-error", isInvalid);
  // useField: the visible label labels the group; aria-label + aria-labelledby → the group labels itself too.
  const labelledBy = (): string | undefined => {
    const ids = [hasLabel() ? labelId(state) : undefined, ownLabelledBy].filter(Boolean).join(" ") || undefined;
    return labelsProps(state.id, ariaLabel, ids)["aria-labelledby"];
  };
  const describedBy = (): string | undefined =>
    [
      pickerValueDescription(state) ? valueDescriptionId(state) : undefined,
      slotIdRef(descriptionId, false),
      isInvalid() ? slotIdRef(errorId) : undefined,
      extraDescribedBy,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  // The group labels the button and the dialog: the group's own label, else the group id.
  const groupLabelledBy = () => labelledBy() || state.id;
  const user: PickerUserEvents | undefined =
    props.onFocus || props.onBlur || props.onFocusChange || props.onKeyDown
      ? { onFocus: props.onFocus, onBlur: props.onBlur, onFocusChange: props.onFocusChange, onKeyDown: props.onKeyDown }
      : undefined;
  const validation = state.validation;
  return {
    hasLabel,
    labelledBy,
    describedBy,
    user,
    isInvalid,
    groupProps: {
      id: state.id,
      role: "group",
      "aria-label": ariaLabel,
      "aria-labelledby": groupLabelledBy,
      "aria-describedby": describedBy,
      "aria-details": props["aria-details"],
      "aria-disabled": ownerFlagAttr(state, 0),
      isInvalid,
      isDisabled: ownerFlag(state, 0),
      isReadOnly: ownerFlag(state, 1),
      onKeyDown: (event: KeyboardEvent) => {
        datePickerGroupKeyDown(event, state);
        datePickerUserEvent(event, state, user);
      },
      onKeyUp: props.onKeyUp,
      onFocusIn: (event: FocusEvent) => {
        datePickerFocusIn(event, state);
        datePickerUserEvent(event, state, user);
      },
      onFocusOut: (event: FocusEvent) => {
        datePickerFocusOut(event, state);
        datePickerUserEvent(event, state, user);
      },
      onPointerDown: (event: PointerEvent & { currentTarget: HTMLElement }) => dateGroupPointerDown(event),
      onPointerUp: (event: PointerEvent & { currentTarget: HTMLElement }) => dateGroupPointerUp(event),
    } as Record<string, unknown>,
    labelProps: { id: labelId(state), onClick: (event: MouseEvent) => datePickerLabelClick(event, state) },
    buttonProps: {
      id: buttonId(state),
      "aria-haspopup": "dialog",
      "aria-label": message(state.locale, "calendar"),
      "aria-labelledby": () => `${buttonId(state)} ${groupLabelledBy()}`,
      "aria-describedby": describedBy,
      "aria-expanded": () => (state.isOpen() ? "true" : "false"),
      isDisabled: buttonDisabled(state),
      isPressed: () => state.isOpen(),
      onPress: () => setOpen(state, true),
    } as Record<string, unknown>,
    dialogProps: { id: dialogId(state), "aria-labelledby": () => `${buttonId(state)} ${groupLabelledBy()}` } as Record<string, unknown>,
    descriptionProps: { id: descriptionId },
    errorMessageProps: { id: errorId },
    validationErrors: () => displayValidation(validation).validationErrors,
    validationDetails: () => displayValidation(validation).validationDetails,
  };
}

/** useDatePicker: the attribute bags of a date picker. Creates the picker's field state (shared value). */
export function datePickerProps(props: AriaDatePickerOptions, state: DatePickerState): DatePickerAria {
  const base = pickerBase(props, state);
  const id = fieldId(state);
  const field = createPickerFieldState({ owner: state }, { id, locale: state.locale, defaultValue: state.defaultValue });
  const { user } = base;
  const isDateUnavailable = props.isDateUnavailable;
  return {
    groupProps: base.groupProps,
    labelProps: base.labelProps,
    fieldProps: {
      pickerField: field,
      isPresentation: true,
      "aria-label": props["aria-label"],
      // An accessor (RA: useSlot starts `true`, the label settles after mount): a call here froze the client value
      // before the picker Label mounted (server `month, ` + labelledby, client `month`).
      "aria-labelledby": base.labelledBy,
      // RA useDatePicker fieldProps: the segments are described by the picker.
      "aria-describedby": base.describedBy,
      name: props.name,
      form: props.form,
      validationBehavior: props.validationBehavior,
      forward: (event: Event) => datePickerFieldEvent(event, state, user),
    },
    buttonProps: base.buttonProps,
    dialogProps: base.dialogProps,
    calendarProps: {
      autoFocus: true,
      defaultValue: () => {
        const value = untrack(() => dateValue(state));
        return value ? stringifyDateValue(value) : null;
      },
      defaultFocusedValue: () => (untrack(() => dateValue(state)) ? undefined : state.placeholderValue),
      onChange: (date: DateValue) => {
        // The hidden inputs sync before the validation commit (it reads their native validity).
        setDateValue(state, date, () => syncPickerInputs(state, document));
        syncPickerInputs(state, document);
      },
      minValue: state.minValue,
      maxValue: state.maxValue,
      isDisabled: ownerFlag(state, 0),
      isReadOnly: ownerFlag(state, 1),
      // RA: the user's function as is (an arrow made in a ternary does not serialize: the context entry dropped).
      isDateUnavailable,
      isInvalid: () => untrack(() => pickerIsInvalid(state)),
      firstDayOfWeek: state.firstDayOfWeek,
      pageBehavior: state.pageBehavior,
    },
    descriptionProps: base.descriptionProps,
    errorMessageProps: base.errorMessageProps,
    isInvalid: base.isInvalid,
    validationErrors: base.validationErrors,
    validationDetails: base.validationDetails,
  };
}

/** useDateRangePicker: the attribute bags of a date range picker (start / end fields share the picker's value). */
export function dateRangePickerProps(props: AriaDatePickerOptions, state: DateRangePickerState): DateRangePickerAria {
  const base = pickerBase(props, state);
  const { user } = base;
  const fieldOf = (part: "start" | "end"): AriaDateFieldOptions & { pickerField: DateFieldState } => {
    const id = fieldId(state, part);
    const defaults = state.defaultValue;
    const field = createPickerFieldState({ owner: state, part }, { id, locale: state.locale, defaultValue: defaults ? defaults[part] : null });
    return {
      pickerField: field,
      isPresentation: true,
      "aria-label": message(state.locale, part === "start" ? "startDate" : "endDate"),
      // An accessor (RA: useSlot starts `true`, the label settles after mount): a call here froze the client value
      // before the picker Label mounted (server `month, ` + labelledby, client `month`).
      "aria-labelledby": base.labelledBy,
      // RA useDateRangePicker start / end fieldProps: the segments are described by the picker.
      "aria-describedby": base.describedBy,
      name: part === "start" ? props.startName : props.endName,
      form: props.form,
      validationBehavior: props.validationBehavior,
      focusScope: state.id,
      forward: (event: Event) => datePickerFieldEvent(event, state, user),
    };
  };
  const isDateUnavailable = props.isDateUnavailable;
  return {
    groupProps: base.groupProps,
    labelProps: base.labelProps,
    startFieldProps: fieldOf("start"),
    endFieldProps: fieldOf("end"),
    buttonProps: base.buttonProps,
    dialogProps: base.dialogProps,
    calendarProps: {
      autoFocus: true,
      defaultValue: () => {
        const range = untrack(() => dateRange(state));
        return range?.start && range.end ? { start: stringifyDateValue(range.start), end: stringifyDateValue(range.end) } : null;
      },
      defaultFocusedValue: () => (untrack(() => dateRange(state)) ? undefined : state.placeholderValue),
      onChange: (range: RangeValue<DateValue>) => {
        // The hidden inputs sync before the validation commit (it reads their native validity).
        setDateRange(state, range, () => syncPickerInputs(state, document));
        syncPickerInputs(state, document);
      },
      minValue: state.minValue,
      maxValue: state.maxValue,
      isDisabled: ownerFlag(state, 0),
      isReadOnly: ownerFlag(state, 1),
      isDateUnavailable,
      allowsNonContiguousRanges: props.allowsNonContiguousRanges,
      isInvalid: () => untrack(() => pickerIsInvalid(state)),
      firstDayOfWeek: state.firstDayOfWeek,
      pageBehavior: state.pageBehavior,
    },
    descriptionProps: base.descriptionProps,
    errorMessageProps: base.errorMessageProps,
    isInvalid: base.isInvalid,
    validationErrors: base.validationErrors,
    validationDetails: base.validationDetails,
  };
}

export type { DatePickerState, DateRangePickerState, DateValueString };
