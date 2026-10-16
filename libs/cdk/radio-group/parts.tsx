// Ported from react-aria-components `RadioGroup` / `Radio` / `RadioField` / `RadioButton` (packages/react-aria-components/src/RadioGroup.tsx)
// + react-aria `useRadioGroup` / `useRadio` (packages/react-aria/src/radio/*), Apache-2.0, © Adobe.
// The RAC compound API: `<RadioGroup><Label/><RadioField value><RadioButton>…</RadioButton><Text slot="description"/></RadioField>
// <Text slot="description"/><FieldError/></RadioGroup>` (and the deprecated all-in-one `<Radio value>`). `RadioGroup` (index.tsx) takes this
// path when it has no `items` (the data-driven preset).
// Rivet:
// - render props are accessors (`({ isSelected }) => (isSelected() ? … : …)`); `class` / `style` may be functions of them; state `data-*`
//   attributes are bindings.
// - Native radios sharing the group `name` keep arrow keys (wrap, skip disabled, select on arrow), the single tab stop and form submission
//   native (zero JS, as the items preset): RA's JS roving tab index / arrow handler is not ported. Label activation is the native label
//   click (RA: a label press handler); the press state comes from `pressProps` on the label + input (no action).
// - the native input sits in an inline-styled visually hidden span (RA `VisuallyHidden`).
// - RA `radioGroupData` (module WeakMap) → `state.data` (serializes with the state).
// - Contexts are resumable (`rv-radio-group`, `rv-radio`, `rv-radio-field`, `rv-radio-group-state`, `rv-radio-internal`).
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, <part>RenderProps)` instead of the default element (RadioGroup /
// RadioField `<div>`, RadioButton / Radio `<label>` with the hidden input inside `children`). Deviations: `inputRef` is a Rivet `ref()`
// (or callback).
import { probeSlots, slotProbing } from "#server";
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/cdk/id";
import { displayValidation, read, type MaybeAccessor, type ValidationResult } from "../state/form-validation.ts";
import {
  createRadioGroupState,
  isRadioGroupDisabled,
  isRadioGroupReadOnly,
  isRadioGroupRequired,
  type RadioGroupState,
  type RadioGroupStateOptions,
} from "../state/radio-group.ts";
import { hasLive, liveAssign, liveOmit, liveOptions } from "../utils/live.tsx";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { validityError } from "../form/behaviour.ts";
import { FieldErrorContext } from "../form/field-error.tsx";
import { LabelContext } from "../label/index.tsx";
import { fieldProps } from "../label/behaviour.ts";
import { TextContext } from "../text/index.tsx";
import { visuallyHidden } from "../a11y/index.ts";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { hoverProps, type HoverEvents } from "../interactions/hover.tsx";
import { pressProps, type PressEvents } from "../interactions/press.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { mergeInputRefs, type InputRef, type PropBag } from "../checkbox/behaviour.tsx";
import { SharedElementTransition } from "../shared-element-transition/transition.tsx";
import { SelectionIndicatorContext } from "../selection-indicator/context.ts";
import {
  Provider,
  resumableContext,
  contextProps,
  createSlot,
  createSlotId,
  slotIdRef,
  renderPropsOf,
  type ClassNameOrFunction,
  type ContextValue,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotId,
  type SlotProps,
} from "../slots/index.tsx";
import { radioChange, radioFocus, radioGroupFocusOut, radioInvalid } from "./behaviour.ts";

export type Orientation = "horizontal" | "vertical";

/** RA `AriaRadioGroupProps` + RAC `RadioGroupProps` (compound form). */
export interface RadioGroupPartsProps
  extends
    Omit<RadioGroupStateOptions, "validationBehavior" | "validationErrors" | "isInvalid">,
    RACValidation,
    RenderProps<RadioGroupRenderProps>,
    DOMRenderProps<"div", RadioGroupRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "onFocus" | "onBlur"> {
  /** @default "vertical" */
  orientation?: Orientation;
  /** Whether the value is invalid (a value, or an accessor that stays live). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  form?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  "aria-errormessage"?: string;
  /** Focus entered the group (RA FocusEvents on the group: focus-within). */
  onFocus?: (event: FocusEvent) => void;
  /** Focus left the group. */
  onBlur?: (event: FocusEvent) => void;
  onFocusChange?: (isFocusWithin: boolean) => void;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-RadioGroup'
   */
  class?: ClassNameOrFunction<RadioGroupRenderProps>;
  ref?: RefValue<HTMLDivElement>;
}

/** RA `AriaRadioProps`. */
export interface AriaRadioProps extends PressEvents {
  /** The value of the radio button, used when submitting an HTML form. */
  value: string;
  /** Whether the radio button is disabled (a value, or an accessor that stays live). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** The label content (RA: whether there is one; only its presence matters). */
  children?: unknown;
  id?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
}

export interface RadioProps
  extends
    Omit<AriaRadioProps, "children">,
    HoverEvents,
    RenderProps<RadioRenderProps>,
    DOMRenderProps<"label", RadioRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLLabelElement>, "onClick" | "style" | "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-Radio'
   */
  class?: ClassNameOrFunction<RadioRenderProps>;
  /** A ref for the HTML input element. */
  inputRef?: InputRef;
  ref?: RefValue<HTMLLabelElement>;
}

export interface RadioFieldProps
  extends
    Omit<AriaRadioProps, "children">,
    RenderProps<RadioFieldRenderProps>,
    DOMRenderProps<"div", RadioFieldRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "onClick" | "style" | "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-RadioField'
   */
  class?: ClassNameOrFunction<RadioFieldRenderProps>;
  /** A ref for the HTML input element. */
  inputRef?: InputRef;
  ref?: RefValue<HTMLDivElement>;
}

export interface RadioButtonProps
  extends
    HoverEvents,
    RenderProps<RadioButtonRenderProps>,
    DOMRenderProps<"label", RadioButtonRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLLabelElement>, "onClick" | "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-RadioButton'
   */
  class?: ClassNameOrFunction<RadioButtonRenderProps>;
  ref?: RefValue<HTMLLabelElement>;
}

export interface RadioGroupRenderProps {
  /**
   * The orientation of the radio group.
   *
   * @selector [data-orientation="horizontal | vertical"]
   */
  orientation: () => Orientation;
  /**
   * Whether the radio group is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the radio group is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /**
   * Whether the radio group is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
  /**
   * Whether the radio group is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /** State of the radio group. */
  state: RadioGroupState;
}

export interface RadioFieldRenderProps {
  /**
   * Whether the radio is selected.
   *
   * @selector [data-selected]
   */
  isSelected: () => boolean;
  /**
   * Whether the radio is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the radio is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /**
   * Whether the radio is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the radio is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
}

export interface RadioRenderProps extends RadioFieldRenderProps {
  /**
   * Whether the radio is currently hovered with a mouse.
   *
   * @selector [data-hovered]
   */
  isHovered: () => boolean;
  /**
   * Whether the radio is currently in a pressed state.
   *
   * @selector [data-pressed]
   */
  isPressed: () => boolean;
  /**
   * Whether the radio is focused, either via a mouse or keyboard.
   *
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the radio is keyboard focused.
   *
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
}

export interface RadioButtonRenderProps extends RadioRenderProps {}

/** RAC `RadioGroupContext`. */
export const RadioGroupContext = resumableContext(createContext<ContextValue<Partial<RadioGroupPartsProps>, HTMLDivElement>>(null, { id: "rv-radio-group" }));
/** RAC `RadioContext`. */
export const RadioContext = resumableContext(createContext<ContextValue<Partial<RadioProps>, HTMLLabelElement>>(null, { id: "rv-radio" }));
/** RAC `RadioFieldContext`. */
export const RadioFieldContext = resumableContext(createContext<ContextValue<Partial<RadioFieldProps>, HTMLDivElement>>(null, { id: "rv-radio-field" }));
/** RAC `RadioGroupStateContext`. */
export const RadioGroupStateContext = resumableContext(createContext<RadioGroupState | null>(null, { id: "rv-radio-group-state" }));

/** RA `radioGroupData` entry: kept on the group state (`state.data`). */
export interface RadioGroupData {
  form?: string;
  descriptionId: SlotId;
  errorMessageId: SlotId;
  validationBehavior: "aria" | "native";
}

/** RA `RadioAria`. */
export interface RadioAria {
  labelProps: PropBag;
  inputProps: PropBag;
  descriptionProps: { id: SlotId };
  isSelected: () => boolean;
  isPressed: () => boolean;
  isDisabled: () => boolean;
}

const DOM_OWNED = ["style", "onClick", "render", "id"] as const;

/** Live by default (LIVE-SWEEP): flags, `orientation` (attributes only: arrow keys move in both axes) and the
 *  aria-description props; read once: `id`, `name`, `form`, `aria-label` / `aria-labelledby`, `defaultValue`,
 *  `validationBehavior`, `validate`, handlers. */
const GROUP_LIVE = ["isDisabled", "isReadOnly", "isRequired", "isInvalid", "orientation", "aria-describedby", "aria-details", "aria-errormessage"] as const;

/** `true | undefined` of a live state flag (a returned arrow: resumable). */
function liveFlag(read: () => boolean): () => true | undefined {
  return () => read() || undefined;
}
/** `"true" | undefined` of a live state flag (a returned arrow: resumable). */
function liveAria(read: () => boolean): () => "true" | undefined {
  return () => (read() ? "true" : undefined);
}
/** A group flag as an attribute value: the creation value, or an accessor while the flag is live. */
function groupDisabled(state: RadioGroupState): (() => boolean) | boolean {
  return state.disabled ? disabledReader(state) : state.isDisabled;
}
function groupReadOnly(state: RadioGroupState): (() => boolean) | boolean {
  return state.readOnly ? readOnlyReader(state) : state.isReadOnly;
}
// Returned arrows (resumable; a conditional bare arrow is not).
function disabledReader(state: RadioGroupState): () => boolean {
  return () => isRadioGroupDisabled(state);
}
function readOnlyReader(state: RadioGroupState): () => boolean {
  return () => isRadioGroupReadOnly(state);
}
function groupRequired(state: RadioGroupState): (() => boolean) | boolean {
  return state.required ? requiredReader(state) : state.isRequired;
}
function requiredReader(state: RadioGroupState): () => boolean {
  return () => isRadioGroupRequired(state);
}
const flagAttr = (flag: (() => boolean) | boolean) => (typeof flag === "function" ? liveFlag(flag) : flag || undefined);
const flagAria = (flag: (() => boolean) | boolean) => (typeof flag === "function" ? liveAria(flag) : flag ? "true" : undefined);

/** The compound `RadioGroup` (RAC). */
/** A live `orientation` with its default (a returned arrow: resumable). */
function liveOrientation(orientation: () => Orientation | undefined): () => Orientation {
  return () => orientation() ?? "vertical";
}

export function RadioGroupParts(props: RadioGroupPartsProps) {
  // Live props (P5): `isDisabled` / `isReadOnly` / `isInvalid` and a controlled `value` stay live (accessors into the state), class / style /
  // children from a live view; the rest of the body is read once (untracked).
  return untrack(() => radioGroupParts(props));
}

function radioGroupParts(props: RadioGroupPartsProps) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null as never;
  const [ctxMerged, ref] = contextProps(props, props.ref, RadioGroupContext as never) as [RadioGroupPartsProps, RefValue<HTMLDivElement> | undefined];
  const merged = hasLive(ctxMerged) ? liveOptions(ctxMerged, GROUP_LIVE as never, ["value"] as never) : ctxMerged;
  const validationBehavior = formValidationBehavior(merged.validationBehavior);
  const isRequired = (merged.isRequired ?? false) as RadioGroupStateOptions["isRequired"];
  const state: RadioGroupState = createRadioGroupState({
    value: merged.value,
    defaultValue: merged.defaultValue,
    onChange: merged.onChange,
    name: merged.name,
    isDisabled: merged.isDisabled as RadioGroupStateOptions["isDisabled"],
    isReadOnly: merged.isReadOnly as RadioGroupStateOptions["isReadOnly"],
    isRequired,
    isInvalid: merged.isInvalid,
    validate: merged.validate,
    validationBehavior,
    validationErrors: formValidationErrors(),
  });
  const isDisabled = groupDisabled(state),
    isReadOnly = groupReadOnly(state);
  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  const id = merged.id ?? createId();
  // Radio group is not an HTML input element so it shouldn't be labeled by a <label> element.
  const ids = fieldProps({
    id,
    label: initialLabel,
    labelElementType: "span",
    "aria-label": merged["aria-label"],
    "aria-labelledby": merged["aria-labelledby"],
  });
  const isInvalid = () => displayValidation(state.validation).isInvalid;
  const descriptionId = createSlotId(id + "-description");
  const errorMessageId = createSlotId(ids.errorMessageId, isInvalid);
  state.data = { form: merged.form, descriptionId, errorMessageId, validationBehavior };
  const orientationProp = merged.orientation as MaybeAccessor<Orientation | undefined>;
  // A live `orientation` (accessor) goes into the spread bags as a returned arrow; static: the value.
  const orientation = typeof orientationProp === "function" ? liveOrientation(orientationProp) : (orientationProp ?? "vertical");
  const labelledBy = ids.fieldProps["aria-labelledby"];
  const ownLabelledBy = merged["aria-labelledby"];
  const extraDescribedBy = merged["aria-describedby"] as MaybeAccessor<string | undefined>;
  const { onFocus, onBlur, onFocusChange } = merged;
  const groupProps: PropBag = {
    id,
    role: "radiogroup",
    "aria-orientation": orientation,
    "aria-invalid": () => (isInvalid() ? "true" : undefined),
    "aria-errormessage": merged["aria-errormessage"],
    "aria-disabled": flagAria(isDisabled),
    "aria-readonly": flagAria(isReadOnly),
    "aria-required": flagAria(groupRequired(state)),
    "data-disabled": flagAttr(isDisabled),
    "data-readonly": flagAttr(isReadOnly),
    "aria-label": ids.fieldProps["aria-label"],
    "aria-labelledby": () => (initialLabel && hasLabel() ? labelledBy : initialLabel ? ownLabelledBy : labelledBy),
    "aria-describedby": () =>
      [slotIdRef(descriptionId, false), slotIdRef(errorMessageId, isInvalid()), read(extraDescribedBy)].filter(Boolean).join(" ") || undefined,
    "aria-details": merged["aria-details"],
    onFocusIn: (event: FocusEvent) => {
      if (!(onFocus || onFocusChange)) return;
      const group = event.currentTarget as HTMLElement;
      if (group.contains(event.relatedTarget as Node | null)) return;
      onFocus?.(event);
      onFocusChange?.(true);
    },
    onFocusOut: (event: FocusEvent) => {
      radioGroupFocusOut(state, event);
      if (!(onBlur || onFocusChange) || (event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) return;
      onBlur?.(event);
      onFocusChange?.(false);
    },
  };
  const groupValues: RadioGroupRenderProps = {
    orientation: () => read(orientation),
    isDisabled: () => isRadioGroupDisabled(state),
    isReadOnly: () => isRadioGroupReadOnly(state),
    isRequired: () => isRadioGroupRequired(state),
    isInvalid,
    state,
  };
  const rp = renderPropsOf(merged, { values: groupValues, defaultClassName: "rv-RadioGroup" });
  // Object-literal function value (a resumable symbol; a provider entry holding a plain local arrow is dropped on re-creation).
  const fieldError = {
    validation: (): ValidationResult => displayValidation(state.validation),
  };
  const dom = mergeProps(globalDOMProps(merged, ["style", "render", "id"]), groupProps);
  const slot = merged.slot || undefined;
  const values: ProviderValue<any>[] = [
    [RadioGroupStateContext, state],
    [LabelContext, { ...ids.labelProps, ref: labelRef, elementType: "span" }],
    [TextContext, { slots: { description: { id: descriptionId }, errorMessage: { id: errorMessageId } } }],
    [FieldErrorContext, fieldError.validation],
  ];
  // Rivet (server): inputs render before the Description / FieldError: probe which slotted parts render (as Select).
  if (typeof document === "undefined") probeSlots(values, () => rp.children());
  if (merged.render)
    return merged.render(
      {
        ...dom,
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        slot,
        "data-orientation": orientation,
        "data-invalid": () => isInvalid() || undefined,
        "data-required": () => isRadioGroupRequired(state) || undefined,
        children: () => (
          <Provider values={values}>
            <SharedElementTransition>{rp.children()}</SharedElementTransition>
          </Provider>
        ),
      } as never,
      groupValues,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      class={rp.class()}
      style={rp.style()}
      slot={slot}
      data-orientation={read(orientation)}
      data-invalid={isInvalid() || undefined}
      data-required={isRadioGroupRequired(state) || undefined}
    >
      <Provider values={values}>
        <SharedElementTransition>{rp.children()}</SharedElementTransition>
      </Provider>
    </div>
  );
}

/** RA `useRadio`: the label / input bags of one radio of `state`. */
export function radioProps(props: AriaRadioProps, state: RadioGroupState, inputRef: InputRef): RadioAria {
  const { value, onPressStart, onPressEnd, onPressChange, onPress, onPressUp } = props;
  const isDisabledProp = props.isDisabled;
  const isDisabled = () => !!read(isDisabledProp) || isRadioGroupDisabled(state);
  const isSelected = () => state.selectedValue() === value;
  const data = state.data as RadioGroupData | undefined;
  const validationBehavior = data?.validationBehavior ?? state.validation.behavior;
  const isInvalid = () => displayValidation(state.validation).isInvalid;

  // Handle press state for keyboard interactions and cases where labelProps is not used.
  const { pressProps: inputPress, isPressed: inputPressed } = pressProps({ onPressStart, onPressEnd, onPressChange, onPress, onPressUp, isDisabled });
  // Handle press state on the label (selection itself is the native label activation).
  const { pressProps: labelPress, isPressed: labelPressed } = pressProps({ onPressStart, onPressEnd, onPressChange, onPress, onPressUp, isDisabled });

  const inputId = props.id;
  const descriptionId = createSlotId(inputId ? inputId + "-description" : undefined);
  const ownDescribedBy = props["aria-describedby"];
  const { onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp } = props;

  const inputProps: PropBag = mergeProps(
    {
      id: inputId,
      "aria-label": props["aria-label"],
      "aria-labelledby": props["aria-labelledby"],
      "aria-details": props["aria-details"],
    },
    {
      ref: inputRef,
      type: "radio",
      name: state.name,
      form: data?.form,
      value,
      checked: isSelected,
      disabled: () => isDisabled() || undefined,
      required: validationBehavior !== "native" ? undefined : state.required ? liveFlag(requiredReader(state)) : state.isRequired || undefined,
      "aria-describedby": () =>
        [slotIdRef(descriptionId, false), ownDescribedBy, isInvalid() ? slotIdRef(data?.errorMessageId) : null, slotIdRef(data?.descriptionId, false)]
          .filter(Boolean)
          .join(" ") || undefined,
      "data-rv-error": () => validityError(state.validation),
      onChange: (event: Event) => radioChange(state, value, event),
      onFocus: (event: FocusEvent) => {
        radioFocus(state, value, event);
        onFocus?.(event);
        onFocusChange?.(true);
      },
      onBlur: (event: FocusEvent) => {
        onBlur?.(event);
        onFocusChange?.(false);
      },
      onKeyDown: (event: KeyboardEvent) => onKeyDown?.(event),
      onKeyUp: (event: KeyboardEvent) => onKeyUp?.(event),
      onInvalid: (event: Event) => radioInvalid(state, event),
    },
    inputPress,
  );

  return {
    // Prevent label from being focused when mouse down on it (the click still focuses the input).
    labelProps: mergeProps(labelPress, { onMouseDown: (e: MouseEvent) => e.preventDefault() }),
    inputProps,
    descriptionProps: { id: descriptionId },
    isSelected,
    isPressed: () => inputPressed() || labelPressed(),
    isDisabled,
  };
}

interface InternalRadioContextValue extends RadioAria {
  inputRef: InputRef;
  defaultClassName: string;
}

const InternalRadioContext = resumableContext(createContext<InternalRadioContextValue | null>(null, { id: "rv-radio-internal" }));

/**
 * A RadioField represents an individual option within a radio group, containing a RadioButton and optional description.
 */
export function RadioField(props: RadioFieldProps) {
  // Live props (P5): `isDisabled` stays live, class / style / children from a live view; the rest is read once.
  return untrack(() => radioField(props));
}

/** A radio's own props for `radioProps`: a live `isDisabled` becomes an accessor; `children` only says whether there is a label. */
function ownRadioProps<P extends AriaRadioProps>(merged: P): AriaRadioProps {
  if (!hasLive(merged)) return { ...merged, children: typeof merged.children === "function" ? true : merged.children };
  const own = liveOptions(merged, ["isDisabled"] as never);
  return liveAssign(own, { children: typeof merged.children === "function" ? true : merged.children === undefined ? undefined : true });
}

function radioField(props: RadioFieldProps) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null as never;
  const userInputRef = props.inputRef;
  const otherProps = hasLive(props) ? liveOmit(props, ["inputRef"]) : (({ inputRef: _, ...rest }) => rest)(props);
  const [merged, ref] = contextProps(otherProps as RadioFieldProps, props.ref, RadioFieldContext as never) as [
    RadioFieldProps,
    RefValue<HTMLDivElement> | undefined,
  ];
  const state = useContext(RadioGroupStateContext)!;
  const inputRef = mergeInputRefs(userInputRef, merged.inputRef);
  const aria = radioProps(ownRadioProps(merged), state, inputRef);
  const { descriptionProps, isSelected, isDisabled } = aria;
  const isInvalid = () => displayValidation(state.validation).isInvalid;
  const fieldValues: RadioFieldRenderProps = {
    isSelected,
    isDisabled,
    isReadOnly: () => isRadioGroupReadOnly(state),
    isInvalid,
    isRequired: () => isRadioGroupRequired(state),
  };
  const rp = renderPropsOf(merged, { defaultClassName: "rv-RadioField", values: fieldValues });
  // `data-readonly` through the spread: an accessor while the group's `isReadOnly` is live.
  const dom = liveAssign(globalDOMProps(merged, DOM_OWNED), { "data-readonly": flagAttr(groupReadOnly(state)) });
  const slot = merged.slot || undefined;
  const selection = { isSelected };
  const values: ProviderValue<any>[] = [
    [SelectionIndicatorContext, selection],
    [InternalRadioContext, { ...aria, inputRef, defaultClassName: "rv-RadioButton" }],
    [TextContext, { slots: { description: descriptionProps } }],
  ];
  // Rivet (server): inputs render before the Description / FieldError: probe which slotted parts render (as Select).
  if (typeof document === "undefined") probeSlots(values, () => rp.children());
  if (merged.render)
    return merged.render(
      {
        ...dom,
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        slot,
        "data-selected": () => isSelected() || undefined,
        "data-disabled": () => isDisabled() || undefined,
        "data-invalid": () => isInvalid() || undefined,
        "data-required": () => isRadioGroupRequired(state) || undefined,
        children: () => <Provider values={values}>{rp.children()}</Provider>,
      } as never,
      fieldValues,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      class={rp.class()}
      style={rp.style()}
      slot={slot}
      data-selected={isSelected() || undefined}
      data-disabled={isDisabled() || undefined}
      data-invalid={isInvalid() || undefined}
      data-required={isRadioGroupRequired(state) || undefined}
    >
      <Provider values={values}>{rp.children()}</Provider>
    </div>
  );
}

/**
 * A radio represents an individual option within a radio group.
 *
 * @deprecated Use RadioField + RadioButton instead.
 */
export function Radio(props: RadioProps) {
  // Live props (P5): as RadioField; the button renders by a direct call (a component spread of a live props object
  // re-created the region on a resumed page: see checkbox/CLAUDE.md).
  return untrack(() => radio(props));
}

function radio(props: RadioProps) {
  const userInputRef = props.inputRef;
  const otherProps = hasLive(props) ? liveOmit(props, ["inputRef"]) : (({ inputRef: _, ...rest }) => rest)(props);
  const [merged, ref] = contextProps(otherProps as RadioProps, props.ref, RadioContext as never) as [RadioProps, RefValue<HTMLLabelElement> | undefined];
  const state = useContext(RadioGroupStateContext)!;
  const inputRef = mergeInputRefs(userInputRef, merged.inputRef);
  const aria = radioProps(ownRadioProps(merged), state, inputRef);
  const value: InternalRadioContextValue = { ...aria, inputRef, defaultClassName: "rv-Radio" };
  const button = liveAssign(merged, { ref }) as RadioButtonProps;
  const selection = { isSelected: aria.isSelected };
  return (
    <Provider
      values={[
        [InternalRadioContext, value],
        [SelectionIndicatorContext, selection],
      ]}
    >
      {untrack(() => RadioButton(button))}
    </Provider>
  );
}

/**
 * A RadioButton is the clickable area of a radio, including the indicator and label.
 */
export function RadioButton(props: RadioButtonProps) {
  // Live props (P5): class / style / children from a live view; the rest is read once (untracked).
  return untrack(() => radioButton(props));
}

function radioButton(props: RadioButtonProps) {
  const { labelProps, inputProps, isSelected, isDisabled, isPressed, defaultClassName, inputRef } = useContext(InternalRadioContext)!;
  const state = useContext(RadioGroupStateContext)!;
  const buttonRef = props.ref;
  const { isFocused, isFocusVisible, focusProps } = useFocusRing();
  const interactionDisabled = () => isDisabled() || isRadioGroupReadOnly(state);
  const { onHoverStart, onHoverEnd, onHoverChange } = props;
  const { hoverProps: hover, isHovered } = hoverProps({ onHoverStart, onHoverEnd, onHoverChange, isDisabled: interactionDisabled }, props);
  const isInvalid = () => displayValidation(state.validation).isInvalid;
  const buttonValues: RadioButtonRenderProps = {
    isSelected,
    isPressed,
    isHovered,
    isFocused,
    isFocusVisible,
    isDisabled,
    isReadOnly: () => isRadioGroupReadOnly(state),
    isInvalid,
    isRequired: () => isRadioGroupRequired(state),
  };
  const rp = renderPropsOf(props, { defaultClassName, values: buttonValues });
  // `data-readonly` through the spread: an accessor while the group's `isReadOnly` is live.
  const dom = mergeProps(globalDOMProps(props, DOM_OWNED), labelProps, hover, { "data-readonly": flagAttr(groupReadOnly(state)) });
  const input = mergeProps(inputProps, focusProps);
  const slot = props.slot || undefined;
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: buttonRef as never,
        class: () => rp.class(),
        style: () => rp.style(),
        slot,
        "data-selected": () => isSelected() || undefined,
        "data-pressed": () => isPressed() || undefined,
        "data-hovered": () => isHovered() || undefined,
        "data-focused": () => isFocused() || undefined,
        "data-focus-visible": () => isFocusVisible() || undefined,
        "data-disabled": () => isDisabled() || undefined,
        "data-invalid": () => isInvalid() || undefined,
        "data-required": () => isRadioGroupRequired(state) || undefined,
        children: () => (
          <>
            <span style={visuallyHidden}>
              <input {...input} ref={inputRef as never} />
            </span>
            {rp.children()}
          </>
        ),
      } as never,
      buttonValues as never,
    );
  return (
    <label
      {...dom}
      ref={buttonRef as never}
      class={rp.class()}
      style={rp.style()}
      slot={slot}
      data-selected={isSelected() || undefined}
      data-pressed={isPressed() || undefined}
      data-hovered={isHovered() || undefined}
      data-focused={isFocused() || undefined}
      data-focus-visible={isFocusVisible() || undefined}
      data-disabled={isDisabled() || undefined}
      data-invalid={isInvalid() || undefined}
      data-required={isRadioGroupRequired(state) || undefined}
    >
      <span style={visuallyHidden}>
        <input {...input} ref={inputRef as never} />
      </span>
      {rp.children()}
    </label>
  );
}
