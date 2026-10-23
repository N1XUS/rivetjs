// Ported from react-aria-components (react-spectrum) src/DatePicker.tsx (DatePicker, DateRangePicker),
// Apache-2.0, © Adobe.
// Rivet:
// - RAC parts 1:1: the pickers render no parts themselves. They provide DatePickerStateContext /
//   DateRangePickerStateContext, GroupContext (the picker group), DateFieldContext (the DateInput: the picker's
//   field state + `role="presentation"`; slots `start` / `end` in a range picker), ButtonContext (the calendar
//   button), LabelContext, CalendarContext / RangeCalendarContext, OverlayTriggerStateContext, PopoverContext
//   (`trigger`, `triggerRef` = the group, `placement: "bottom start"`), DialogContext, TextContext and
//   FieldErrorContext (`../overlay/contexts.ts`, `../dialog/contexts.ts`). The user composes
//   `<Label/><Group><DateInput>…</DateInput><Button/></Group><Popover><Dialog><Calendar/></Dialog></Popover>`.
// - The Popover renders only while open (nothing at SSR); on a resumed page the first open creates it.
// - Render props are accessors (`class={({ isOpen }) => …}`).
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element.
// Deviations: no `locale` prop (I18nProvider); PopoverContext has no `clearContexts` (Rivet's
// Popover does not clear contexts: the parts inside the dialog are the Calendar's, which re-provides
// ButtonContext / HeadingContext / TextContext itself).
import { computed, createContext, untrack, type Signal } from "@rivetjs/reactivity";
import { clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { FieldErrorContext } from "../form/field-error.tsx";
import { Group, GroupContext } from "../group/index.tsx";
import { Button, ButtonContext } from "../button/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Dialog } from "../dialog/index.tsx";
import { LabelContext } from "../label/index.tsx";
import { TextContext } from "../text/index.tsx";
import { probeSlots, slotProbing } from "#server";
import { Calendar, CalendarContext, RangeCalendar, RangeCalendarContext } from "../calendar/index.tsx";
import { DateFieldContext, DateInput, DateSegment, HiddenDateInput, type DateSegmentItem } from "../date-field/index.tsx";
import { DialogContext } from "../dialog/contexts.ts";
import { OverlayTriggerStateContext, PopoverContext } from "../overlay/contexts.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import type { MaybeAccessor, ValidationResult } from "../state/form-validation.ts";
import {
  Provider,
  contextProps,
  createSlot,
  renderProps,
  type ClassNameOrFunction,
  type ContextValue,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleObject,
} from "../slots/index.tsx";
import type { DateValue } from "../state/date-field.ts";
import {
  commitOnClose,
  createDatePickerState,
  createDateRangePickerState,
  isInvalid as pickerIsInvalid,
  type AnyDatePickerState,
  type DatePickerState,
  type DatePickerStateOptions,
  type DateRangePickerState,
  type DateRangePickerStateOptions,
} from "../state/date-picker.ts";
import {
  datePickerFocusIn,
  datePickerFocusOut,
  datePickerProps,
  dateRangePickerProps,
  pickerValueDescription,
  syncPickerInputs,
  valueDescriptionId,
} from "./behaviour.tsx";
import { renderPropsOf } from "../slots/index.tsx";
import { liveDateProps } from "../date-field/live-value.tsx";
import { ownerFlag, ownerFlagAttr, ownerFlagNow } from "../date-field/behaviour.tsx";
import { hasLive, liveOptions } from "../utils/live.tsx";

export type { DateValueString, FirstDayOfWeek, PageBehavior, RangeValue } from "../state/date-picker.ts";
export type { DateValue, Granularity } from "../state/date-field.ts";

export interface DatePickerRenderProps {
  /** Whether an element within the date picker is focused, either via a mouse or keyboard. @selector [data-focus-within] */
  isFocusWithin: () => boolean;
  /** Whether an element within the date picker is keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the date picker is disabled. @selector [data-disabled] */
  isDisabled: () => boolean;
  /** Whether the date picker is read only. @selector [data-readonly] */
  isReadOnly: () => boolean;
  /** Whether the date picker is invalid. @selector [data-invalid] */
  isInvalid: () => boolean;
  /** Whether the date picker is required. @selector [data-required] */
  isRequired: () => boolean;
  /** Whether the date picker's popover is currently open. @selector [data-open] */
  isOpen: () => boolean;
  /** State of the date picker. */
  state: DatePickerState;
}

export interface DateRangePickerRenderProps extends Omit<DatePickerRenderProps, "state"> {
  /** State of the date range picker. */
  state: DateRangePickerState;
}

interface PickerRootProps extends RACValidation, SlotProps, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Whether the value is invalid (a value, or an accessor that stays live). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  form?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  ref?: RefValue<HTMLDivElement>;
}

export interface DatePickerProps<T extends DateValue = DateValue>
  extends
    Omit<DatePickerStateOptions<T>, "locale" | "validationBehavior" | "isInvalid">,
    PickerRootProps,
    RenderProps<DatePickerRenderProps>,
    DOMRenderProps<"div", DatePickerRenderProps> {
  /** The CSS class of the element (a function of the render props). @default "rv-DatePicker" */
  class?: ClassNameOrFunction<DatePickerRenderProps>;
  /** Describes the type of autocomplete functionality the hidden autofill input provides. */
  autoComplete?: string;
}

export interface DateRangePickerProps<T extends DateValue = DateValue>
  extends
    Omit<DateRangePickerStateOptions<T>, "locale" | "validationBehavior" | "isInvalid">,
    PickerRootProps,
    RenderProps<DateRangePickerRenderProps>,
    DOMRenderProps<"div", DateRangePickerRenderProps> {
  /** The CSS class of the element (a function of the render props). @default "rv-DateRangePicker" */
  class?: ClassNameOrFunction<DateRangePickerRenderProps>;
}

export const DatePickerContext = createContext<ContextValue<Partial<DatePickerProps<any>>, HTMLDivElement>>(null);
export const DateRangePickerContext = createContext<ContextValue<Partial<DateRangePickerProps<any>>, HTMLDivElement>>(null);
export const DatePickerStateContext = createContext<DatePickerState | null>(null);
export const DateRangePickerStateContext = createContext<DateRangePickerState | null>(null);

const ROOT_OWNED = ["style", "render"] as const;

/** The preset anatomy (no children): group (DateInput(s) + calendar button), popover dialog with the calendar. */
function presetChildren(isRange: boolean): Content {
  const segments = (segment: DateSegmentItem) => <DateSegment segment={segment} />;
  return (
    <>
      <Group>
        {isRange ? (
          <>
            <DateInput slot="start">{segments}</DateInput>
            <span aria-hidden="true">–</span>
            <DateInput slot="end">{segments}</DateInput>
          </>
        ) : (
          <DateInput>{segments}</DateInput>
        )}
        <Button />
      </Group>
      <Popover>
        <Dialog>{isRange ? <RangeCalendar /> : <Calendar />}</Dialog>
      </Popover>
    </>
  );
}

/**
 * React Stately `setOpen(false)` commits the selection: mounted while the popover is open, so closing it any way
 * (Escape, outside press, selection) commits. Rivet: not an `onOpenChange` wrapper, which would make the state
 * reference itself (a cycle the resume format rejects).
 */
function PickerCommit(props: { state: AnyDatePickerState }) {
  const state = props.state;
  const commit = {
    run: () =>
      untrack(() => {
        commitOnClose(state);
        syncPickerInputs(state, document);
      }),
  };
  // Mounted while open (own binding site): commits once the popover closes — when the effect re-runs on close,
  // or when the presence unmounts it first (the cleanup runs either way, once).
  clientEffect(() => {
    if (!state.isOpen()) return;
    return () => {
      if (!untrack(state.isOpen)) commit.run();
    };
  });
  return null;
}

/** Shared root of DatePicker / DateRangePicker (RAC: two copies of the same markup). */
function pickerRoot(
  props: PickerRootProps & {
    render?: unknown;
    class?: unknown;
    style?: unknown;
    children?: unknown;
    isRequired?: boolean;
    isDisabled?: boolean;
    isReadOnly?: boolean;
  },
  ref: RefValue<HTMLDivElement> | undefined,
  state: AnyDatePickerState,
  aria: ReturnType<typeof datePickerProps> | ReturnType<typeof dateRangePickerProps>,
  labelRef: unknown,
  extra: ProviderValue<any>[],
) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const isRange = state.kind === "range";
  const {
    groupProps,
    labelProps,
    buttonProps,
    dialogProps,
    calendarProps,
    descriptionProps,
    errorMessageProps,
    isInvalid,
    validationErrors,
    validationDetails,
  } = aria;
  // Live props (P5): the picker state is the owner of the flags (`isDisabled={d()}`: `state.disabled` accessor); a live
  // flag is an accessor in the spread bag `dom` (default element and `render` attrs).
  const isDisabled = ownerFlagAttr(state, 0),
    isReadOnly = ownerFlagAttr(state, 1),
    isRequired = ownerFlagAttr(state, 2);
  const values = {
    state,
    isFocusWithin: () => state.isFocusWithin(),
    isFocusVisible: () => state.isFocusWithin() && state.isFocusVisible(),
    isDisabled: () => ownerFlagNow(state, 0),
    isInvalid,
    isOpen: () => state.isOpen(),
    isReadOnly: () => ownerFlagNow(state, 1),
    isRequired: () => ownerFlagNow(state, 2),
  };
  // Preset (no children): RAC's documented anatomy. Lazy: it renders inside the Provider; an object-literal
  // function value (resumable wherever the children accessor is encoded).
  const preset = { content: () => presetChildren(isRange) };
  const childrenUnset = untrack(() => props.children) === undefined;
  // Options hoisted: no function in the `rp` initializer (spread sites capture `rp.class` / `rp.style`, not the
  // children accessor: per-key live views).
  const rpOptions = {
    values,
    defaultClassName: isRange ? "rv-DateRangePicker" : "rv-DatePicker",
    defaultChildren: childrenUnset ? (preset.content as unknown as Content) : undefined,
  };
  const rp = renderPropsOf(props as never, rpOptions);
  // A computed (serializable): the FieldError region re-created on a resumed page is re-provided with it.
  const validation = computed((): ValidationResult => ({
    isInvalid: isInvalid(),
    validationErrors: validationErrors(),
    validationDetails: validationDetails(),
  }));
  const dom = globalDOMProps(props, ROOT_OWNED);
  delete dom.id;
  // Flags only in the spread bag (a plain JSX attribute after a spread takes the key out of it).
  dom["data-disabled"] = isDisabled;
  dom["data-readonly"] = isReadOnly;
  dom["data-required"] = isRequired;
  const slot = props.slot || undefined;
  // The popover positions against the group (RAC `triggerRef: groupRef`).
  const groupRef = createRef<HTMLDivElement>();
  const providerValues: ProviderValue<any>[] = [
    [GroupContext, { ...groupProps, ref: groupRef }],
    [ButtonContext, buttonProps],
    [LabelContext, { ...labelProps, ref: labelRef, elementType: "span" }],
    isRange ? [RangeCalendarContext, calendarProps] : [CalendarContext, calendarProps],
    [OverlayTriggerStateContext, state],
    [PopoverContext, { trigger: isRange ? "DateRangePicker" : "DatePicker", triggerRef: groupRef, placement: "bottom start" }],
    [DialogContext, dialogProps],
    [TextContext, { slots: { description: descriptionProps, errorMessage: errorMessageProps } }],
    [FieldErrorContext, validation],
    ...extra,
  ];
  // Rivet (server): the group renders before its Description / FieldError: probe which slotted parts render (as TextField).
  if (typeof document === "undefined") probeSlots(providerValues, () => rp.children());
  if (props.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      class: () => rp.class(),
      style: () => rp.style(),
      slot,
      "data-rv-date-picker": "",
      "data-focus-within": () => dataBool(state.isFocusWithin()),
      "data-invalid": () => dataBool(isInvalid()),
      "data-focus-visible": () => dataBool(state.isFocusWithin() && state.isFocusVisible()),
      "data-open": () => dataBool(state.isOpen()),
      onFocusIn: (event: FocusEvent) => datePickerFocusIn(event as never, state),
      onFocusOut: (event: FocusEvent) => datePickerFocusOut(event as never, state),
      children: () => rp.children(),
    };
    return (
      <Provider values={providerValues}>
        {(props.render as (a: never, v: never) => Content)(attrs as never, values as never)}
        <span id={valueDescriptionId(state)} hidden>
          {pickerValueDescription(state)}
        </span>
        <span data-rv-overlay-anchor="" style={{ display: "contents" }}>
          {state.isOpen() ? <PickerCommit state={state} /> : null}
        </span>
      </Provider>
    );
  }
  return (
    <Provider values={providerValues}>
      <div
        {...dom}
        ref={ref as never}
        class={rp.class()}
        style={rp.style()}
        slot={slot}
        data-rv-date-picker=""
        data-focus-within={dataBool(state.isFocusWithin())}
        data-invalid={dataBool(isInvalid())}
        data-focus-visible={dataBool(state.isFocusWithin() && state.isFocusVisible())}
        data-open={dataBool(state.isOpen())}
        onFocusIn={(event) => datePickerFocusIn(event, state)}
        onFocusOut={(event) => datePickerFocusOut(event, state)}
      >
        {rp.children()}
      </div>
      <span id={valueDescriptionId(state)} hidden>
        {pickerValueDescription(state)}
      </span>
      {/* Own binding site: reading `isOpen` in the fragment root would make the first open of a resumed page
          re-create the whole picker (the focused segment / group replaced: no focus return, onFocus twice). */}
      <span data-rv-overlay-anchor="" style={{ display: "contents" }}>
        {state.isOpen() ? <PickerCommit state={state} /> : null}
      </span>
    </Provider>
  );
}

/** A date picker combines a DateField and a Calendar popover to allow users to enter or select a date and time value. */
export function DatePicker<T extends DateValue = DateValue>(inProps: DatePickerProps<T>) {
  // Live props (P5): `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` and a controlled `value` stay live
  // (accessors into the state); the rest of the body is read once (untracked: a prop change never re-creates it).
  return untrack(() => datePicker(inProps));
}

/** Picker flags that stay live (accessors the state reads at use). */
const PICKER_LIVE = ["isDisabled", "isReadOnly", "isRequired", "isInvalid"] as const;

function datePicker<T extends DateValue>(inProps: DatePickerProps<T>) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, DatePickerContext);
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, PICKER_LIVE as never) : ctxProps;
  const validationBehavior = formValidationBehavior(props.validationBehavior);
  const live = liveDateProps(props);
  const state: DatePickerState = createDatePickerState({
    ...(live as DatePickerStateOptions<T>),
    validationBehavior,
    validationErrors: formValidationErrors(),
  });
  const [labelRef, hasLabel] = createSlot(!props["aria-label"] && !props["aria-labelledby"]);
  const aria = datePickerProps({ ...(live as object), label: hasLabel, validationBehavior }, state);
  const { autoComplete, name } = props;
  const isDisabled = ownerFlag(state, 0);
  return (
    <>
      {pickerRoot(props as never, ref, state, aria, labelRef, [
        [DatePickerStateContext, state],
        [DateFieldContext, aria.fieldProps],
      ])}
      <HiddenDateInput autoComplete={autoComplete} name={name} isDisabled={isDisabled} state={aria.fieldProps.pickerField} isPicker />
    </>
  );
}

/** A date range picker combines two DateFields and a RangeCalendar popover to allow users to enter or select a date and time range. */
export function DateRangePicker<T extends DateValue = DateValue>(inProps: DateRangePickerProps<T>) {
  // Live props (P5): as DatePicker.
  return untrack(() => dateRangePicker(inProps));
}

function dateRangePicker<T extends DateValue>(inProps: DateRangePickerProps<T>) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, DateRangePickerContext);
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, PICKER_LIVE as never) : ctxProps;
  const validationBehavior = formValidationBehavior(props.validationBehavior);
  const live = liveDateProps(props);
  const state: DateRangePickerState = createDateRangePickerState({
    ...(live as DateRangePickerStateOptions<T>),
    validationBehavior,
    validationErrors: formValidationErrors(),
  });
  const [labelRef, hasLabel] = createSlot(!props["aria-label"] && !props["aria-labelledby"]);
  const aria = dateRangePickerProps({ ...(live as object), label: hasLabel, validationBehavior }, state);
  return pickerRoot(props as never, ref, state, aria, labelRef, [
    [DateRangePickerStateContext, state],
    [DateFieldContext, { slots: { start: aria.startFieldProps, end: aria.endFieldProps } }],
  ]);
}

export { pickerIsInvalid as isPickerInvalid };
export type { Signal };
