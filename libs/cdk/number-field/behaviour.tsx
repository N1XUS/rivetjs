// Ported from react-aria `useNumberField` (packages/react-aria/src/numberfield/useNumberField.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useNumberField(props, state, inputRef)` → `numberFieldProps(props, state)`: RA's bags (`labelProps`, `groupProps`,
//   `inputProps`, `incrementButtonProps`, `decrementButtonProps`, `descriptionProps`, `errorMessageProps`) as
//   attributes; values that change are accessors (resumable: this module is `.tsx`, so they are R2 functions).
//   RA's handlers are free functions `numberField<Event>(event, props, state, aria)`; the component binds them from
//   inline arrows. `aria` = `NumberFieldAria` (the returned object: ids + the spin button's JSON state).
// - State = `createNumberFieldState` (`../number/number-field-state.tsx`, free functions); `state.validation` is the
//   field's form validation (RA `privateValidationStateProp`).
// - useFormattedTextField (C4b `../text-field/behaviour.tsx`): the `beforeinput` / composition filters are its
//   `formattedTextField*` handlers; RA's text field `onChange` = native `input` (`numberFieldInput`).
// - useScrollWheel: RA attaches a non-passive wheel listener to the input in an effect and ignores wheels unless
//   focus is within the group. Here the listener is attached when focus enters the group (`numberFieldGroupFocusIn`)
//   and removed when it leaves — same behaviour, no code before interaction.
// - `inputMode` depends on the platform (iPhone / Android): server renders `numeric` (probes are `undefined` there);
//   the focus handler sets the platform value before the software keyboard opens.
// - `flushSync(commit)` + DOM value compare (`commitAndAnnounce`) → compare `inputValue(state)` before / after.
// - useNativeValidation (layout effect, `commitBehavior: 'validate'`) runs from the handlers after each change
//   (`numberFieldNativeValidation`), not on mount: a server-rendered out-of-range value shows invalid after the first
//   interaction (aria behaviour).
// - useFormReset → `onFormReset` (form/behaviour.ts) attached by the first input handler.
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
import { createId } from "../utils/id.ts";
import { announce } from "../announcer/live-announcer.ts";
import { formatMessage } from "../_adapters/intl.ts";
import { focusBlur, focusFocus, focusWithinBlur, focusWithinFocus } from "../interactions/focus.tsx";
import { keyboardKeyDown, keyboardKeyUp } from "../interactions/keyboard.tsx";
import { getActiveElement, getEventTarget, getOwnerDocument, isAndroid, isIOS, isIPhone, read, type MaybeAccessor } from "../interactions/utils.ts";
import type { PressEvent } from "../interactions/press.tsx";
import { scrollWheel } from "../interactions/scroll-wheel.tsx";
import { describedBy, fieldProps, type FieldIds } from "../label/behaviour.ts";
import { onFormReset, syncValidity, validationInvalid } from "../form/behaviour.ts";
import { commitValidation, displayValidation, realtimeValidation, updateValidation, type ValidationResult } from "../state/form-validation.ts";
import {
  formattedTextFieldBeforeInput,
  formattedTextFieldCompositionEnd,
  formattedTextFieldCompositionStart,
  type FormattedTextFieldState,
} from "../text-field/behaviour.tsx";
import { NumberFormatter } from "../number/NumberFormatter.ts";
import {
  canDecrement,
  canIncrement,
  commit,
  decrement,
  decrementToMin,
  increment,
  incrementToMax,
  inputValue,
  maxValue,
  minValue,
  numberValue,
  setInputValue,
  setNumberValue,
  validate,
  type NumberFieldProps,
  type NumberFieldState,
} from "../number/number-field-state.tsx";
import {
  createSpinButtonState,
  spinButtonBlur,
  spinButtonDecrementPressEnd,
  spinButtonDecrementPressStart,
  spinButtonDecrementPressUp,
  spinButtonDispose,
  spinButtonFocus,
  spinButtonIncrementPressEnd,
  spinButtonIncrementPressStart,
  spinButtonIncrementPressUp,
  spinButtonKeyDown,
  spinKeysAttr,
  spinButtonKeyUp,
  type SpinButtonProps,
  type SpinButtonState,
} from "../spinbutton/behaviour.tsx";
import { strings } from "./intl.ts";

type Bag = Record<string, unknown>;

export interface AriaNumberFieldProps extends NumberFieldProps {
  /** The input id (label / description / error ids derive from it). Read once at mount. */
  id?: string;
  /** The content of the visible label (RA `label`; any truthy value = a label renders). */
  label?: unknown;
  /** RA `description` (truthy: a description renders). */
  description?: unknown;
  /** RA `errorMessage`. */
  errorMessage?: unknown;
  placeholder?: string;
  /** A value, or an accessor that stays live (live props). */
  isRequired?: MaybeAccessor<boolean | undefined>;
  /** Whether the input takes focus when it mounts. Read once at mount. */
  autoFocus?: boolean;
  /** The name of the hidden input submitted with a form. Read once at mount (form identity). */
  name?: string;
  form?: string;
  /**
   * A custom aria-label for the decrement button. If not provided, the localized string "Decrement"
   * is used. Read once at mount (it decides the button's labelling ids).
   */
  decrementAriaLabel?: string;
  /**
   * A custom aria-label for the increment button. If not provided, the localized string "Increment"
   * is used. Read once at mount (it decides the button's labelling ids).
   */
  incrementAriaLabel?: string;
  /** Enables or disables changing the value with scroll (a value, or an accessor read at scroll time). */
  isWheelDisabled?: MaybeAccessor<boolean | undefined>;
  /** Rivet: the locale (RA `useLocale()`); required (`I18nProvider` in the component). */
  locale: MaybeAccessor<string>;
  /** Read once at mount (combined with the label into the input's and the steppers' labels). */
  "aria-label"?: string;
  /** Read once at mount (combined with the label into the input's and the steppers' labels). */
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

export interface NumberFieldAria {
  /** Props for the label element. */
  labelProps: Bag;
  /** Props for the group wrapper around the input and stepper buttons. */
  groupProps: Bag;
  /** Props for the input element. */
  inputProps: Bag;
  /** Props for the increment button (Button / useButton props). */
  incrementButtonProps: Bag;
  /** Props for the decrement button (Button / useButton props). */
  decrementButtonProps: Bag;
  /** Props for the number field's description element, if any. */
  descriptionProps: Bag;
  /** Props for the number field's error message element, if any. */
  errorMessageProps: Bag;
  isInvalid: () => boolean;
  validationErrors: () => string[];
  validationDetails: () => ValidationResult["validationDetails"];
  /** Rivet: ids of the parts. */
  ids: FieldIds & { inputId: string; incrementId: string; decrementId: string };
  /** Rivet: the spin button's state (RA refs of useSpinButton; plain JSON). */
  spin: SpinButtonState;
  /** Rivet: focus-within state of the group (RA `useFocusWithin` + `focusWithin` state). */
  within: { isFocusWithin: boolean; globals: (() => void)[] };
  /** Rivet: a native `change` committed the validation since the input got focus (re-committed after blur's commit). */
  edit: { changed: boolean };
}

/** RA `textValue`: the number formatted without `currencySign: 'accounting'` (announced with a minus sign). */
export function numberFieldTextValue(props: AriaNumberFieldProps, state: NumberFieldState): string {
  const value = numberValue(state);
  return isNaN(value) ? "" : new NumberFormatter(read(props.locale), { ...read(props.formatOptions), currencySign: undefined }).format(value);
}

/** RA `inputMode`: numeric / decimal / text by platform and whether negative / fractional numbers are allowed. */
export function numberFieldInputMode(props: AriaNumberFieldProps, state: NumberFieldState): "numeric" | "decimal" | "text" {
  const intlOptions = new NumberFormatter(read(props.locale), read(props.formatOptions)).resolvedOptions();
  // The inputMode attribute influences the software keyboard that is shown on touch devices.
  // Browsers and operating systems are quite inconsistent about what keys are available, however.
  // We choose between numeric and decimal based on whether we allow negative and fractional numbers,
  // and based on testing on various devices to determine what keys are available in each inputMode.
  const hasDecimals = (intlOptions.maximumFractionDigits ?? 0) > 0;
  const min = minValue(state);
  const hasNegative = min === undefined || isNaN(min) || min < 0;
  let inputMode: "numeric" | "decimal" | "text" = "numeric";
  if (isIPhone()) {
    // iPhone doesn't have a minus sign in either numeric or decimal.
    // Note this is only for iPhone, not iPad, which always has both
    // minus and decimal in numeric.
    if (hasNegative) {
      inputMode = "text";
    } else if (hasDecimals) {
      inputMode = "decimal";
    }
  } else if (isAndroid()) {
    // Android numeric has both a decimal point and minus key.
    // decimal does not have a minus key.
    if (hasNegative) {
      inputMode = "numeric";
    } else if (hasDecimals) {
      inputMode = "decimal";
    }
  }
  return inputMode;
}

/** A live `isRequired` as a `required` / `aria-required` value (a returned arrow: resumable); `undefined` when the
 *  validation behaviour does not use that attribute. */
function requiredWhen(isRequired: () => boolean | undefined, applies: boolean): (() => true | undefined) | undefined {
  if (!applies) return undefined;
  return () => !!isRequired() || undefined;
}

/** The spin button props RA passes to useSpinButton (built at event time: browser-only closures). */
export function numberFieldSpinProps(props: AriaNumberFieldProps, state: NumberFieldState): SpinButtonProps {
  return {
    isDisabled: props.isDisabled,
    isReadOnly: props.isReadOnly,
    isRequired: props.isRequired,
    maxValue: () => maxValue(state),
    minValue: () => minValue(state),
    onIncrement: () => increment(state),
    onIncrementToMax: () => incrementToMax(state),
    onDecrement: () => decrement(state),
    onDecrementToMin: () => decrementToMin(state),
    value: () => numberValue(state),
    textValue: () => numberFieldTextValue(props, state),
    locale: props.locale,
  };
}

/**
 * Provides the behavior and accessibility implementation for a number field component. Number
 * fields allow users to enter a number, and increment or decrement the value using stepper
 * buttons (RA `useNumberField`).
 */
export function numberFieldProps(props: AriaNumberFieldProps, state: NumberFieldState): NumberFieldAria {
  const { decrementAriaLabel, incrementAriaLabel, isRequired, autoFocus, placeholder } = props;
  const isDisabled = () => !!read(props.isDisabled);
  const isReadOnly = () => !!read(props.isReadOnly);
  const inputId = props.id ?? createId();
  const field = fieldProps({ ...props, id: inputId });
  const behaviour = state.validation.behavior;
  const isInvalid = () => displayValidation(state.validation).isInvalid;
  const locale = () => read(props.locale);
  // Determine the label for the increment and decrement buttons. There are 4 cases:
  //
  // 1. With a visible label that is a string: aria-label: `Increase ${props.label}`
  // 2. With a visible label that is JSX: aria-label: 'Increase', aria-labelledby: '${incrementId} ${labelId}'
  // 3. With an aria-label: aria-label: `Increase ${props['aria-label']}`
  // 4. With an aria-labelledby: aria-label: 'Increase', aria-labelledby: `${incrementId} ${props['aria-labelledby']}`
  //
  // (1) and (2) could possibly be combined and both use aria-labelledby. However, placing the label in
  // the aria-label string rather than using aria-labelledby gives more flexibility to translators to change
  // the order or add additional words around the label if needed.
  const fieldLabel = props["aria-label"] || (typeof props.label === "string" ? props.label : "");
  let ariaLabelledby: string | undefined;
  if (!fieldLabel) {
    ariaLabelledby = props.label != null && props.label !== false ? field.labelProps.id : props["aria-labelledby"];
  }
  const incrementId = createId();
  const decrementId = createId();
  const ids = { ...field, inputId, incrementId, decrementId };
  // Rivet: the closures capture plain values only (an arrow passed as an argument is not resumable).
  const buttonProps = (id: string, ariaLabel: string | undefined, key: "increase" | "decrease"): Bag => ({
    "aria-label": () => ariaLabel || formatMessage(strings, locale(), key, { fieldLabel }).trim(),
    id: ariaLabelledby && !ariaLabel ? id : undefined,
    "aria-labelledby": ariaLabelledby && !ariaLabel ? `${id} ${ariaLabelledby}` : undefined,
    "aria-controls": inputId,
    excludeFromTabOrder: true,
    preventFocusOnPress: true,
    allowFocusWhenDisabled: true,
    isDisabled: () => !(key === "increase" ? canIncrement(state) : canDecrement(state)),
  });
  return {
    groupProps: {
      role: "group",
      "aria-disabled": () => isDisabled() || undefined,
      "aria-invalid": () => (isInvalid() ? "true" : undefined),
    },
    labelProps: { ...field.labelProps },
    inputProps: {
      id: inputId,
      type: "text", // Can't use type="number" because then we can't have things like $ in the field.
      inputMode: () => numberFieldInputMode(props, state),
      value: () => inputValue(state),
      autoComplete: "off",
      autoCorrect: "off",
      spellCheck: "false",
      // ignore aria-roledescription on iOS so that required state will announce when it is present
      "aria-roledescription": () => (!isIOS() ? formatMessage(strings, locale(), "numberField") : undefined),
      placeholder,
      autoFocus,
      disabled: () => isDisabled() || undefined,
      readOnly: () => isReadOnly() || undefined,
      required: typeof isRequired === "function" ? requiredWhen(isRequired, behaviour === "native") : (isRequired && behaviour === "native") || undefined,
      // useSpinButton's aria-disabled / aria-readonly / aria-required survive the merge (role and aria-value* are reset).
      "aria-disabled": () => isDisabled() || undefined,
      "aria-readonly": () => isReadOnly() || undefined,
      "aria-required":
        typeof isRequired === "function" ? requiredWhen(isRequired, behaviour !== "native") : behaviour === "native" ? undefined : isRequired || undefined,
      "aria-invalid": () => isInvalid() || undefined,
      "aria-errormessage": props["aria-errormessage"],
      // Rivet: the spin keys, held by the resume loader while a cold chunk loads (replayed, never lost to the caret).
      "data-rk": spinKeysAttr(props.isDisabled, props.isReadOnly),
      "aria-label": field.fieldProps["aria-label"],
      "aria-labelledby": field.fieldProps["aria-labelledby"],
      "aria-describedby": () => describedBy(field, isInvalid()),
      "aria-details": props["aria-details"],
      // RA merges these user events into inputProps unchanged (the others run through the handlers below).
      onCopy: props.onCopy,
      onCut: props.onCut,
      onSelect: props.onSelect,
      onCompositionUpdate: props.onCompositionUpdate,
    },
    incrementButtonProps: buttonProps(incrementId, incrementAriaLabel, "increase"),
    decrementButtonProps: buttonProps(decrementId, decrementAriaLabel, "decrease"),
    descriptionProps: { id: field.descriptionId },
    errorMessageProps: { id: field.errorMessageId },
    isInvalid,
    validationErrors: () => displayValidation(state.validation).validationErrors,
    validationDetails: () => displayValidation(state.validation).validationDetails,
    ids,
    spin: createSpinButtonState(),
    within: { isFocusWithin: false, globals: [] },
    edit: { changed: false },
  };
}

const formatted = (state: NumberFieldState): FormattedTextFieldState => ({
  validate: (value) => validate(state, value),
  setInputValue: (value) => setInputValue(state, value),
});

const inputOf = (aria: NumberFieldAria, from: EventTarget | null): HTMLInputElement | null =>
  getOwnerDocument(from).getElementById(aria.ids.inputId) as HTMLInputElement | null;

// One native number input to compute min / max / step validity (RA module-level `numberInput`).
const native: { input: HTMLInputElement | null } = { input: null };

/**
 * RA `useNativeValidation` (commitBehavior 'validate'): validity of min / max / step from a native number input,
 * merged with the text input's validity (browser messages, no own translations).
 */
export function numberFieldNativeValidation(props: AriaNumberFieldProps, state: NumberFieldState, input: HTMLInputElement | null): void {
  if (props.commitBehavior !== "validate" || untrack(() => realtimeValidation(state.validation)).isInvalid || !input || input.disabled) {
    return;
  }
  // Create a native number input and use it to implement validation of min/max/step.
  // This lets us get the native validation message provided by the browser instead of needing our own translations.
  if (!native.input) {
    native.input = input.ownerDocument.createElement("input");
    native.input.type = "number";
  }
  const numberInput = native.input;
  if (!numberInput) return;
  const min = untrack(() => minValue(state));
  const max = untrack(() => maxValue(state));
  const step = read(props.step);
  const value = untrack(() => numberValue(state));
  numberInput.min = min != null && !isNaN(min) ? String(min) : "";
  numberInput.max = max != null && !isNaN(max) ? String(max) : "";
  numberInput.step = step != null && !isNaN(step) ? String(step) : "";
  numberInput.value = value != null && !isNaN(value) ? String(value) : "";

  // Merge validity with the visible text input (for other validations like required).
  const valid = input.validity.valid && numberInput.validity.valid;
  const validationMessage = input.validationMessage || numberInput.validationMessage;
  updateValidation(state.validation, {
    isInvalid: !valid,
    validationErrors: validationMessage ? [validationMessage] : [],
    validationDetails: {
      badInput: input.validity.badInput,
      customError: input.validity.customError,
      patternMismatch: input.validity.patternMismatch,
      rangeOverflow: numberInput.validity.rangeOverflow,
      rangeUnderflow: numberInput.validity.rangeUnderflow,
      stepMismatch: numberInput.validity.stepMismatch,
      tooLong: input.validity.tooLong,
      tooShort: input.validity.tooShort,
      typeMismatch: input.validity.typeMismatch,
      valueMissing: input.validity.valueMissing,
      valid,
    },
  });

  // Block form submission if validation behavior is native.
  // This won't overwrite any user-defined validation message because we checked realtimeValidation above.
  if (props.validationBehavior === "native" && !numberInput.validity.valid) {
    input.setCustomValidity(numberInput.validationMessage);
  }
}

/** After a state change: native custom validity (RA render-time useFormValidation layout effect) + useNativeValidation. */
function afterChange(props: AriaNumberFieldProps, state: NumberFieldState, input: HTMLInputElement | null): void {
  if (!input) return;
  // Bindings update the DOM synchronously; the constraint validity reads the new value.
  syncValidity(state.validation, input);
  numberFieldNativeValidation(props, state, input);
}

function attachReset(props: AriaNumberFieldProps, state: NumberFieldState, input: HTMLInputElement | null): void {
  // RA useFormReset(inputRef, state.defaultNumberValue, state.setNumberValue)
  onFormReset(state, input, () => setNumberValue(state, state.defaultNumberValue));
  void props;
}

/** RA text field `onChange` (native `input`): accept the text if it is a valid partial number. */
export function numberFieldInput(event: Event, props: AriaNumberFieldProps, state: NumberFieldState, _aria?: NumberFieldAria): void {
  const input = getEventTarget(event) as HTMLInputElement;
  attachReset(props, state, input);
  const value = input.value;
  if (validate(state, value)) {
    setInputValue(state, value);
  } else {
    // React re-renders the controlled input with the previous text.
    const previous = untrack(() => inputValue(state));
    if (input.value !== previous) input.value = previous;
  }
  afterChange(props, state, input);
  props.onInput?.(event);
}

/**
 * Native `change` (RA useFormValidation change listener): commit the validation. RA defers that commit to after the
 * next render, so it sees the validity of the blur's number commit (`change` fires before `blur`): the blur handler
 * commits again when a change was committed during this edit.
 */
export function numberFieldChange(event: Event, props: AriaNumberFieldProps, state: NumberFieldState, aria?: NumberFieldAria): void {
  commitNumberValidation(props, state, event.currentTarget as HTMLInputElement);
  if (aria) aria.edit.changed = true;
}

/** `invalid` (form submit / checkValidity). */
export function numberFieldInvalid(event: Event, props: AriaNumberFieldProps, state: NumberFieldState): void {
  const shown = untrack(() => displayValidation(state.validation)).isInvalid;
  validationInvalid(state.validation, event);
  // The shared commit re-synced the text input's own validity only: merge min / max / step again (useNativeValidation).
  if (!shown) commitNumberValidation(props, state, event.target as HTMLInputElement);
}

/**
 * RA useFormValidation commit: the render after it runs useFormValidation's layout effect (custom validity + native
 * validity) and then useNativeValidation's (min / max / step), then commits — `afterChange` + `commitValidation`.
 */
function commitNumberValidation(props: AriaNumberFieldProps, state: NumberFieldState, input: HTMLInputElement | null): void {
  afterChange(props, state, input);
  commitValidation(state.validation);
}

/** RA `commitAndAnnounce`: commit the input, announce the normalized text when it changed. */
export function numberFieldCommitAndAnnounce(props: AriaNumberFieldProps, state: NumberFieldState, input: HTMLInputElement | null): void {
  const oldValue = input?.value ?? "";
  // Set input value to normalized valid value
  commit(state);
  const newValue = untrack(() => inputValue(state));
  if (input && input.value !== newValue) input.value = newValue;
  if (newValue !== oldValue) {
    announce(newValue, "assertive");
  }
  afterChange(props, state, input);
}

/** focus of the input: spin button focus, native custom validity, the platform input mode, user focus events. */
export function numberFieldFocus(event: FocusEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  const input = event.currentTarget as HTMLInputElement;
  spinButtonFocus(event, numberFieldSpinProps(props, state), aria.spin);
  const inputMode = untrack(() => numberFieldInputMode(props, state));
  if (input.inputMode !== inputMode) input.inputMode = inputMode;
  attachReset(props, state, input);
  syncValidity(state.validation, input);
  if (props.onFocus || props.onFocusChange) focusFocus(props, event);
}

/** blur of the input (RA chain: spin button onBlur, useFocus onBlur → commitAndAnnounce, text field onBlur). */
export function numberFieldBlur(event: FocusEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonBlur(event, numberFieldSpinProps(props, state), aria.spin);
  if (getEventTarget(event) === event.currentTarget) {
    const input = event.currentTarget as HTMLInputElement;
    numberFieldCommitAndAnnounce(props, state, input);
    if (aria.edit.changed) commitNumberValidation(props, state, input);
  }
  aria.edit.changed = false;
  if (props.onBlur || props.onFocusChange) focusBlur(props, event);
}

/** keydown of the input: spin button shortcuts, then Enter commits (RA `useKeyboard` + user `onKeyDown`). */
export function numberFieldKeyDown(event: KeyboardEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  const input = event.currentTarget as HTMLInputElement;
  spinButtonKeyDown(event, numberFieldSpinProps(props, state), aria.spin);
  keyboardKeyDown(
    {
      isDisabled: read(props.isDisabled) || read(props.isReadOnly),
      shortcuts: {
        Enter: () => {
          commit(state);
          const value = untrack(() => inputValue(state));
          if (input.value !== value) input.value = value;
          // useFormValidationState commitValidation
          commitNumberValidation(props, state, input);
          return { shouldPreventDefault: false };
        },
      },
      onKeyDown: props.onKeyDown,
    },
    event,
  );
}

/** keyup of the input. */
export function numberFieldKeyUp(event: KeyboardEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonKeyUp(event, numberFieldSpinProps(props, state), aria.spin);
  keyboardKeyUp({ isDisabled: read(props.isDisabled) || read(props.isReadOnly), shortcuts: {}, onKeyUp: props.onKeyUp }, event);
}

/** RA `onPaste`: a paste replacing the whole text commits it at once (the user sees the formatted result). */
export function numberFieldPaste(event: ClipboardEvent, props: AriaNumberFieldProps, state: NumberFieldState): void {
  props.onPaste?.(event);
  const inputElement = getEventTarget(event) as HTMLInputElement;
  // we can only handle the case where the paste takes over the entire input, otherwise things get very complicated
  // trying to calculate the new string based on what the paste is replacing and where in the source string it is
  if (inputElement && (inputElement.selectionEnd ?? -1) - (inputElement.selectionStart ?? 0) === inputElement.value.length) {
    event.preventDefault();
    // commit so that the user gets to see what it formats to immediately
    // paste happens before inputRef's value is updated, so have to prevent the default and do it ourselves
    // spin button will then handle announcing the new value, this should work with controlled state as well
    // because the announcement is done as a result of the new rendered input value if there is one
    commit(state, event.clipboardData?.getData?.("text/plain")?.trim() ?? "");
    const value = untrack(() => inputValue(state));
    if (inputElement.value !== value) inputElement.value = value;
    afterChange(props, state, inputElement);
  }
}

/** beforeinput (useFormattedTextField): cancel input that would make an invalid partial number. */
export function numberFieldBeforeInput(event: InputEvent, props: AriaNumberFieldProps, state: NumberFieldState): void {
  formattedTextFieldBeforeInput(event, formatted(state));
  props.onBeforeInput?.(event);
}

export function numberFieldCompositionStart(event: CompositionEvent, props: AriaNumberFieldProps, _state: NumberFieldState): void {
  formattedTextFieldCompositionStart(event);
  props.onCompositionStart?.(event);
}

export function numberFieldCompositionEnd(event: CompositionEvent, props: AriaNumberFieldProps, state: NumberFieldState): void {
  formattedTextFieldCompositionEnd(event, formatted(state));
  props.onCompositionEnd?.(event);
}

/** RA `onWheel`: vertical wheel increments / decrements (trackpad: mostly-horizontal motion is ignored). */
export function numberFieldScroll(e: { deltaX: number; deltaY: number }, state: NumberFieldState): void {
  // if on a trackpad, users can scroll in both X and Y at once, check the magnitude of the change
  // if it's mostly in the X direction, then just return, the user probably doesn't mean to inc/dec
  // this isn't perfect, events come in fast with small deltas and a part of the scroll may give a false indication
  // especially if the user is scrolling near 45deg
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
    return;
  }
  if (e.deltaY > 0) {
    increment(state);
  } else if (e.deltaY < 0) {
    decrement(state);
  }
}

/** focusin of the group (RA useFocusWithin): focus within → the input's non-passive wheel listener (useScrollWheel). */
export function numberFieldGroupFocusIn(event: FocusEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  focusWithinFocus(
    {
      props: {
        isDisabled: props.isDisabled,
        onFocusWithinChange: (isFocusWithin) => {
          if (!isFocusWithin) return;
          const input = inputOf(aria, event.currentTarget);
          if (!input) return;
          const listener = (e: WheelEvent) => {
            // If the input isn't supposed to receive input, disable scrolling.
            const disabled = read(props.isWheelDisabled) || read(props.isDisabled) || read(props.isReadOnly) || !aria.within.isFocusWithin;
            scrollWheel({ isDisabled: disabled, onScroll: (s) => numberFieldScroll(s, state) }, e);
          };
          input.addEventListener("wheel", listener, { passive: false });
          aria.within.globals.push(() => input.removeEventListener("wheel", listener));
        },
      },
      state: aria.within,
    },
    event,
  );
}

/** focusout of the group. */
export function numberFieldGroupFocusOut(event: FocusEvent, props: AriaNumberFieldProps, _state: NumberFieldState, aria: NumberFieldAria): void {
  focusWithinBlur({ props: { isDisabled: props.isDisabled }, state: aria.within }, event);
}

/**
 * RA `onButtonPressStart` (both stepper buttons): keep focus on the input if it has it (software keyboard stays);
 * a mouse moves focus to the input; touch / screen reader focus the button.
 */
export function numberFieldButtonPressStart(e: PressEvent, _props: AriaNumberFieldProps, _state: NumberFieldState, aria: NumberFieldAria): void {
  const input = inputOf(aria, e.target);
  // If focus is already on the input, keep it there so we don't hide the
  // software keyboard when tapping the increment/decrement buttons.
  if (getActiveElement(getOwnerDocument(e.target)) === input) {
    return;
  }

  // Otherwise, when using a mouse, move focus to the input.
  // On touch, or with a screen reader, focus the button so that the software
  // keyboard does not appear and the screen reader cursor is not moved off the button.
  if (e.pointerType === "mouse") {
    input?.focus();
  } else {
    (e.target as HTMLElement).focus();
  }
}

// Stepper buttons (RA mergeProps(incButtonProps, { onPressStart: onButtonPressStart, onFocus, onBlur })).
export function numberFieldIncrementPressStart(e: PressEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonIncrementPressStart(e, numberFieldSpinProps(props, state), aria.spin);
  numberFieldButtonPressStart(e, props, state, aria);
}
export function numberFieldIncrementPressUp(e: PressEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonIncrementPressUp(e, numberFieldSpinProps(props, state), aria.spin);
}
export function numberFieldIncrementPressEnd(e: PressEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonIncrementPressEnd(e, numberFieldSpinProps(props, state), aria.spin);
}
export function numberFieldDecrementPressStart(e: PressEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonDecrementPressStart(e, numberFieldSpinProps(props, state), aria.spin);
  numberFieldButtonPressStart(e, props, state, aria);
}
export function numberFieldDecrementPressUp(e: PressEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonDecrementPressUp(e, numberFieldSpinProps(props, state), aria.spin);
}
export function numberFieldDecrementPressEnd(e: PressEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonDecrementPressEnd(e, numberFieldSpinProps(props, state), aria.spin);
}
/** focus / blur of a stepper button (useSpinButton's onFocus / onBlur). */
export function numberFieldButtonFocus(e: FocusEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonFocus(e, numberFieldSpinProps(props, state), aria.spin);
}
export function numberFieldButtonBlur(e: FocusEvent, props: AriaNumberFieldProps, state: NumberFieldState, aria: NumberFieldAria): void {
  spinButtonBlur(e, numberFieldSpinProps(props, state), aria.spin);
}

/** RA unmount cleanup (spin timers, global listeners, wheel listener). */
export function numberFieldDispose(aria: NumberFieldAria): void {
  spinButtonDispose(aria.spin);
  for (const remove of aria.within.globals.splice(0)) remove();
}
