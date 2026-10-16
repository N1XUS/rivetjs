// Ported from react-aria-components `Switch` (packages/react-aria-components/src/Switch.tsx), Apache-2.0, © Adobe.
// Switch, SwitchField and SwitchButton.
// Rivet:
// - render props are accessors (`{({ isSelected }) => …}`); `class` / `style` may be functions of them.
// - `isSelected`: a plain value (controlled), a two-way Signal or an accessor; `isDisabled` may be an accessor.
// - the native input sits in an inline-styled visually hidden span (RA `VisuallyHidden`).
// - `ToggleStateContext` / `InternalSwitchContext` are resumable (`rv-toggle-state`, `rv-switch-internal`).
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, <part>RenderProps)` instead of the default element (SwitchField `<div>`, SwitchButton / Switch `<label>` with the hidden input inside `children`). Deviations: `inputRef` is a Rivet `ref()` (or callback).
import { liveAssign, liveOmit, liveOptions, liveWithoutData } from "../utils/live.tsx";
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { read, type MaybeAccessor, type ValidationResult } from "../state/form-validation.ts";
import { createToggleState, type ToggleState } from "../state/toggle.ts";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { FieldErrorContext } from "../form/field-error.tsx";
import { TextContext } from "../text/index.tsx";
import { visuallyHidden } from "../a11y/index.ts";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { hoverProps, type HoverEvents } from "../interactions/hover.tsx";
import { mergeInto, mergeProps } from "../interactions/merge-props.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import {
  Provider,
  resumableContext,
  contextProps,
  renderProps,
  type ContextValue,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotProps,
  renderPropsOf,
} from "../slots/index.tsx";
import { mergeInputRefs, type InputRef } from "../checkbox/behaviour.tsx";
import { switchProps, type AriaSwitchProps, type SwitchAria } from "./behaviour.tsx";
import { probeSlots, slotProbing } from "#server";

export interface SwitchProps
  extends
    Omit<AriaSwitchProps, "children" | "validationBehavior" | "isRequired" | "isInvalid" | "validate" | "validationErrors">,
    HoverEvents,
    RenderProps<SwitchRenderProps>,
    DOMRenderProps<"label", SwitchRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLLabelElement>, "onClick" | "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-Switch'
   */
  class?: RenderProps<SwitchRenderProps>["class"];
  /** A ref for the HTML input element. */
  inputRef?: InputRef;
  ref?: RefValue<HTMLLabelElement>;
}

export interface SwitchFieldProps
  extends
    Omit<AriaSwitchProps, "children" | "validationBehavior" | "validationErrors">,
    RACValidation,
    RenderProps<SwitchFieldRenderProps>,
    DOMRenderProps<"div", SwitchFieldRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "onClick" | "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-SwitchField'
   */
  class?: RenderProps<SwitchFieldRenderProps>["class"];
  /** A ref for the HTML input element. */
  inputRef?: InputRef;
  ref?: RefValue<HTMLDivElement>;
}

export interface SwitchButtonProps
  extends
    HoverEvents,
    RenderProps<SwitchButtonRenderProps>,
    DOMRenderProps<"label", SwitchButtonRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLLabelElement>, "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-SwitchButton'
   */
  class?: RenderProps<SwitchButtonRenderProps>["class"];
  ref?: RefValue<HTMLLabelElement>;
}

export interface SwitchRenderProps {
  /**
   * Whether the switch is selected.
   *
   * @selector [data-selected]
   */
  isSelected: () => boolean;
  /**
   * Whether the switch is currently hovered with a mouse.
   *
   * @selector [data-hovered]
   */
  isHovered: () => boolean;
  /**
   * Whether the switch is currently in a pressed state.
   *
   * @selector [data-pressed]
   */
  isPressed: () => boolean;
  /**
   * Whether the switch is focused, either via a mouse or keyboard.
   *
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the switch is keyboard focused.
   *
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
  /**
   * Whether the switch is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the switch is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /** State of the switch. */
  state: ToggleState;
}

export interface SwitchFieldRenderProps {
  /**
   * Whether the switch is selected.
   *
   * @selector [data-selected]
   */
  isSelected: () => boolean;
  /**
   * Whether the switch is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the switch is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /**
   * Whether the switch is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the switch is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
  /** State of the switch. */
  state: ToggleState;
}

export interface SwitchButtonRenderProps extends SwitchRenderProps {
  /**
   * Whether the switch is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the switch is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
}

/** RAC `SwitchContext`. */
export const SwitchContext = resumableContext(createContext<ContextValue<SwitchProps, HTMLLabelElement>>(null, { id: "rv-switch" }));
/** RAC `SwitchFieldContext`. */
export const SwitchFieldContext = resumableContext(createContext<ContextValue<SwitchFieldProps, HTMLDivElement>>(null, { id: "rv-switch-field" }));
/** RAC `ToggleStateContext`. */
export const ToggleStateContext = resumableContext(createContext<ToggleState | null>(null, { id: "rv-toggle-state" }));

interface InternalSwitchContextValue extends SwitchAria {
  defaultClassName: string;
  isRequired?: MaybeAccessor<boolean | undefined>;
}

const InternalSwitchContext = resumableContext(createContext<InternalSwitchContextValue | null>(null, { id: "rv-switch-internal" }));

const DOM_OWNED = ["style", "onClick", "render"] as const;
/** State keys made accessors at the part boundary when live (live props P5; `isSelected` = controlled). */
const LIVE_KEYS = [
  "isDisabled",
  "isReadOnly",
  "isRequired",
  "isInvalid",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-details",
  "aria-errormessage",
  "aria-controls",
] as const;

/**
 * A switch allows a user to turn a setting on or off.
 */
export function Switch(props: SwitchProps) {
  const userInputRef = props.inputRef;
  const otherProps = liveOmit(props, ["inputRef"]);
  const [ctxMerged, ref] = contextProps(otherProps as SwitchProps, props.ref, SwitchContext);
  // Live props (P5): live state keys become accessors at the boundary (toggle state / attribute bags read them).
  const merged = liveOptions(ctxMerged, LIVE_KEYS as never, ["isSelected"]);
  const inputRef = mergeInputRefs(
    userInputRef,
    untrack(() => merged.inputRef),
  );
  const state = untrack(() => createToggleState(merged));
  const aria = untrack(() =>
    switchProps(
      liveAssign(liveWithoutData(merged), {
        // Function children count as a label.
        children: untrack(() => (typeof merged.children === "function" ? true : merged.children)),
      }),
      state,
      inputRef,
    ),
  );
  const values: ProviderValue<any>[] = [
    [ToggleStateContext, state],
    [InternalSwitchContext, { ...aria, defaultClassName: "rv-Switch" }],
  ];
  const button = liveAssign(merged, { ref }) as SwitchButtonProps;
  return (
    <Provider values={values}>
      {
        // Live props (P5): a direct call, not `<SwitchButton {...button} />` — on a resumed page a component spread of a
        // live (forwarding) props object re-created this region when the button read a forwarded key (class) in a binding.
        untrack(() => SwitchButton(button))
      }
    </Provider>
  );
}

/**
 * A switch allows a user to turn a setting on or off, with support for validation and help text.
 */
export function SwitchField(props: SwitchFieldProps) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const userInputRef = props.inputRef;
  const otherProps = liveOmit(props, ["inputRef"]);
  const [ctxMerged, ref] = contextProps(otherProps as SwitchFieldProps, props.ref, SwitchFieldContext);
  const merged = liveOptions(ctxMerged, LIVE_KEYS as never, ["isSelected"]);
  const validationBehavior = formValidationBehavior(merged.validationBehavior);
  const inputRef = mergeInputRefs(
    userInputRef,
    untrack(() => merged.inputRef),
  );
  const state = untrack(() => createToggleState(merged));
  const aria = untrack(() =>
    switchProps(
      liveAssign(liveWithoutData(merged), {
        children: untrack(() => (typeof merged.children === "function" ? true : merged.children)),
        validationBehavior,
        validationErrors: formValidationErrors(),
      }),
      state,
      inputRef,
    ),
  );
  const { descriptionProps, errorMessageProps, isSelected, isDisabled, isReadOnly, isInvalid, validationDetails, validationErrors } = aria;
  const requiredProp = untrack(() => merged.isRequired) as MaybeAccessor<boolean | undefined>;
  const isRequired = () => !!read(requiredProp);
  const fieldValues = { isSelected, isDisabled, isReadOnly, isInvalid, isRequired, state };
  const rp = renderPropsOf(merged, {
    defaultClassName: "rv-SwitchField",
    values: fieldValues,
  });
  const dom = globalDOMProps(merged, DOM_OWNED);
  const slot = merged.slot || undefined;
  // Object-literal function value (R2 makes it a resumable symbol; a plain local const arrow is not, and a
  // provider entry holding one is dropped when a resumed region is re-created).
  const fieldError = {
    validation: (): ValidationResult => ({ isInvalid: isInvalid(), validationErrors: validationErrors(), validationDetails: validationDetails() }),
  };
  const values: ProviderValue<any>[] = [
    [ToggleStateContext, state],
    [InternalSwitchContext, { ...aria, defaultClassName: "rv-SwitchButton", isRequired: requiredProp }],
    [TextContext, { slots: { description: descriptionProps, errorMessage: errorMessageProps } }],
    [FieldErrorContext, fieldError.validation],
  ];
  // Rivet (server): the input renders before the Description / FieldError: probe which slotted parts render (as
  // CheckboxField), so the input's `aria-describedby` names the description the client render links (RA useSlotId).
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
 * A switch button is the clickable area of a switch, including the indicator and label.
 */
export function SwitchButton(props: SwitchButtonProps) {
  const { labelProps, inputProps, isSelected, isDisabled, isReadOnly, isPressed, isInvalid, inputRef, defaultClassName, isRequired } =
    useContext(InternalSwitchContext)!;
  const buttonRef = props.ref;
  const { isFocused, isFocusVisible, focusProps } = useFocusRing();
  const isInteractionDisabled = () => isDisabled() || isReadOnly();
  const state = useContext(ToggleStateContext)!;
  const { onHoverStart, onHoverEnd, onHoverChange } = props;
  const { hoverProps: hover, isHovered } = hoverProps({ onHoverStart, onHoverEnd, onHoverChange, isDisabled: isInteractionDisabled }, props);
  const required = () => !!read(isRequired);
  const buttonValues = { isSelected, isPressed, isHovered, isFocused, isFocusVisible, isDisabled, isReadOnly, isInvalid, isRequired: required, state };
  const rp = renderPropsOf(props, {
    defaultClassName,
    values: buttonValues,
  });
  // `globalDOMProps` returns a fresh bag: merged into in place (static path).
  const dom = mergeInto(globalDOMProps(props, DOM_OWNED), labelProps, hover);
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
        "data-readonly": () => isReadOnly() || undefined,
        "data-invalid": () => isInvalid() || undefined,
        "data-required": () => required() || undefined,
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
      data-readonly={isReadOnly() || undefined}
      data-invalid={isInvalid() || undefined}
      data-required={required() || undefined}
    >
      <span style={visuallyHidden}>
        <input {...input} ref={inputRef as never} />
      </span>
      {rp.children()}
    </label>
  );
}
