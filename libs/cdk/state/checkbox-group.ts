// Ported from react-stately `useCheckboxGroupState` (packages/react-stately/src/checkbox/useCheckboxGroupState.ts),
// Apache-2.0, © Adobe.
// Rivet: plain signals + JSON; methods are free functions taking the state; the per-checkbox invalid
// map is a signal of a record; `value` plain or two-way Signal through `controllable` (RA
// useControlledState: several writes in one task chain on each other's result).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import {
  createFormValidationState,
  displayValidation,
  mergeValidation,
  updateValidation,
  type FormValidationOptions,
  type FormValidationState,
  type ValidationResult,
} from "./form-validation.ts";

export interface CheckboxGroupStateOptions extends Omit<FormValidationOptions<string[]>, "name"> {
  /** The current value (controlled): a plain array, a two-way Signal or an accessor (read live, never written). */
  value?: string[] | Signal<string[]> | (() => string[]);
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  /** Rivet (live props): an accessor stays live (`state.disabled`, read `isCheckboxGroupDisabled`). */
  isDisabled?: boolean | (() => boolean | undefined) | undefined;
  /** Rivet (live props): an accessor stays live (`state.readOnly`, read `isCheckboxGroupReadOnly`). */
  isReadOnly?: boolean | (() => boolean | undefined) | undefined;
  /** Rivet (live props): an accessor stays live (`state.isRequired`, read `isRequiredNow`). */
  isRequired?: boolean | (() => boolean | undefined) | undefined;
  name?: string | undefined;
}

export interface CheckboxGroupState {
  /** The shown selected values (signal; change with `setValue` / `addValue` / …). */
  readonly value: Signal<string[]>;
  /** RA `useControlledState` state behind `value`. */
  readonly controlled: ControlledState<string[]>;
  readonly defaultValue: readonly string[];
  /** Disabled at creation; read `isCheckboxGroupDisabled(state)` (follows a live `disabled`). */
  readonly isDisabled: boolean;
  /** Read-only at creation; read `isCheckboxGroupReadOnly(state)` (follows a live `readOnly`). */
  readonly isReadOnly: boolean;
  /** Live `isDisabled` / `isReadOnly` / `isRequired` accessors (live props). */
  readonly disabled?: (() => boolean | undefined) | undefined;
  readonly readOnly?: (() => boolean | undefined) | undefined;
  readonly requiredNow?: (() => boolean | undefined) | undefined;
  /** `isRequired` prop at creation (the group is required while nothing is selected: `isRequiredNow`). */
  readonly required: boolean;
  readonly validation: FormValidationState;
  /** Invalid checkbox results by value (RA `invalidValues` ref; merged into the group validation). */
  readonly invalid: Signal<Record<string, ValidationResult>>;
  /** RA `checkboxGroupData` (module WeakMap upstream): written by `checkboxGroupProps`, read by the items. */
  data?: {
    name?: string;
    form?: string;
    descriptionId?: { readonly id: string; readonly rendered: Signal<boolean | string> };
    errorMessageId?: { readonly id: string; readonly rendered: Signal<boolean | string> };
    validationBehavior: "aria" | "native";
  };
}

export function createCheckboxGroupState(options: CheckboxGroupStateOptions = {}): CheckboxGroupState {
  const controlled = controllable<string[]>(options.value, options.defaultValue || [], options.onChange);
  const value = controlled.value;
  const disabled = typeof options.isDisabled === "function" ? options.isDisabled : undefined;
  const readOnly = typeof options.isReadOnly === "function" ? options.isReadOnly : undefined;
  const requiredNow = typeof options.isRequired === "function" ? options.isRequired : undefined;
  return {
    value,
    controlled,
    defaultValue: options.defaultValue ?? untrack(value),
    isDisabled: disabled ? !!untrack(disabled) : !!options.isDisabled,
    isReadOnly: readOnly ? !!untrack(readOnly) : !!options.isReadOnly,
    ...(disabled ? { disabled } : {}),
    ...(readOnly ? { readOnly } : {}),
    ...(requiredNow ? { requiredNow } : {}),
    required: requiredNow ? !!untrack(requiredNow) : !!options.isRequired,
    validation: createFormValidationState({ ...options, value }),
    invalid: signal({}),
  };
}

/** RA `isRequired`: required while nothing is selected. Reads the value. */
export const isRequiredNow = (state: CheckboxGroupState): boolean => isCheckboxGroupRequired(state) && state.value().length === 0;
/** Whether the group is disabled now (its live `isDisabled` accessor, else the creation value). */
export const isCheckboxGroupDisabled = (state: CheckboxGroupState): boolean => (state.disabled ? !!state.disabled() : state.isDisabled);
/** Whether the group is read-only now (its live `isReadOnly` accessor, else the creation value). */
export const isCheckboxGroupReadOnly = (state: CheckboxGroupState): boolean => (state.readOnly ? !!state.readOnly() : state.isReadOnly);
/** The group's `isRequired` prop now (its live accessor, else the creation value). */
export const isCheckboxGroupRequired = (state: CheckboxGroupState): boolean => (state.requiredNow ? !!state.requiredNow() : state.required);
/** Whether writes are blocked now (read at event time: untracked). */
const blocked = (state: CheckboxGroupState): boolean => untrack(() => isCheckboxGroupReadOnly(state) || isCheckboxGroupDisabled(state));
export const isSelected = (state: CheckboxGroupState, v: string): boolean => state.value().includes(v);
export const isGroupInvalid = (state: CheckboxGroupState): boolean => displayValidation(state.validation).isInvalid;

const write = (state: CheckboxGroupState, next: string[] | ((previous: string[]) => string[])): void => setControlledValue(state.controlled, next);
/** The latest value, including writes earlier in the same task. */
const latest = (state: CheckboxGroupState): string[] => untrack(() => controlledValue(state.controlled));

export function setValue(state: CheckboxGroupState, next: string[]): void {
  if (blocked(state)) return;
  write(state, next);
}

export function addValue(state: CheckboxGroupState, v: string): void {
  if (blocked(state)) return;
  write(state, (current) => (current.includes(v) ? current : current.concat(v)));
}

export function removeValue(state: CheckboxGroupState, v: string): void {
  if (blocked(state)) return;
  const current = latest(state);
  if (current.includes(v))
    write(
      state,
      current.filter((x) => x !== v),
    );
}

export function toggleValue(state: CheckboxGroupState, v: string): void {
  if (blocked(state)) return;
  const current = latest(state);
  write(state, current.includes(v) ? current.filter((x) => x !== v) : current.concat(v));
}

/** RA `setInvalid`: record a checkbox's validation and merge all into the group's. */
export function setInvalid(state: CheckboxGroupState, v: string, result: ValidationResult): void {
  const next = { ...untrack(state.invalid) };
  if (result.isInvalid) next[v] = result;
  else delete next[v];
  state.invalid.set(next);
  updateValidation(state.validation, mergeValidation(...Object.values(next)));
}
