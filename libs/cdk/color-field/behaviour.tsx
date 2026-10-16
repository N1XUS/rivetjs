// Ported from react-aria `useColorField`, `useColorChannelField` (packages/react-aria/src/color/useColorField.ts,
// useColorChannelField.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useColorField(props, state, ref)` → `colorFieldProps(props, state)`: RA's bags (`labelProps`, `inputProps`,
//   `descriptionProps`, `errorMessageProps`) + validation accessors; values that change are accessors (this module
//   is `.tsx`: resume-compiled). RA's merged handlers (useKeyboard Enter commit, useFormattedTextField, useSpinButton,
//   useFocusWithin + useScrollWheel, `onBlur: commit`) are free functions `colorField<Event>(event, props, state, aria)`;
//   `aria` = the returned `ColorFieldAria` (ids + the spin button's JSON state).
// - State = `createColorFieldState` (`@rivetjs/cdk/color`, free functions over plain signals).
// - `flushSync(commit)` → `commit(state)` then the DOM input value is written at once (bindings are synchronous).
// - useScrollWheel: the non-passive wheel listener is attached to the input on focus and removed on blur (RA attaches
//   it in an effect and ignores wheels unless focus is within) — same behaviour, no code before interaction.
// - useFormReset → `onFormReset` (form/behaviour.ts), attached by the first input / focus handler.
// - `useColorChannelField(props, state, ref)` → `colorChannelFieldProps(props, state)`: `numberFieldProps` over
//   `numberFieldView(state)` (`@rivetjs/cdk/color`; upstream spreads useNumberFieldState into the channel state);
//   handlers = the `numberField<Event>` functions with `numberFieldView(state)` built inside the handler.
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { untrack } from "@rivetjs/reactivity";
import {
  colorValue,
  commit,
  decrementToMin,
  defaultColorValue,
  incrementToMax,
  inputValue,
  numberFieldView,
  setColorValue,
  setInputValue,
  validate,
  increment,
  decrement,
  type ColorChannelFieldState,
  type ColorFieldProps,
  type ColorFieldState,
} from "@rivetjs/cdk/color";
import { channelFieldColorValue } from "../color/channel-field-state.tsx";
import { createId } from "../utils/id.ts";
import { focusBlur, focusFocus } from "../interactions/focus.tsx";
import { keyboardKeyDown, keyboardKeyUp } from "../interactions/keyboard.tsx";
import { getEventTarget, read, type MaybeAccessor } from "../interactions/utils.ts";
import { scrollWheel } from "../interactions/scroll-wheel.tsx";
import { describedBy, fieldProps, type FieldIds } from "../label/behaviour.ts";
import { onFormReset, syncValidity, validationChange, validationInvalid } from "../form/behaviour.ts";
import { commitValidation, displayValidation, type ValidationResult } from "../state/form-validation.ts";
import {
  formattedTextFieldBeforeInput,
  formattedTextFieldCompositionEnd,
  formattedTextFieldCompositionStart,
  type FormattedTextFieldState,
} from "../text-field/behaviour.tsx";
import {
  createSpinButtonState,
  spinButtonBlur,
  spinButtonDispose,
  spinButtonFocus,
  spinButtonKeyDown,
  spinButtonKeyUp,
  type SpinButtonProps,
  type SpinButtonState,
} from "../spinbutton/behaviour.tsx";
import { numberFieldProps, type AriaNumberFieldProps, type NumberFieldAria } from "../number-field/behaviour.tsx";

type Bag = Record<string, unknown>;

export interface AriaColorFieldProps extends ColorFieldProps {
  id?: string;
  /** The content of the visible label (RA `label`; any truthy value = a label renders). */
  label?: unknown;
  /** RA `description` (truthy: a description renders). */
  description?: unknown;
  /** RA `errorMessage`. */
  errorMessage?: unknown;
  placeholder?: string;
  autoFocus?: boolean;
  name?: string;
  form?: string;
  /** Enables or disables changing the value with scroll. */
  isWheelDisabled?: boolean;
  /** Whether the input should be excluded from the tab order. */
  excludeFromTabOrder?: boolean;
  /** Rivet: the locale of the spin button's "Empty" announcement (RA `useLocale()`). */
  locale?: MaybeAccessor<string | undefined>;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  "aria-errormessage"?: string;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  onCopy?: (e: ClipboardEvent) => void;
  onCut?: (e: ClipboardEvent) => void;
  onPaste?: (e: ClipboardEvent) => void;
  onCompositionStart?: (e: CompositionEvent) => void;
  onCompositionEnd?: (e: CompositionEvent) => void;
  onCompositionUpdate?: (e: CompositionEvent) => void;
  onSelect?: (e: Event) => void;
  onBeforeInput?: (e: InputEvent) => void;
  onInput?: (e: Event) => void;
}

export interface ColorFieldAria {
  /** Props for the label element. */
  labelProps: Bag;
  /** Props for the input element. */
  inputProps: Bag;
  /** Props for the text field's description element, if any. */
  descriptionProps: Bag;
  /** Props for the text field's error message element, if any. */
  errorMessageProps: Bag;
  isInvalid: () => boolean;
  validationErrors: () => string[];
  validationDetails: () => ValidationResult["validationDetails"];
  /** Rivet: ids of the parts. */
  ids: FieldIds & { inputId: string };
  /** Rivet: the spin button's state (RA refs of useSpinButton; plain JSON). */
  spin: SpinButtonState;
  /** Rivet: focus-within state (RA `useFocusWithin`) + the attached wheel listener (browser only). */
  within: { isFocusWithin: boolean };
}

/** The spin button props RA passes to useSpinButton (built at event / binding time). */
export function colorFieldSpinProps(props: AriaColorFieldProps, state: ColorFieldState): SpinButtonProps {
  return {
    isDisabled: props.isDisabled,
    isReadOnly: props.isReadOnly,
    isRequired: props.isRequired,
    maxValue: 0xffffff,
    minValue: 0,
    onIncrement: () => increment(state),
    onIncrementToMax: () => incrementToMax(state),
    onDecrement: () => decrement(state),
    onDecrementToMin: () => decrementToMin(state),
    value: () => colorValue(state)?.toHexInt(),
    textValue: () => {
      const color = colorValue(state);
      return color ? color.toString("hex") : undefined;
    },
    locale: props.locale,
  };
}

/**
 * Provides the behavior and accessibility implementation for a color field component.
 * Color fields allow users to enter and adjust a hex color value.
 */
export function colorFieldProps(props: AriaColorFieldProps, state: ColorFieldState): ColorFieldAria {
  const { placeholder, autoFocus } = props;
  // Live props (P5): `isDisabled` / `isReadOnly` / `isRequired` may be accessors (the attributes then are bindings).
  const isDisabled = (props.isDisabled ?? false) as MaybeAccessor<boolean | undefined>;
  const isReadOnly = (props.isReadOnly ?? false) as MaybeAccessor<boolean | undefined>;
  const isRequired = (props.isRequired ?? false) as MaybeAccessor<boolean | undefined>;
  const behaviour = state.validation.behavior;
  const inputId = createId();
  const field = fieldProps({ ...props, id: inputId });
  const isInvalid = () => displayValidation(state.validation).isInvalid;
  return {
    labelProps: { ...field.labelProps },
    inputProps: {
      id: inputId,
      type: "text",
      autoComplete: "off",
      autoCorrect: "off",
      spellCheck: "false",
      // useSpinButton's role is overridden; its aria-value* are removed.
      role: "textbox",
      "aria-valuemax": null,
      "aria-valuemin": null,
      "aria-valuenow": null,
      "aria-valuetext": null,
      value: () => inputValue(state),
      placeholder,
      autoFocus,
      name: props.name,
      form: props.form,
      tabIndex: props.excludeFromTabOrder ? -1 : undefined,
      disabled: typeof isDisabled === "function" ? liveFlag(isDisabled) : isDisabled,
      readOnly: typeof isReadOnly === "function" ? liveFlag(isReadOnly) : isReadOnly,
      required: behaviour === "native" ? flagAttr(isRequired) : undefined,
      "aria-disabled": flagAttr(isDisabled),
      "aria-readonly": flagAttr(isReadOnly),
      "aria-required": behaviour === "native" ? undefined : flagAttr(isRequired),
      "aria-invalid": () => isInvalid() || undefined,
      "aria-errormessage": props["aria-errormessage"],
      "aria-label": field.fieldProps["aria-label"],
      "aria-labelledby": field.fieldProps["aria-labelledby"],
      "aria-describedby": () => describedBy(field, isInvalid()),
      "aria-details": props["aria-details"],
    },
    descriptionProps: { id: field.descriptionId },
    errorMessageProps: { id: field.errorMessageId },
    isInvalid,
    validationErrors: () => displayValidation(state.validation).validationErrors,
    validationDetails: () => displayValidation(state.validation).validationDetails,
    ids: { ...field, inputId },
    spin: createSpinButtonState(),
    within: { isFocusWithin: false },
  };
}

/** `true` while a live flag is set (a returned arrow: resumable symbol). */
function liveFlag(flag: () => boolean | undefined): () => true | undefined {
  return () => !!flag() || undefined;
}
/** A flag attribute: `true` / `undefined`, or an accessor of it while the flag is live. */
const flagAttr = (flag: MaybeAccessor<boolean | undefined>): (() => true | undefined) | true | undefined =>
  typeof flag === "function" ? liveFlag(flag) : flag || undefined;

const formatted = (state: ColorFieldState): FormattedTextFieldState => ({
  validate,
  setInputValue: (value) => setInputValue(state, value),
});

// Browser-only wheel listeners per spin state (never serialized).
const wheels = new WeakMap<SpinButtonState, () => void>();

/** Writes the state's input text to the element when it differs (React re-renders the controlled input). */
function syncInput(state: ColorFieldState, input: HTMLInputElement | null): void {
  const text = untrack(() => inputValue(state));
  if (input && input.value !== text) input.value = text;
}

function attachReset(state: ColorFieldState, input: HTMLInputElement | null): void {
  // RA useFormReset(ref, state.defaultColorValue, state.setColorValue)
  onFormReset(state, input, () => setColorValue(state, defaultColorValue(state) ?? null));
}

/** RA text field `onChange` (native `input`): accept the text when it is a valid partial hex value. */
export function colorFieldInput(event: Event, props: AriaColorFieldProps, state: ColorFieldState, _aria?: ColorFieldAria): void {
  const input = getEventTarget(event) as HTMLInputElement;
  attachReset(state, input);
  if (validate(input.value)) {
    setInputValue(state, input.value);
  } else {
    syncInput(state, input);
  }
  syncValidity(state.validation, input);
  props.onInput?.(event);
}

/** Native `change` (RA useFormValidation change listener): commit the validation. */
export function colorFieldChange(event: Event, _props: AriaColorFieldProps, state: ColorFieldState): void {
  validationChange(state.validation, event.currentTarget as HTMLInputElement);
}

/** `invalid` (form submit / checkValidity). */
export function colorFieldInvalid(event: Event, _props: AriaColorFieldProps, state: ColorFieldState): void {
  validationInvalid(state.validation, event);
}

/** beforeinput (useFormattedTextField): cancel input that would make an invalid partial hex value. */
export function colorFieldBeforeInput(event: InputEvent, props: AriaColorFieldProps, state: ColorFieldState): void {
  formattedTextFieldBeforeInput(event, formatted(state));
  props.onBeforeInput?.(event);
}

export function colorFieldCompositionStart(event: CompositionEvent, props: AriaColorFieldProps, _state: ColorFieldState): void {
  formattedTextFieldCompositionStart(event);
  props.onCompositionStart?.(event);
}

export function colorFieldCompositionEnd(event: CompositionEvent, props: AriaColorFieldProps, state: ColorFieldState): void {
  formattedTextFieldCompositionEnd(event, formatted(state));
  props.onCompositionEnd?.(event);
}

/** RA `onWheel`: vertical wheel increments / decrements (mostly-horizontal trackpad motion is ignored). */
export function colorFieldScroll(e: { deltaX: number; deltaY: number }, state: ColorFieldState): void {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
    return;
  }
  if (e.deltaY > 0) {
    increment(state);
  } else if (e.deltaY < 0) {
    decrement(state);
  }
}

/** keydown: useKeyboard (Enter commits, user `onKeyDown`), then the spin button shortcuts (RA mergeProps order). */
export function colorFieldKeyDown(event: KeyboardEvent, props: AriaColorFieldProps, state: ColorFieldState, aria: ColorFieldAria): void {
  const input = event.currentTarget as HTMLInputElement;
  keyboardKeyDown(
    {
      isDisabled: read(props.isDisabled) || read(props.isReadOnly),
      shortcuts: {
        Enter: () => {
          commit(state);
          syncInput(state, input);
          commitValidation(state.validation);
          return { shouldPreventDefault: false };
        },
      },
      onKeyDown: props.onKeyDown,
    },
    event,
  );
  spinButtonKeyDown(event, colorFieldSpinProps(props, state), aria.spin);
}

/** keyup. */
export function colorFieldKeyUp(event: KeyboardEvent, props: AriaColorFieldProps, state: ColorFieldState, aria: ColorFieldAria): void {
  keyboardKeyUp({ isDisabled: read(props.isDisabled) || read(props.isReadOnly), shortcuts: {}, onKeyUp: props.onKeyUp }, event);
  spinButtonKeyUp(event, colorFieldSpinProps(props, state), aria.spin);
}

/** focus: spin button announcements, focus within (wheel listener), native custom validity, user focus events. */
export function colorFieldFocus(event: FocusEvent, props: AriaColorFieldProps, state: ColorFieldState, aria: ColorFieldAria): void {
  const input = event.currentTarget as HTMLInputElement;
  spinButtonFocus(event, colorFieldSpinProps(props, state), aria.spin);
  attachReset(state, input);
  syncValidity(state.validation, input);
  if (!read(props.isDisabled) && !aria.within.isFocusWithin) {
    aria.within.isFocusWithin = true;
    const listener = (e: WheelEvent) => {
      // If the input isn't supposed to receive input, disable scrolling.
      const disabled = props.isWheelDisabled || read(props.isDisabled) || read(props.isReadOnly) || !aria.within.isFocusWithin;
      scrollWheel({ isDisabled: disabled, onScroll: (s) => colorFieldScroll(s, state) }, e);
    };
    input.addEventListener("wheel", listener, { passive: false });
    wheels.set(aria.spin, () => input.removeEventListener("wheel", listener));
  }
  if (props.onFocus || props.onFocusChange) focusFocus(props, event);
}

/** blur: spin button, focus within, `onBlur: commit`, user focus events. */
export function colorFieldBlur(event: FocusEvent, props: AriaColorFieldProps, state: ColorFieldState, aria: ColorFieldAria): void {
  const input = event.currentTarget as HTMLInputElement;
  spinButtonBlur(event, colorFieldSpinProps(props, state), aria.spin);
  aria.within.isFocusWithin = false;
  wheels.get(aria.spin)?.();
  wheels.delete(aria.spin);
  commit(state);
  syncInput(state, input);
  syncValidity(state.validation, input);
  if (props.onBlur || props.onFocusChange) focusBlur(props, event);
}

/** RA unmount cleanup (spin timers, wheel listener). */
export function colorFieldDispose(aria: ColorFieldAria): void {
  spinButtonDispose(aria.spin);
  wheels.get(aria.spin)?.();
  wheels.delete(aria.spin);
}

// ---- useColorChannelField ----

export interface AriaColorChannelFieldProps extends Omit<AriaNumberFieldProps, "value" | "defaultValue" | "onChange" | "validate"> {}
export interface ColorChannelFieldAria extends NumberFieldAria {}

/** The number field props RA passes for a channel field (value / onChange come from the channel state). */
export function colorChannelFieldNumberProps(props: AriaColorChannelFieldProps, state: ColorChannelFieldState): AriaNumberFieldProps {
  return {
    ...props,
    // Provide a default aria-label if no other label is provided.
    "aria-label":
      props["aria-label"] ||
      (props.label || props["aria-labelledby"] ? undefined : untrack(() => channelFieldColorValue(state)).getChannelName(state.channel, read(props.locale))),
  } as AriaNumberFieldProps;
}

/**
 * Provides the behavior and accessibility implementation for a color channel field, allowing users
 * to edit the value of an individual color channel.
 */
export function colorChannelFieldProps(props: AriaColorChannelFieldProps, state: ColorChannelFieldState): ColorChannelFieldAria {
  return numberFieldProps(colorChannelFieldNumberProps(props, state), numberFieldView(state));
}
