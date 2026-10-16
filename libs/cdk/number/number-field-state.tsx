// Ported from react-stately `useNumberFieldState` (packages/react-stately/src/numberfield/useNumberFieldState.ts), Apache-2.0, © Adobe.
// Rivet:
// - Serializable state (cdk `state/*` convention): `createNumberFieldState(options)` returns plain signals + JSON
//   (region state, resumable); the upstream state members are free functions taking the state (`inputValue(state)`,
//   `numberValue(state)`, `commit(state)`, `increment(state)`, `canIncrement(state)`, …).
// - Controlled `value`: a two-way `Signal<number | null>`, a plain number (plain = fixed: changes only fire
//   `onChange`, like an upstream controlled prop the parent does not update) or an accessor `() => number | null`
//   (a live prop: read on every use, never written — upstream's controlled prop that the parent re-renders);
//   `null` = NaN, as upstream.
// - Props that change between React renders (`locale`, `formatOptions`, `minValue`, `maxValue`, `step`,
//   `isDisabled`, `isReadOnly`) accept a value or an accessor (`MaybeAccessor`; resumed pages: inline arrows).
// - Upstream's "set state during render" sync (reformat the input when the number value, locale or format options
//   change) is pure on read (an out-of-sync input reads as the formatted number value) and written by every
//   mutation first (`syncInputValue`); the previous value/locale/formatOptions live in a JSON signal.
// - Validation = `createFormValidationState` (`state.validation`; use the `state/form-validation` free functions).
//   Its value is upstream's `numberValue`: the uncontrolled signal, or for a controlled value + `validate` an accessor
//   (null -> NaN, snapped) — a closure, so this module is `.tsx` (resume-compiled; `validationValue` is an R2 symbol).
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

import { _regionState, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { clamp, snapValueToStep } from "@rivetjs/cdk/utils";
import {
  commitValidation,
  createFormValidationState,
  read,
  type FormValidationOptions,
  type FormValidationState,
  type MaybeAccessor,
} from "@rivetjs/cdk/state/form-validation";
import { NumberFormatter } from "./NumberFormatter.ts";
import { NumberParser } from "./NumberParser.ts";

export interface NumberFieldProps extends FormValidationOptions<number> {
  /**
   * The current value (controlled): a two-way signal, a plain number, or an accessor (read live, never written; a
   * live prop `value={n()}` arrives as one). `null` is treated as NaN (empty).
   */
  value?: Signal<number | null> | (() => number | null) | number | null;
  /** The default value (uncontrolled). Read once at mount. */
  defaultValue?: number;
  /** Handler that is called when the value changes (resumed pages: an inline arrow or a local function). */
  onChange?: (value: number) => void;
  /** The smallest value allowed for the input. */
  minValue?: MaybeAccessor<number | undefined>;
  /** The largest value allowed for the input. */
  maxValue?: MaybeAccessor<number | undefined>;
  /** The amount that the input value changes with each increment or decrement "tick". */
  step?: MaybeAccessor<number | undefined>;
  /** Whether the input is disabled. */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** Whether the input can be selected but not changed by the user. */
  isReadOnly?: MaybeAccessor<boolean | undefined>;
  /**
   * Formatting options for the value displayed in the number field.
   * This also affects what characters are allowed to be typed by the user.
   */
  formatOptions?: MaybeAccessor<Intl.NumberFormatOptions | undefined>;
  /**
   * Controls the behavior of the number field when the user blurs the field after editing. 'snap'
   * will clamp the value to the min/max values, and snap to the nearest step value. 'validate' will
   * not clamp the value, and will validate that the value is within the min/max range and on a
   * valid step.
   *
   * @default 'snap'
   */
  commitBehavior?: "snap" | "validate";
}

export interface NumberFieldStateOptions extends NumberFieldProps {
  /**
   * The locale that should be used for parsing.
   *
   * @default 'en-US'
   */
  locale: MaybeAccessor<string>;
}

/** Previous number value / locale / format options the input text was formatted for (upstream prev* state). */
export interface NumberFieldSync {
  value: number;
  locale: string;
  formatOptions: Intl.NumberFormatOptions | undefined;
}

export interface NumberFieldState {
  readonly locale: MaybeAccessor<string>;
  readonly formatOptions: MaybeAccessor<Intl.NumberFormatOptions | undefined> | undefined;
  readonly minValue: MaybeAccessor<number | undefined> | undefined;
  readonly maxValue: MaybeAccessor<number | undefined> | undefined;
  readonly step: MaybeAccessor<number | undefined> | undefined;
  readonly isDisabled: MaybeAccessor<boolean | undefined> | undefined;
  readonly isReadOnly: MaybeAccessor<boolean | undefined> | undefined;
  readonly commitBehavior: "snap" | "validate";
  /** Whether `value` is controlled (upstream `value !== undefined`). */
  readonly controlled: boolean;
  /** A plain or accessor controlled value: `value` is never written (changes only fire `onChange`). */
  readonly fixed: boolean;
  /** The committed value (controlled signal / accessor, or the internal one); null = NaN. Never `.set` a fixed one. */
  readonly value: Signal<number | null>;
  /** The input text as last written (read it through `inputValue(state)`). */
  readonly input: Signal<string>;
  /** What `input` was last formatted for. */
  readonly prev: Signal<NumberFieldSync>;
  /** The default value of the input. */
  readonly defaultNumberValue: number;
  readonly onChange: ((value: number) => void) | undefined;
  readonly validation: FormValidationState;
}

const isSignal = (value: unknown): value is Signal<number | null> => typeof value === "function" && typeof (value as Signal<unknown>).set === "function";

function snapValue(state: NumberFieldState, value: number): number {
  const step = read(state.step);
  const minValue = read(state.minValue);
  const maxValue = read(state.maxValue);
  return step === undefined || isNaN(step) ? clamp(value, minValue, maxValue) : snapValueToStep(value, minValue, maxValue, step);
}

/**
 * Provides state management for a number field component. Number fields allow users to enter a
 * number, and increment or decrement the value using stepper buttons.
 */
export function createNumberFieldState(props: NumberFieldStateOptions): NumberFieldState {
  return _regionState(() =>
    untrack(() => {
      const commitBehavior = props.commitBehavior ?? "snap";
      const controlled = props.value !== undefined;
      const fixed = controlled && !isSignal(props.value);
      const partial = {
        locale: props.locale,
        formatOptions: props.formatOptions,
        minValue: props.minValue,
        maxValue: props.maxValue,
        step: props.step,
        isDisabled: props.isDisabled,
        isReadOnly: props.isReadOnly,
        commitBehavior,
      } as NumberFieldState;

      let defaultValue = props.defaultValue ?? NaN;
      if (!isNaN(defaultValue) && commitBehavior === "snap") {
        defaultValue = snapValue(partial, defaultValue);
      }

      // useControlledState(value, defaultValue, onChange); an accessor (live prop) is kept as is: read, never written.
      const value: Signal<number | null> =
        isSignal(props.value) || typeof props.value === "function"
          ? (props.value as Signal<number | null>)
          : signal<number | null>(controlled ? (props.value as number | null) : isNaN(defaultValue) ? NaN : defaultValue);
      const state: NumberFieldState = {
        ...partial,
        controlled,
        fixed,
        value,
        input: signal(""),
        prev: signal<NumberFieldSync>({ value: NaN, locale: "", formatOptions: undefined }),
        defaultNumberValue: NaN,
        onChange: props.onChange,
        validation: null as unknown as FormValidationState,
      };
      // Upstream validates `numberValue` (null -> NaN, a controlled value snapped). The uncontrolled signal already
      // holds exactly that; a controlled one needs the derived accessor (a resumable closure: this module is .tsx).
      (state as { validation: FormValidationState }).validation = createFormValidationState<number>({
        ...props,
        value: controlled && props.validate ? validationValue(state) : (value as () => number),
      });
      const initialValue = committedValue(state);
      const locale = read(state.locale);
      const formatOptions = read(state.formatOptions);
      state.input.set(isNaN(initialValue) ? "" : new NumberFormatter(locale, formatOptions).format(initialValue));
      state.prev.set({ value: initialValue, locale, formatOptions });
      (state as { defaultNumberValue: number }).defaultNumberValue = isNaN(defaultValue) ? initialValue : defaultValue;
      return state;
    }),
  );
}

/** The value custom `validate` receives (upstream `numberValue`): a resumable accessor (R2 return value). */
function validationValue(state: NumberFieldState): () => number {
  return () => committedValue(state);
}

// Accessors ------------------------------------------------------------------------------------

/** The committed number value (upstream `numberValue` before it is shadowed by the parsed input). */
export function committedValue(state: NumberFieldState): number {
  let value = state.value();
  if (value === null) value = NaN;
  if (state.controlled && !isNaN(value) && state.commitBehavior === "snap") value = snapValue(state, value);
  return value;
}

const numberParser = (state: NumberFieldState) => new NumberParser(read(state.locale), read(state.formatOptions));

function formatter(state: NumberFieldState): NumberFormatter {
  const numberingSystem = numberParser(state).getNumberingSystem(state.input());
  return new NumberFormatter(read(state.locale), { ...read(state.formatOptions), numberingSystem } as Intl.NumberFormatOptions);
}

const format = (state: NumberFieldState, value: number) => (isNaN(value) || value === null ? "" : formatter(state).format(value));

function outOfSync(state: NumberFieldState, numberValue: number, locale: string, formatOptions: Intl.NumberFormatOptions | undefined): boolean {
  const p = untrack(state.prev);
  return !Object.is(numberValue, p.value) || locale !== p.locale || !isEqualFormatOptions(formatOptions, p.formatOptions);
}

/** Upstream render-time sync: reformat the input when the number value, locale or format options changed. */
function syncInputValue(state: NumberFieldState): void {
  const numberValue = committedValue(state);
  const locale = read(state.locale);
  const formatOptions = read(state.formatOptions);
  if (outOfSync(state, numberValue, locale, formatOptions)) {
    state.input.set(format(state, numberValue));
    state.prev.set({ value: numberValue, locale, formatOptions });
  }
}

/**
 * The current text value of the input. Updated as the user types,
 * and formatted according to `formatOptions` on blur.
 */
export function inputValue(state: NumberFieldState): string {
  const numberValue = committedValue(state);
  return outOfSync(state, numberValue, read(state.locale), read(state.formatOptions)) ? format(state, numberValue) : state.input();
}

/**
 * Rivet (no upstream member): the committed value formatted for display — the input text once it is in sync; while the
 * user types, the last committed value (`@rivetjs/ui` NumberStepper's animated display rolls in on commit).
 */
export function formattedValue(state: NumberFieldState): string {
  return format(state, committedValue(state));
}

/**
 * The currently parsed number value, or NaN if a valid number could not be parsed.
 * Updated based on the `inputValue` as the user types.
 */
export function numberValue(state: NumberFieldState): number {
  return numberParser(state).parse(inputValue(state));
}

/** The minimum value of the number field. */
export const minValue = (state: NumberFieldState): number | undefined => read(state.minValue);
/** The maximum value of the number field. */
export const maxValue = (state: NumberFieldState): number | undefined => read(state.maxValue);

function clampStep(state: NumberFieldState): number {
  const step = read(state.step);
  let clampStep = step !== undefined && !isNaN(step) ? step : 1;
  if (formatter(state).resolvedOptions().style === "percent" && (step === undefined || isNaN(step))) {
    clampStep = 0.01;
  }
  return clampStep;
}

/** Whether the current value can be incremented according to the maximum value and step. */
export function canIncrement(state: NumberFieldState): boolean {
  const parsedValue = numberValue(state);
  const min = minValue(state),
    max = maxValue(state),
    step = clampStep(state);
  return (
    !read(state.isDisabled) &&
    !read(state.isReadOnly) &&
    (isNaN(parsedValue) ||
      max === undefined ||
      isNaN(max) ||
      snapValueToStep(parsedValue, min, max, step) > parsedValue ||
      handleDecimalOperation("+", parsedValue, step) <= max)
  );
}

/** Whether the current value can be decremented according to the minimum value and step. */
export function canDecrement(state: NumberFieldState): boolean {
  const parsedValue = numberValue(state);
  const min = minValue(state),
    max = maxValue(state),
    step = clampStep(state);
  return (
    !read(state.isDisabled) &&
    !read(state.isReadOnly) &&
    (isNaN(parsedValue) ||
      min === undefined ||
      isNaN(min) ||
      snapValueToStep(parsedValue, min, max, step) < parsedValue ||
      handleDecimalOperation("-", parsedValue, step) >= min)
  );
}

/**
 * Validates a user input string according to the current locale and format options. Values can be
 * partially entered, and may be valid even if they cannot currently be parsed to a number. Can be
 * used to implement validation as a user types.
 */
export function validate(state: NumberFieldState, value: string): boolean {
  return untrack(() => numberParser(state).isValidPartialNumber(value, minValue(state), maxValue(state)));
}

// Mutations ------------------------------------------------------------------------------------

function writeNumberValue(state: NumberFieldState, value: number): void {
  const current = committedValue(state);
  if (!state.fixed && !Object.is(state.value(), value)) state.value.set(value);
  if (!Object.is(current, value)) state.onChange?.(value);
}

/** Sets the current text value of the input. */
export function setInputValue(state: NumberFieldState, value: string): void {
  untrack(() => {
    syncInputValue(state);
    state.input.set(value);
  });
}

/** Sets the number value. */
export function setNumberValue(state: NumberFieldState, value: number): void {
  untrack(() => {
    syncInputValue(state);
    writeNumberValue(state, value);
  });
}

/**
 * Commits the current input value. The value is parsed to a number, clamped according to the
 * minimum and maximum values of the field, and snapped to the nearest step value. This will fire
 * the `onChange` prop with the new value, and if uncontrolled, update the `numberValue`.
 * Typically this is called when the field is blurred.
 *
 * @param overrideValue - The value to commit. If not provided, the current input value is used.
 */
export function commit(state: NumberFieldState, overrideValue?: string): void {
  untrack(() => {
    syncInputValue(state);
    const numberValue_ = committedValue(state);
    const newInputValue = overrideValue === undefined ? state.input() : overrideValue;
    let newParsedValue = numberValue(state);
    if (overrideValue !== undefined) {
      newParsedValue = numberParser(state).parse(newInputValue);
    }
    // Set to empty state if input value is empty
    if (!newInputValue.length) {
      writeNumberValue(state, NaN);
      state.input.set(!state.controlled ? "" : format(state, numberValue_));
      return;
    }

    // if it failed to parse, then reset input to formatted version of current number
    if (isNaN(newParsedValue)) {
      state.input.set(format(state, numberValue_));
      return;
    }

    // Clamp to min and max, round to the nearest step, and round to specified number of digits
    let clampedValue = state.commitBehavior === "snap" ? snapValue(state, newParsedValue) : newParsedValue;
    clampedValue = numberParser(state).parse(format(state, clampedValue));
    const shouldValidate = clampedValue !== numberValue_;
    writeNumberValue(state, clampedValue);

    // in a controlled state, the numberValue won't change, so we won't go back to our old input without help
    state.input.set(format(state, !state.controlled ? clampedValue : numberValue_));
    if (shouldValidate) {
      commitValidation(state.validation);
    }
  });
}

function safeNextStep(state: NumberFieldState, operation: "+" | "-", minMax: number = 0): number {
  const prev = numberValue(state);
  const step = clampStep(state);
  const min = minValue(state),
    max = maxValue(state);

  if (isNaN(prev)) {
    // if the input is empty, start from the min/max value when incrementing/decrementing,
    // or zero if there is no min/max value defined.
    const newValue = isNaN(minMax) ? 0 : minMax;
    return snapValueToStep(newValue, min, max, step);
  } else {
    // otherwise, first snap the current value to the nearest step. if it moves in the direction
    // we're going, use that value, otherwise add the step and snap that value.
    const newValue = snapValueToStep(prev, min, max, step);
    if ((operation === "+" && newValue > prev) || (operation === "-" && newValue < prev)) {
      return newValue;
    }

    return snapValueToStep(handleDecimalOperation(operation, prev, step), min, max, step);
  }
}

/** Increments the current input value to the next step boundary, and fires `onChange`. */
export function increment(state: NumberFieldState): void {
  untrack(() => {
    syncInputValue(state);
    const newValue = safeNextStep(state, "+", minValue(state));

    // if we've arrived at the same value that was previously in the state, the
    // input value should be updated to match
    // ex type 4, press increment, highlight the number in the input, type 4 again, press increment
    // you'd be at 5, then incrementing to 5 again, so no re-render would happen and 4 would be left in the input
    if (newValue === committedValue(state)) {
      state.input.set(format(state, newValue));
    }

    writeNumberValue(state, newValue);
    commitValidation(state.validation);
  });
}

/** Decrements the current input value to the next step boundary, and fires `onChange`. */
export function decrement(state: NumberFieldState): void {
  untrack(() => {
    syncInputValue(state);
    const newValue = safeNextStep(state, "-", maxValue(state));

    if (newValue === committedValue(state)) {
      state.input.set(format(state, newValue));
    }

    writeNumberValue(state, newValue);
    commitValidation(state.validation);
  });
}

/** Sets the current value to the `maxValue` if any, and fires `onChange`. */
export function incrementToMax(state: NumberFieldState): void {
  untrack(() => {
    syncInputValue(state);
    const max = maxValue(state);
    if (max != null) {
      writeNumberValue(state, snapValueToStep(max, minValue(state), max, clampStep(state)));
      commitValidation(state.validation);
    }
  });
}

/** Sets the current value to the `minValue` if any, and fires `onChange`. */
export function decrementToMin(state: NumberFieldState): void {
  untrack(() => {
    syncInputValue(state);
    const min = minValue(state);
    if (min != null) {
      writeNumberValue(state, min);
      commitValidation(state.validation);
    }
  });
}

// Shallow equality is sufficient here because all values in Intl.NumberFormatOptions are primitives.
function isEqualFormatOptions(a: Intl.NumberFormatOptions | undefined, b: Intl.NumberFormatOptions | undefined) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if ((b as Record<string, unknown>)[key] !== (a as Record<string, unknown>)[key]) {
      return false;
    }
  }
  return true;
}

function handleDecimalOperation(operator: "-" | "+", value1: number, value2: number): number {
  let result = operator === "+" ? value1 + value2 : value1 - value2;

  // Check if we have decimals
  if (value1 % 1 !== 0 || value2 % 1 !== 0) {
    const value1Decimal = value1.toString().split(".");
    const value2Decimal = value2.toString().split(".");
    const value1DecimalLength = (value1Decimal[1] && value1Decimal[1].length) || 0;
    const value2DecimalLength = (value2Decimal[1] && value2Decimal[1].length) || 0;
    const multiplier = Math.pow(10, Math.max(value1DecimalLength, value2DecimalLength));

    // Transform the decimals to integers based on the precision
    value1 = Math.round(value1 * multiplier);
    value2 = Math.round(value2 * multiplier);

    // Perform the operation on integers values to make sure we don't get a fancy decimal value
    result = operator === "+" ? value1 + value2 : value1 - value2;

    // Transform the integer result back to decimal
    result /= multiplier;
  }

  return result;
}
