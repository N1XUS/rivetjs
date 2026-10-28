// Ported from react-aria-components `Checkbox` (packages/react-aria-components/src/Checkbox.tsx), Apache-2.0, © Adobe.
// CheckboxGroup, CheckboxField, CheckboxButton and the deprecated all-in-one Checkbox.
// Rivet:
// - render props are accessors (`{({ isSelected }) => (isSelected() ? <Check /> : null)}`); `class` / `style`
//   may be functions of them (RAC `className` → `class`); state `data-*` attributes are bindings.
// - `isSelected`: a plain value (controlled), a two-way Signal, or an accessor (`() => boolean`, controlled and
//   live); `isIndeterminate` / `isDisabled` / `isInvalid` may be accessors.
// - the native input sits in an inline-styled visually hidden span (RA `VisuallyHidden`); `indeterminate` is
//   bound as a DOM property (`prop:indeterminate`) only when `isIndeterminate` is given (absent / `false`: the property
//   keeps its default, and a resumed page records no load-time effect for it — UI-COLD 2026-10-08).
// - `InternalCheckboxContext` is resumable (`rv-checkbox-internal`): CheckboxButton reads the field's
//   behaviour bags from it.
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, <part>RenderProps)` instead of the default element (CheckboxGroup / CheckboxField `<div>`, CheckboxButton / Checkbox `<label>` with the hidden input inside `children`). Deviations: `inputRef` is a Rivet `ref()` (or callback).
import { CheckboxContext, CheckboxFieldContext, CheckboxGroupContext, CheckboxGroupStateContext } from "./contexts.ts";
import { probeSlots, slotProbing } from "#server";
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { mergeProps as mergeLive } from "@rivetjs/runtime/props";
import { hasLive, liveOmit, liveOptions, liveWithoutData } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import { read, type MaybeAccessor, type ValidationResult } from "../state/form-validation.ts";
import {
  createCheckboxGroupState,
  isCheckboxGroupDisabled,
  isCheckboxGroupReadOnly,
  isCheckboxGroupRequired,
  type CheckboxGroupState,
  type CheckboxGroupStateOptions,
} from "../state/checkbox-group.ts";
import { createToggleState } from "../state/toggle.ts";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { FieldErrorContext } from "../form/field-error.tsx";
import { LabelContext } from "../label/index.tsx";
import { TextContext } from "../text/index.tsx";
import { visuallyHidden } from "../a11y/index.ts";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { hoverProps, type HoverEvents } from "../interactions/hover.tsx";
import { mergeInto, mergeProps } from "../interactions/merge-props.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import {
  Provider,
  contextProps,
  createSlot,
  renderProps,
  renderPropsOf,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import {
  checkboxGroupItemProps,
  checkboxGroupProps,
  checkboxProps,
  mergeInputRefs,
  type AriaCheckboxGroupProps,
  type AriaCheckboxProps,
  type InputRef,
  type ToggleAria,
} from "./behaviour.tsx";

export type { CheckboxGroupState } from "../state/checkbox-group.ts";

export interface CheckboxGroupProps
  extends
    Omit<AriaCheckboxGroupProps, "label" | "validationBehavior">,
    Omit<CheckboxGroupStateOptions, "validationBehavior" | "validationErrors">,
    RACValidation,
    RenderProps<CheckboxGroupRenderProps>,
    DOMRenderProps<"div", CheckboxGroupRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-CheckboxGroup'
   */
  class?: RenderProps<CheckboxGroupRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

export interface CheckboxProps
  extends
    Omit<AriaCheckboxProps, "children" | "validationBehavior" | "validationErrors">,
    HoverEvents,
    RACValidation,
    RenderProps<CheckboxRenderProps>,
    DOMRenderProps<"label", CheckboxRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLLabelElement>, "onClick" | "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-Checkbox'
   */
  class?: RenderProps<CheckboxRenderProps>["class"];
  /** A ref for the HTML input element. */
  inputRef?: InputRef;
  ref?: RefValue<HTMLLabelElement>;
}

export interface CheckboxFieldProps
  extends
    Omit<AriaCheckboxProps, "children" | "validationBehavior" | "validationErrors">,
    RACValidation,
    RenderProps<CheckboxFieldRenderProps>,
    DOMRenderProps<"div", CheckboxFieldRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "onClick" | "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-CheckboxField'
   */
  class?: RenderProps<CheckboxFieldRenderProps>["class"];
  /** A ref for the HTML input element. */
  inputRef?: InputRef;
  ref?: RefValue<HTMLDivElement>;
}

export interface CheckboxButtonProps
  extends
    HoverEvents,
    RenderProps<CheckboxButtonRenderProps>,
    DOMRenderProps<"label", CheckboxButtonRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLLabelElement>, "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-CheckboxButton'
   */
  class?: RenderProps<CheckboxButtonRenderProps>["class"];
  ref?: RefValue<HTMLLabelElement>;
}

export interface CheckboxGroupRenderProps {
  /**
   * Whether the checkbox group is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the checkbox group is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /**
   * Whether the checkbox group is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
  /**
   * Whether the checkbox group is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /** State of the checkbox group. */
  state: CheckboxGroupState;
}

export interface CheckboxFieldRenderProps {
  /**
   * Whether the checkbox is selected.
   *
   * @selector [data-selected]
   */
  isSelected: () => boolean;
  /**
   * Whether the checkbox is indeterminate.
   *
   * @selector [data-indeterminate]
   */
  isIndeterminate: () => boolean;
  /**
   * Whether the checkbox is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the checkbox is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /**
   * Whether the checkbox invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the checkbox is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
}

export interface CheckboxRenderProps extends CheckboxFieldRenderProps {
  /**
   * Whether the checkbox is currently hovered with a mouse.
   *
   * @selector [data-hovered]
   */
  isHovered: () => boolean;
  /**
   * Whether the checkbox is currently in a pressed state.
   *
   * @selector [data-pressed]
   */
  isPressed: () => boolean;
  /**
   * Whether the checkbox is focused, either via a mouse or keyboard.
   *
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the checkbox is keyboard focused.
   *
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
}

export interface CheckboxButtonRenderProps extends CheckboxRenderProps {}

const DOM_OWNED = ["style", "onClick", "render"] as const;

/** State keys made accessors at the part boundary when live (live props P5; `isSelected` = controlled). */
const LIVE_KEYS = [
  "isDisabled",
  "isReadOnly",
  "isRequired",
  "isInvalid",
  "isIndeterminate",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-details",
  "aria-errormessage",
  "aria-controls",
] as const;

/**
 * A checkbox group allows a user to select multiple items from a list of options.
 */
export function CheckboxGroup(props: CheckboxGroupProps) {
  // Live props (P5): `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` and a controlled `value` stay live
  // (accessors into the state), class / style / children from a live view; the rest of the body is read once
  // (untracked: a prop change never re-creates the group).
  return untrack(() => checkboxGroup(props));
}

const GROUP_LIVE = ["isDisabled", "isReadOnly", "isRequired", "isInvalid"] as const;

/** A group flag attribute: the creation value, or a returned accessor while the flag is live (resumable). */
function flagAttr(live: (() => boolean | undefined) | undefined, now: boolean): (() => true | undefined) | true | undefined {
  return live ? trueOf(live) : now || undefined;
}
function trueOf(flag: () => boolean | undefined): () => true | undefined {
  return () => !!flag() || undefined;
}
function groupReader(state: CheckboxGroupState, which: 0 | 1 | 2): () => boolean {
  return () => (which === 0 ? isCheckboxGroupDisabled(state) : which === 1 ? isCheckboxGroupReadOnly(state) : isCheckboxGroupRequired(state));
}

function checkboxGroup(props: CheckboxGroupProps) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const [ctxMerged, ref] = contextProps(props, props.ref, CheckboxGroupContext);
  const merged = hasLive(ctxMerged) ? liveOptions(ctxMerged, GROUP_LIVE as never, ["value"]) : ctxMerged;
  const validationBehavior = formValidationBehavior(merged.validationBehavior);
  const options = merged === ctxMerged ? merged : { ...merged };
  const state = createCheckboxGroupState({ ...options, validationBehavior, validationErrors: formValidationErrors() } as CheckboxGroupStateOptions);
  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  const { groupProps, labelProps, descriptionProps, errorMessageProps, isInvalid, validationErrors, validationDetails } = checkboxGroupProps(
    { ...options, label: initialLabel, validationBehavior } as never,
    state,
  );
  const labelledBy = groupProps["aria-labelledby"];
  const ownLabelledBy = merged["aria-labelledby"];
  const group = { ...groupProps, "aria-labelledby": () => (initialLabel && hasLabel() ? labelledBy : initialLabel ? ownLabelledBy : labelledBy) };

  const isDisabled = flagAttr(state.disabled, state.isDisabled);
  const isReadOnly = flagAttr(state.readOnly, state.isReadOnly);
  const isRequired = flagAttr(state.requiredNow, state.required);
  const groupValues = {
    isDisabled: groupReader(state, 0),
    isReadOnly: groupReader(state, 1),
    isRequired: groupReader(state, 2),
    isInvalid,
    state,
  };
  // Live props (P5): class / style / children through a live view (`renderPropsOf`).
  const rp = renderPropsOf(merged, { values: groupValues, defaultClassName: "rv-CheckboxGroup" });
  // Object-literal function value (R2 makes it a resumable symbol; a plain local const arrow is not, and a
  // provider entry holding one is dropped when a resumed region is re-created).
  const fieldError = {
    validation: (): ValidationResult => ({ isInvalid: isInvalid(), validationErrors: validationErrors(), validationDetails: validationDetails() }),
  };
  // The flags go through the spread: a function (live) attribute value outside a spread is not a server binding, and a
  // plain JSX attribute of the same name would take the key from the spread.
  const dom = mergeProps(globalDOMProps(merged, ["style", "render"]), group, {
    "data-readonly": isReadOnly,
    "data-required": isRequired,
    "data-disabled": isDisabled,
  });
  const slot = merged.slot || undefined;
  const values: ProviderValue<any>[] = [
    [CheckboxGroupStateContext, state],
    [LabelContext, { ...labelProps, ref: labelRef, elementType: "span" }],
    [TextContext, { slots: { description: descriptionProps, errorMessage: errorMessageProps } }],
    [FieldErrorContext, fieldError.validation],
  ];
  // Rivet (server): inputs render before the Description / FieldError: probe which slotted parts render (as Select).
  if (typeof document === "undefined") probeSlots(values, () => rp.children());
  const render = merged.render;
  if (render)
    return render(
      {
        ...dom,
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        slot,
        "data-invalid": () => isInvalid() || undefined,
        children: () => <Provider values={values}>{rp.children()}</Provider>,
      } as never,
      groupValues,
    );
  return (
    <div {...dom} ref={ref as never} class={rp.class()} style={rp.style()} slot={slot} data-invalid={isInvalid() || undefined}>
      <Provider values={values}>{rp.children()}</Provider>
    </div>
  );
}

interface InternalCheckboxContextValue extends ToggleAria {
  defaultClassName: string;
  isIndeterminate?: MaybeAccessor<boolean | undefined>;
  isRequired?: MaybeAccessor<boolean | undefined>;
}

const InternalCheckboxContext = createContext<InternalCheckboxContextValue | null>(null);

/** RAC `useCheckboxAria`: group item or standalone checkbox behaviour. */
function checkboxAria(props: CheckboxProps | CheckboxFieldProps, userInputRef: InputRef | undefined): ToggleAria {
  const validationBehavior = formValidationBehavior(props.validationBehavior);
  const groupState = useContext(CheckboxGroupStateContext);
  const inputRef = mergeInputRefs(userInputRef, props.inputRef);
  // Live props (P5): `props` passed `liveOptions` (accessors for the live state keys); the option bags forward unread.
  const children = untrack(() => props.children);
  const options = mergeLive(liveWithoutData(props), {
    children: typeof children === "function" ? true : children,
    validationBehavior,
  }) as AriaCheckboxProps;
  if (groupState) return checkboxGroupItemProps(mergeLive(options, { value: untrack(() => props.value!) }) as never, groupState, inputRef);
  return checkboxProps(mergeLive(options, { validationErrors: formValidationErrors() }) as never, createToggleState(props), inputRef);
}

/**
 * A checkbox allows a user to select an item, with support for validation and help text.
 */
export function CheckboxField(props: CheckboxFieldProps) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const userInputRef = props.inputRef;
  const otherProps = liveOmit(props, ["inputRef"]);
  const [ctxMerged, ref] = contextProps(otherProps as CheckboxFieldProps, props.ref, CheckboxFieldContext);
  // Live props (P5): state keys become accessors at the boundary (read by the toggle / validation / attribute code).
  const merged = liveOptions(ctxMerged, LIVE_KEYS, ["isSelected"]);
  const live = merged !== ctxMerged || hasLive(ctxMerged);
  const groupState = useContext(CheckboxGroupStateContext);
  const aria = untrack(() => checkboxAria(merged, userInputRef));
  const { descriptionProps, errorMessageProps, isSelected, isDisabled, isReadOnly, isInvalid, validationDetails, validationErrors } = aria;
  const indeterminate = untrack(() => merged.isIndeterminate);
  const isIndeterminate = () => !!read(indeterminate);
  const requiredProp = untrack(() => merged.isRequired) as MaybeAccessor<boolean | undefined>;
  const isRequired = () => !!read(requiredProp);
  const fieldValues = { isSelected, isIndeterminate, isDisabled, isReadOnly, isInvalid, isRequired };
  const rp = live
    ? renderProps({ defaultClassName: "rv-CheckboxField", values: fieldValues }, liveRenderProps(merged) as never)
    : renderProps({
        ...merged,
        defaultClassName: "rv-CheckboxField",
        values: fieldValues,
      });
  const dom = globalDOMProps(merged, DOM_OWNED);
  const slot = untrack(() => merged.slot) || undefined;
  // Object-literal function value (R2 makes it a resumable symbol; a plain local const arrow is not, and a
  // provider entry holding one is dropped when a resumed region is re-created).
  const fieldError = {
    validation: (): ValidationResult => ({ isInvalid: isInvalid(), validationErrors: validationErrors(), validationDetails: validationDetails() }),
  };
  const values: ProviderValue<any>[] = [
    [InternalCheckboxContext, { ...aria, defaultClassName: "rv-CheckboxButton", isIndeterminate: indeterminate, isRequired: requiredProp }],
    [TextContext, { slots: { description: descriptionProps, errorMessage: errorMessageProps } }],
    // In a CheckboxGroup, validation is handled at the group level instead of repeated on each checkbox.
    [FieldErrorContext, groupState ? null : fieldError.validation],
  ];
  // Rivet (server): the input renders before its Description / FieldError: probe which slotted parts render (as Select).
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
        "data-indeterminate": () => isIndeterminate() || undefined,
        "data-disabled": () => isDisabled() || undefined,
        "data-readonly": () => isReadOnly() || undefined,
        "data-invalid": () => isInvalid() || undefined,
        "data-required": () => isRequired() || undefined,
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
      data-indeterminate={isIndeterminate() || undefined}
      data-disabled={isDisabled() || undefined}
      data-readonly={isReadOnly() || undefined}
      data-invalid={isInvalid() || undefined}
      data-required={isRequired() || undefined}
    >
      <Provider values={values}>{rp.children()}</Provider>
    </div>
  );
}

/**
 * A checkbox allows a user to select multiple items from a list of individual items, or
 * to mark one individual item as selected.
 *
 * @deprecated Use CheckboxField + CheckboxButton instead.
 */
export function Checkbox(props: CheckboxProps) {
  const userInputRef = props.inputRef;
  const otherProps = liveOmit(props, ["inputRef"]);
  const [ctxMerged, ref] = contextProps(otherProps as CheckboxProps, props.ref, CheckboxContext);
  const merged = liveOptions(ctxMerged, LIVE_KEYS, ["isSelected"]);
  const aria = untrack(() => checkboxAria(merged, userInputRef));
  const value: InternalCheckboxContextValue = {
    ...aria,
    defaultClassName: "rv-Checkbox",
    isIndeterminate: untrack(() => merged.isIndeterminate),
    isRequired: untrack(() => merged.isRequired),
  };
  const button = (hasLive(merged) ? mergeLive(merged, { ref }) : { ...merged, ref }) as CheckboxButtonProps;
  return (
    <Provider values={[[InternalCheckboxContext, value]]}>
      <CheckboxButton {...button} />
    </Provider>
  );
}

/** `clientEffect` body of an indeterminate checkbox: nothing to do, the trigger alone boots the boundary. */
const bootIndeterminate = (): void => {};

/**
 * A checkbox button is the clickable area of a checkbox, including the indicator and label.
 */
export function CheckboxButton(props: CheckboxButtonProps) {
  const { labelProps, inputProps, isSelected, isDisabled, isReadOnly, isPressed, isInvalid, inputRef, defaultClassName, isIndeterminate, isRequired } =
    useContext(InternalCheckboxContext)!;
  const buttonRef = props.ref;
  const { isFocused, isFocusVisible, focusProps } = useFocusRing();
  const isInteractionDisabled = () => isDisabled() || isReadOnly();
  const { onHoverStart, onHoverEnd, onHoverChange } = props;
  const { hoverProps: hover, isHovered } = hoverProps({ onHoverStart, onHoverEnd, onHoverChange, isDisabled: isInteractionDisabled }, props);
  const indeterminate = () => !!read(isIndeterminate);
  const required = () => !!read(isRequired);
  const buttonValues = {
    isSelected,
    isIndeterminate: indeterminate,
    isPressed,
    isHovered,
    isFocused,
    isFocusVisible,
    isDisabled,
    isReadOnly,
    isInvalid,
    isRequired: required,
  };
  const rp = hasLive(props)
    ? renderProps({ defaultClassName, values: buttonValues }, liveRenderProps(props) as never)
    : renderProps({
        ...props,
        defaultClassName,
        values: buttonValues,
      });
  // `globalDOMProps` returns a fresh bag: merged into in place (static path).
  const dom = mergeInto(globalDOMProps(props, DOM_OWNED), labelProps, hover);
  const input = mergeProps(inputProps, focusProps);
  // `prop:indeterminate` is a load-time DOM property write on a resumed page (a client effect: the runtime boots at
  // idle). Without an `isIndeterminate` (absent / plain `false`) the input keeps the property's default (`false`, RA's
  // effect writes the same), so it is bound only when given.
  const indeterminateGiven = isIndeterminate !== undefined && isIndeterminate !== false;
  // The server cannot write the property: an instance rendered indeterminate boots its boundary at idle (a load-time
  // client trigger) so the adopt run's `prop:indeterminate` binding sets it before the first input (SELECT-B). Same
  // value on both sides, so the adopt run takes the same branch.
  if (indeterminateGiven && untrack(indeterminate)) clientEffect(bootIndeterminate);
  const nativeInput = () =>
    indeterminateGiven ? <input {...input} ref={inputRef as never} prop:indeterminate={indeterminate()} /> : <input {...input} ref={inputRef as never} />;
  const slot = untrack(() => props.slot) || undefined;
  const render = untrack(() => props.render);
  if (render)
    return render(
      {
        ...dom,
        ref: buttonRef as never,
        class: () => rp.class(),
        style: () => rp.style(),
        slot,
        "data-selected": () => isSelected() || undefined,
        "data-indeterminate": () => indeterminate() || undefined,
        "data-pressed": () => isPressed() || undefined,
        "data-hovered": () => isHovered() || undefined,
        "data-focused": () => isFocused() || undefined,
        "data-focus-visible": () => isFocusVisible() || undefined,
        "data-disabled": () => isDisabled() || undefined,
        "data-readonly": () => isReadOnly() || undefined,
        "data-invalid": () => isInvalid() || undefined,
        "data-required": () => required() || undefined,
        children: () => (
          <>
            <span style={visuallyHidden}>{nativeInput()}</span>
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
      data-indeterminate={indeterminate() || undefined}
      data-pressed={isPressed() || undefined}
      data-hovered={isHovered() || undefined}
      data-focused={isFocused() || undefined}
      data-focus-visible={isFocusVisible() || undefined}
      data-disabled={isDisabled() || undefined}
      data-readonly={isReadOnly() || undefined}
      data-invalid={isInvalid() || undefined}
      data-required={required() || undefined}
    >
      <span style={visuallyHidden}>{nativeInput()}</span>
      {rp.children()}
    </label>
  );
}

export { CheckboxContext, CheckboxFieldContext, CheckboxGroupContext, CheckboxGroupStateContext };
