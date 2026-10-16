// Ported from react-aria-components (react-spectrum) src/DateField.tsx (DateField, TimeField, DateInput,
// DateSegment) and src/HiddenDateInput.tsx, Apache-2.0, © Adobe.
// Rivet:
// - RAC parts 1:1: DateField / TimeField provide DateFieldStateContext / TimeFieldStateContext, GroupContext
//   (the field group: role, labelling, delegated handlers), InputContext (the hidden form input), LabelContext
//   (`elementType: "span"`), TextContext (description / errorMessage slot ids) and FieldErrorContext; DateInput
//   renders `<Group>` with one child per segment + `<Input>`; DateSegment renders a segment.
// - Inside a DatePicker / DateRangePicker (no field state context) DateInput reads DateFieldContext (slot `start` /
//   `end` in a range picker): the picker passes its field state (`pickerField`, sharing the picker's value), the
//   field is `role="presentation"` and forwards its group events to the picker (`forward`).
// - Segments are rows keyed by type + occurrence (`segmentKeys`): text and ARIA are bindings, nodes (and focus)
//   stay. DateInput's children function receives a `DateSegmentItem` (`key`, `type` + accessors), not React
//   Stately's segment object; DateSegment render props are accessors.
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element. Parts: DateField, TimeField, DateSegment and DateInput (forwarded to its `<Group>`; the render props are the Group's).
// Deviations: DateSegment takes no HoverEvents (`isHovered` render prop only, from
// pointerenter / pointerleave); no `locale` prop (I18nProvider).
import { computed, createContext, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { For, clientEffect } from "@rivetjs/runtime/dom";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { FieldErrorContext } from "../form/field-error.tsx";
import { Group, GroupContext } from "../group/index.tsx";
import { Input, InputContext } from "../input/index.tsx";
import { LabelContext } from "../label/index.tsx";
import { TextContext } from "../text/index.tsx";
import { probeSlots, slotProbing } from "#server";
import { dataBool } from "../utils/data-attrs.tsx";
import { nodeContains } from "../utils/dom.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import type { MaybeAccessor, ValidationResult } from "../state/form-validation.ts";
import {
  Provider,
  contextProps,
  createSlot,
  renderProps,
  resumableContext,
  slottedContext,
  type ClassNameOrFunction,
  type ContextValue,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleObject,
  type StyleRenderProps,
} from "../slots/index.tsx";
import {
  createDateFieldState,
  isFieldInvalid,
  ownerDisabled,
  ownerOf,
  type DateFieldState,
  type DateFieldStateOptions,
  type DateSegmentType,
  type DateValue,
} from "../state/date-field.ts";
import { createTimeFieldState, type TimeFieldState, type TimeFieldStateOptions, type TimeValue } from "../state/time-field.ts";
import {
  dateFieldProps,
  dateSegmentProps,
  fieldValueDescription,
  focusFirstSegment,
  hiddenDateInputProps,
  ownerFlag,
  ownerFlagAttr,
  ownerFlagNow,
  segmentKeys,
  segmentOf,
  segmentStyle,
  segmentText,
  timeFieldProps,
  valueDescriptionId,
  type AriaDateFieldOptions,
  type HiddenDateInputOptions,
} from "./behaviour.tsx";
import { renderPropsOf } from "../slots/index.tsx";
import { liveDateProps } from "./live-value.tsx";
import { hasLive, liveOptions } from "../utils/live.tsx";

export type { DateValue, DateValueString, Granularity, DateSegmentType } from "../state/date-field.ts";
export type { TimeValue } from "../state/time-field.ts";

export interface DateFieldRenderProps {
  /** State of the date field. */
  state: DateFieldState;
  /** Whether the date field is invalid. @selector [data-invalid] */
  isInvalid: () => boolean;
  /** Whether the date field is disabled. @selector [data-disabled] */
  isDisabled: () => boolean;
  /** Whether the date field is read only. @selector [data-readonly] */
  isReadOnly: () => boolean;
  /** Whether the date field is required. @selector [data-required] */
  isRequired: () => boolean;
}

interface FieldEventProps {
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
}

interface FieldRootProps
  extends
    RACValidation,
    SlotProps,
    FieldEventProps,
    RenderProps<DateFieldRenderProps>,
    DOMRenderProps<"div", DateFieldRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class of the element (a function of the render props). */
  class?: ClassNameOrFunction<DateFieldRenderProps>;
  /** Whether the value is invalid (a value, or an accessor that stays live). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  name?: string;
  form?: string;
  /** Describes the type of autocomplete functionality the hidden autofill input provides. */
  autoComplete?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  ref?: RefValue<HTMLDivElement>;
}

export interface DateFieldProps<T extends DateValue = DateValue>
  extends Omit<DateFieldStateOptions<T>, "locale" | "validationBehavior" | "isInvalid">, FieldRootProps {}

export interface TimeFieldProps<T extends TimeValue = TimeValue>
  extends Omit<TimeFieldStateOptions<T>, "locale" | "validationBehavior" | "isInvalid">, FieldRootProps {}

/** @internal What a DatePicker / DateRangePicker passes to its DateInput(s) through DateFieldContext. */
export interface PickerFieldContextValue extends AriaDateFieldOptions {
  /** The picker's field state (shares the picker's value). */
  pickerField?: DateFieldState;
}

export const DateFieldContext = resumableContext(
  createContext<ContextValue<Partial<DateFieldProps<any>> & PickerFieldContextValue, HTMLDivElement>>(null, { id: "rv-date-field" }),
);
export const TimeFieldContext = resumableContext(createContext<ContextValue<Partial<TimeFieldProps<any>>, HTMLDivElement>>(null, { id: "rv-time-field" }));
export const DateFieldStateContext = resumableContext(createContext<DateFieldState | null>(null, { id: "rv-date-field-state" }));
export const TimeFieldStateContext = resumableContext(createContext<TimeFieldState | null>(null, { id: "rv-time-field-state" }));

const ROOT_OWNED = ["style", "render"] as const;

/** Shared DateField / TimeField root (RAC: two copies of the same markup). */
function fieldRoot(props: FieldRootProps, ref: RefValue<HTMLDivElement> | undefined, state: DateFieldState, isTime: boolean): Content {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const validationBehavior = formValidationBehavior(props.validationBehavior);
  const [labelRef, hasLabel] = createSlot(!props["aria-label"] && !props["aria-labelledby"]);
  const aria = (isTime ? timeFieldProps : dateFieldProps)(
    {
      "aria-label": props["aria-label"],
      "aria-labelledby": props["aria-labelledby"],
      "aria-describedby": props["aria-describedby"],
      "aria-details": props["aria-details"],
      label: hasLabel,
      name: props.name,
      form: props.form,
      validationBehavior,
      onFocus: props.onFocus,
      onBlur: props.onBlur,
      onFocusChange: props.onFocusChange,
      onKeyDown: props.onKeyDown,
      onKeyUp: props.onKeyUp,
    },
    state,
  );
  const { labelProps, fieldProps, inputProps, descriptionProps, errorMessageProps, isInvalid, validationErrors, validationDetails } = aria;
  const owner = ownerOf(state);
  // Live props (P5): a live flag is an accessor in the spread bag `dom` (default element and `render` attrs); a static
  // flag is the plain value.
  const isDisabled = ownerFlagAttr(owner, 0),
    isReadOnly = ownerFlagAttr(owner, 1),
    isRequired = ownerFlagAttr(owner, 2);
  const rpValues = {
    state,
    isInvalid,
    isDisabled: () => ownerFlagNow(owner, 0),
    isReadOnly: () => ownerFlagNow(owner, 1),
    isRequired: () => ownerFlagNow(owner, 2),
  };
  // Preset (no children): the DateInput of every segment. Lazy: it renders inside the Provider; an object-literal
  // function value (resumable wherever the children accessor is encoded).
  const preset = { content: () => <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput> };
  const childrenUnset = untrack(() => props.children) === undefined;
  // Options hoisted: no function in the `rp` initializer (spread sites capture `rp.class` / `rp.style`, not the
  // children accessor: per-key live views).
  const rpOptions = {
    values: rpValues,
    defaultClassName: isTime ? "rv-TimeField" : "rv-DateField",
    defaultChildren: childrenUnset ? (preset.content as unknown as Content) : undefined,
  };
  const rp = renderPropsOf(props, rpOptions);
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
  const hiddenDisabled = ownerFlag(owner, 0);
  const slot = props.slot || undefined;
  // useDateField autoFocus: focus the first segment once mounted.
  if (props.autoFocus) clientEffect(() => focusFirstSegment(document, state.id), { when: "load" });
  const values: ProviderValue<any>[] = [
    isTime ? [TimeFieldStateContext, state] : [DateFieldStateContext, state],
    [GroupContext, fieldProps],
    [InputContext, inputProps],
    [LabelContext, { ...labelProps, ref: labelRef, elementType: "span" }],
    [TextContext, { slots: { description: descriptionProps, errorMessage: errorMessageProps } }],
    [FieldErrorContext, validation],
  ];
  // Rivet (server): the input renders before its Description / FieldError: probe which slotted parts render (as TextField).
  if (typeof document === "undefined") probeSlots(values, () => rp.children());
  const { autoComplete, name } = props;
  if (props.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      class: () => rp.class(),
      style: () => rp.style(),
      slot,
      "data-invalid": () => dataBool(isInvalid()),
      children: () => rp.children(),
    };
    return (
      <Provider values={values}>
        {props.render(attrs as never, rpValues as never)}
        <span id={valueDescriptionId(state)} hidden>
          {fieldValueDescription(state)}
        </span>
        {isTime ? null : <HiddenDateInput autoComplete={autoComplete} name={name} isDisabled={hiddenDisabled} state={state} />}
      </Provider>
    );
  }
  return (
    <Provider values={values}>
      <div {...dom} ref={ref as never} class={rp.class()} style={rp.style()} slot={slot} data-invalid={dataBool(isInvalid())}>
        {rp.children()}
      </div>
      <span id={valueDescriptionId(state)} hidden>
        {fieldValueDescription(state)}
      </span>
      {isTime ? null : <HiddenDateInput autoComplete={autoComplete} name={name} isDisabled={hiddenDisabled} state={state} />}
    </Provider>
  );
}

/** A date field allows users to enter and edit date and time values using a keyboard. Each part of a date value is displayed in an individually editable segment. */
export function DateField<T extends DateValue = DateValue>(inProps: DateFieldProps<T>) {
  // Live props (P5): `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` and a controlled `value` stay live
  // (accessors into the state); the rest of the body is read once (untracked: a prop change never re-creates it).
  return untrack(() => dateField(inProps));
}

/** Field flags that stay live (accessors the state reads at use). */
const FIELD_LIVE = ["isDisabled", "isReadOnly", "isRequired", "isInvalid"] as const;

function dateField<T extends DateValue>(inProps: DateFieldProps<T>) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, DateFieldContext);
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, FIELD_LIVE as never) : ctxProps;
  const state = createDateFieldState({
    ...(liveDateProps(props) as DateFieldStateOptions<T>),
    validationBehavior: formValidationBehavior(props.validationBehavior),
    validationErrors: formValidationErrors(),
  });
  return fieldRoot(props as FieldRootProps, ref, state, false);
}

/** A time field allows users to enter and edit time values using a keyboard. Each part of a time value is displayed in an individually editable segment. */
export function TimeField<T extends TimeValue = TimeValue>(inProps: TimeFieldProps<T>) {
  // Live props (P5): as DateField.
  return untrack(() => timeField(inProps));
}

function timeField<T extends TimeValue>(inProps: TimeFieldProps<T>) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, TimeFieldContext);
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, FIELD_LIVE as never) : ctxProps;
  const state = createTimeFieldState({
    ...(liveDateProps(props) as TimeFieldStateOptions<T>),
    validationBehavior: formValidationBehavior(props.validationBehavior),
    validationErrors: formValidationErrors(),
  });
  return fieldRoot(props as FieldRootProps, ref, state, true);
}

// DateInput ---------------------------------------------------------------------------------------

/** A segment as DateInput's children function receives it (React Stately `DateSegment` fields as accessors). */
export interface DateSegmentItem {
  /** Stable key of the segment (type + occurrence, e.g. `literal-1`). */
  key: string;
  /** The type of segment. */
  type: DateSegmentType;
  /** The formatted text for the segment. */
  text: () => string;
  /** The numeric value for the segment, if applicable. */
  value: () => number | undefined;
  /** The minimum numeric value for the segment, if applicable. */
  minValue: () => number | undefined;
  /** The maximum numeric value for the segment, if applicable. */
  maxValue: () => number | undefined;
  /** Whether the value is a placeholder. */
  isPlaceholder: () => boolean;
  /** A placeholder string for the segment. */
  placeholder: () => string;
  /** Whether the segment is editable. */
  isEditable: () => boolean;
}

export interface DateInputRenderProps {
  /** Whether the date input is currently hovered with a mouse. @selector [data-hovered] */
  isHovered: () => boolean;
  /** Whether an element within the date input is focused, either via a mouse or keyboard. @selector [data-focus-within] */
  isFocusWithin: () => boolean;
  /** Whether an element within the date input is keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the date input is disabled. @selector [data-disabled] */
  isDisabled: () => boolean;
  /** Whether the date input is invalid. @selector [data-invalid] */
  isInvalid: () => boolean;
}

export interface DateInputProps
  extends SlotProps, StyleRenderProps<DateInputRenderProps>, DOMRenderProps<"div", DateInputRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class of the element (a function of the render props). @default "rv-DateInput" */
  class?: ClassNameOrFunction<DateInputRenderProps>;
  /** Renders a segment (`<DateSegment segment={segment} />`). */
  children: (segment: DateSegmentItem) => Content;
  ref?: RefValue<HTMLDivElement>;
}

/** A date input groups the editable date segments within a date field. */
export function DateInput(props: DateInputProps): Content {
  // If state is provided by DateField / TimeField, just render. Otherwise (e.g. in DatePicker), create the state.
  const fieldState = useContext(DateFieldStateContext) ?? useContext(TimeFieldStateContext);
  return fieldState ? dateInputInner(props, fieldState) : dateInputStandalone(props);
}

function dateInputStandalone(props: DateInputProps): Content {
  const context = (slottedContext(DateFieldContext, props.slot) ?? {}) as Partial<DateFieldProps> & PickerFieldContextValue;
  const { pickerField, ...fieldOptions } = context;
  const state = pickerField ?? createDateFieldState(fieldOptions as DateFieldStateOptions);
  const { fieldProps, inputProps } = dateFieldProps(fieldOptions, state);
  return (
    <Provider
      values={[
        [DateFieldStateContext, state],
        [InputContext, inputProps],
        [GroupContext, fieldProps],
      ]}
    >
      {() => dateInputInner(props, state)}
    </Provider>
  );
}

/** The DateSegmentItem of `key` (accessors over the state). */
function segmentItem(state: DateFieldState, key: string): DateSegmentItem {
  const segment = () => segmentOf(state, key);
  return {
    key,
    type: untrack(segment)!.type,
    text: () => segmentText(state, key),
    value: () => segment()?.value ?? undefined,
    minValue: () => segment()?.minValue,
    maxValue: () => segment()?.maxValue,
    isPlaceholder: () => !!segment()?.isPlaceholder,
    placeholder: () => segment()?.placeholder ?? "",
    isEditable: () => !!segment()?.isEditable,
  };
}

function dateInputInner(props: DateInputProps, state: DateFieldState): Content {
  const owner = ownerOf(state);
  const render = props.children;
  const dom = globalDOMProps(props, ["style"]);
  // Locals: reading `props` in the JSX would capture the whole props object (children included).
  const { ref, style, render: renderGroup } = props;
  const slot = props.slot || undefined;
  const className = props.class ?? "rv-DateInput";
  const disabled = ownerFlag(owner, 0),
    readOnly = ownerFlag(owner, 1);
  return (
    <>
      <Group
        {...dom}
        ref={ref}
        slot={slot}
        render={renderGroup as never}
        class={className as never}
        style={style as never}
        isReadOnly={readOnly}
        isInvalid={() => isFieldInvalid(state)}
        isDisabled={disabled}
      >
        <For each={() => segmentKeys(state)} by={(key: string) => key}>
          {(key: () => string) => render(segmentItem(state, untrack(key)))}
        </For>
      </Group>
      <Input class="" />
    </>
  );
}

// DateSegment -------------------------------------------------------------------------------------

export interface DateSegmentRenderProps {
  /** The type of segment. @selector [data-type="..."] */
  type: DateSegmentType;
  /** The formatted text for the segment. */
  text: () => string;
  /** The numeric value for the segment, if applicable. */
  value: () => number | undefined;
  /** The minimum numeric value for the segment, if applicable. */
  minValue: () => number | undefined;
  /** The maximum numeric value for the segment, if applicable. */
  maxValue: () => number | undefined;
  /** A placeholder string for the segment. */
  placeholder: () => string;
  /** Whether the value is a placeholder. @selector [data-placeholder] */
  isPlaceholder: () => boolean;
  /** Whether the segment is currently hovered with a mouse. @selector [data-hovered] */
  isHovered: () => boolean;
  /** Whether the segment is focused, either via a mouse or keyboard. @selector [data-focused] */
  isFocused: () => boolean;
  /** Whether the segment is keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the segment is read only. @selector [data-readonly] */
  isReadOnly: () => boolean;
  /** Whether the date field is disabled. @selector [data-disabled] */
  isDisabled: () => boolean;
  /** Whether the date field is in an invalid state. @selector [data-invalid] */
  isInvalid: () => boolean;
}

export interface DateSegmentProps
  extends RenderProps<DateSegmentRenderProps>, DOMRenderProps<"span", DateSegmentRenderProps>, Omit<GlobalDOMAttributes<HTMLSpanElement>, "style"> {
  /** The CSS class of the element (a function of the render props). @default "rv-DateSegment" */
  class?: ClassNameOrFunction<DateSegmentRenderProps>;
  /** The segment (DateInput's children argument). */
  segment: DateSegmentItem;
  ref?: RefValue<HTMLSpanElement>;
}

const isFn = (v: unknown): boolean => typeof v === "function";
const SEGMENT_OWNED = ["style", "onPointerEnter", "onPointerLeave", "render"] as const;

/** A date segment displays an individual unit of a date and time, and allows users to edit the value by typing or using the arrow keys to increment and decrement. */
export function DateSegment(props: DateSegmentProps) {
  const state = (useContext(DateFieldStateContext) ?? useContext(TimeFieldStateContext))!;
  const segment = props.segment;
  const { segmentProps } = dateSegmentProps({ key: segment.key }, state);
  const owner = ownerOf(state);
  // Interaction states only when a render prop function asks for them (data attributes otherwise come from the handlers).
  const wantsStates = isFn(props.class) || isFn(props.style) || (isFn(props.children) && !("_slot" in (props.children as object)));
  const hovered: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focused: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focusVisible: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const values: DateSegmentRenderProps = {
    type: segment.type,
    text: segment.text,
    value: segment.value,
    minValue: segment.minValue,
    maxValue: segment.maxValue,
    placeholder: segment.placeholder,
    isPlaceholder: segment.isPlaceholder,
    isHovered: () => !!hovered?.(),
    isFocused: () => !!focused?.(),
    isFocusVisible: () => !!focusVisible?.(),
    isReadOnly: () => ownerFlagNow(owner, 1),
    isDisabled: () => ownerFlagNow(owner, 0),
    isInvalid: () => isFieldInvalid(state),
  };
  const rp = renderPropsOf(props, {
    values,
    defaultChildren: segment.text,
    defaultClassName: "rv-DateSegment",
  });
  const dom = globalDOMProps(props, SEGMENT_OWNED);
  const { onPointerEnter, onPointerLeave, ref } = props;
  // Read at event time (a live `isDisabled`).
  const literal = segment.type === "literal";
  const segmentKey = segment.key;
  if (props.render) {
    const attrs = {
      ...dom,
      ...segmentProps,
      ref: ref as never,
      class: () => rp.class(),
      style: () => ({ ...segmentStyle(state, segmentKey), ...rp.style() }),
      onPointerEnter: (event: PointerEvent & { currentTarget: HTMLElement }) => {
        if (!literal && !ownerDisabled(owner) && event.pointerType !== "touch") {
          event.currentTarget.setAttribute("data-hovered", "true");
          hovered?.set(true);
        }
        onPointerEnter?.(event as never);
      },
      onPointerLeave: (event: PointerEvent & { currentTarget: HTMLElement }) => {
        event.currentTarget.removeAttribute("data-hovered");
        hovered?.set(false);
        onPointerLeave?.(event as never);
      },
      onFocus: (event: FocusEvent & { currentTarget: HTMLElement }) => {
        const el = event.currentTarget;
        el.setAttribute("data-focused", "true");
        focused?.set(true);
        if (el.matches(":focus-visible")) {
          el.setAttribute("data-focus-visible", "true");
          focusVisible?.set(true);
        }
      },
      onBlur: (event: FocusEvent & { currentTarget: HTMLElement }) => {
        const el = event.currentTarget;
        el.removeAttribute("data-focused");
        el.removeAttribute("data-focus-visible");
        focused?.set(false);
        focusVisible?.set(false);
      },
      children: () => rp.children(),
    };
    return props.render(attrs as never, values);
  }
  return (
    <span
      {...dom}
      {...segmentProps}
      ref={ref as never}
      class={rp.class()}
      style={{ ...segmentStyle(state, segmentKey), ...rp.style() }}
      // Delegated (no listener per segment): pointerover / pointerout from outside the segment = its enter / leave
      // (React's emulation; they run before the native pointerenter / pointerleave a user handler binds), focusin /
      // focusout of the segment itself = its focus / blur.
      onPointerOver={(event) => {
        if (nodeContains(event.currentTarget, event.relatedTarget as Node | null)) return;
        if (!literal && !ownerDisabled(owner) && event.pointerType !== "touch") {
          event.currentTarget.setAttribute("data-hovered", "true");
          hovered?.set(true);
        }
      }}
      onPointerOut={(event) => {
        if (nodeContains(event.currentTarget, event.relatedTarget as Node | null)) return;
        event.currentTarget.removeAttribute("data-hovered");
        hovered?.set(false);
      }}
      onPointerEnter={onPointerEnter ? (event) => onPointerEnter(event as never) : undefined}
      onPointerLeave={onPointerLeave ? (event) => onPointerLeave(event as never) : undefined}
      onFocusIn={(event) => {
        const el = event.currentTarget as HTMLElement;
        if (event.target !== el) return;
        el.setAttribute("data-focused", "true");
        focused?.set(true);
        if (el.matches(":focus-visible")) {
          el.setAttribute("data-focus-visible", "true");
          focusVisible?.set(true);
        }
      }}
      onFocusOut={(event) => {
        const el = event.currentTarget as HTMLElement;
        if (event.target !== el) return;
        el.removeAttribute("data-focused");
        el.removeAttribute("data-focus-visible");
        focused?.set(false);
        focusVisible?.set(false);
      }}
    >
      {rp.children()}
    </span>
  );
}

// HiddenDateInput -------------------------------------------------------------------------------

export interface HiddenDateInputProps extends HiddenDateInputOptions {
  /** The state of the field the input fills. */
  state: DateFieldState;
}

/**
 * RAC HiddenDateInput: a visually hidden native date input so browser autofill can fill the field.
 * Not in the tab order or the accessibility tree; not submitted (`form=""`).
 */
export function HiddenDateInput(props: HiddenDateInputProps) {
  const { containerProps, inputProps } = hiddenDateInputProps(props, props.state);
  return (
    <div {...containerProps}>
      <input {...inputProps} />
    </div>
  );
}
