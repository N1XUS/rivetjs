// Ported from react-stately `useRadioGroupState` (packages/react-stately/src/radio/useRadioGroupState.ts), Apache-2.0, © Adobe.
// Rivet: `value` is a two-way Signal, a plain value or an accessor (live prop `value={v()}`); plain / accessor values
// are controlled as upstream (`state.fixed`: never written, a change only calls `onChange`).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/cdk/id";
import { commitValidation, createFormValidationState, displayValidation, type FormValidationOptions, type FormValidationState } from "./form-validation.ts";

export interface RadioGroupStateOptions extends Omit<FormValidationOptions<string | null>, "name"> {
  /** Selected value (controlled): a two-way Signal, a plain value or an accessor (read live, never written). */
  value?: Signal<string | null> | (() => string | null) | string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  name?: string;
  /** Rivet (live props): an accessor stays live (`state.disabled`, read `isRadioGroupDisabled`). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** Rivet (live props): an accessor stays live (`state.readOnly`, read `isRadioGroupReadOnly`). */
  isReadOnly?: boolean | (() => boolean | undefined);
  /** Rivet (live props): an accessor stays live (`state.required`, read `isRadioGroupRequired`). */
  isRequired?: boolean | (() => boolean | undefined);
}

export interface RadioGroupState {
  /** Group name shared by the radios (generated when omitted). */
  readonly name: string;
  /** The selected value (read it; write through `setSelectedValue`: a fixed one is never `.set`). */
  readonly selectedValue: Signal<string | null>;
  /** A plain / accessor controlled value: never written (changes only call `onChange`). */
  readonly fixed: boolean;
  readonly defaultSelectedValue: string | null;
  /** Last focused radio (roving tab stop while nothing is selected). */
  readonly lastFocusedValue: Signal<string | null>;
  /** Disabled at creation; read `isRadioGroupDisabled(state)` (follows a live `disabled`). */
  readonly isDisabled: boolean;
  /** Read-only at creation; read `isRadioGroupReadOnly(state)` (follows a live `readOnly`). */
  readonly isReadOnly: boolean;
  /** Live `isDisabled` / `isReadOnly` accessors (live props). */
  readonly disabled?: (() => boolean | undefined) | undefined;
  readonly readOnly?: (() => boolean | undefined) | undefined;
  /** Required at creation; read `isRadioGroupRequired(state)` (follows a live `required`). */
  readonly isRequired: boolean;
  readonly required?: (() => boolean | undefined) | undefined;
  readonly onChange: ((value: string) => void) | undefined;
  readonly validation: FormValidationState;
  /** RA `radioGroupData` (module WeakMap in RA): set by the compound `RadioGroup` for its radios (`radio-group/parts.tsx`). */
  data?: { form?: string; descriptionId: unknown; errorMessageId: unknown; validationBehavior: "aria" | "native" };
}

export function createRadioGroupState(options: RadioGroupStateOptions = {}): RadioGroupState {
  const given = options.value;
  const isSignal = typeof given === "function" && typeof (given as Signal<unknown>).set === "function";
  const fixed = given !== undefined && !isSignal;
  // useControlledState: a Signal is two-way, an accessor is read as is, a plain value is a never-written signal.
  const selectedValue = (
    isSignal || typeof given === "function"
      ? given
      : fixed
        ? signal<string | null>(given as string | null)
        : signal<string | null>(options.defaultValue ?? null)
  ) as Signal<string | null>;
  const name = options.name ?? createId();
  const disabled = typeof options.isDisabled === "function" ? options.isDisabled : undefined;
  const readOnly = typeof options.isReadOnly === "function" ? options.isReadOnly : undefined;
  return {
    name,
    selectedValue,
    fixed,
    defaultSelectedValue: options.value !== undefined ? untrack(selectedValue) : (options.defaultValue ?? null),
    lastFocusedValue: signal<string | null>(null),
    isDisabled: disabled ? !!untrack(disabled) : !!options.isDisabled,
    isReadOnly: readOnly ? !!untrack(readOnly) : !!options.isReadOnly,
    ...(disabled ? { disabled } : {}),
    ...(readOnly ? { readOnly } : {}),
    isRequired: typeof options.isRequired === "function" ? !!untrack(options.isRequired) : (options.isRequired ?? false),
    ...(typeof options.isRequired === "function" ? { required: options.isRequired } : {}),
    onChange: options.onChange,
    validation: createFormValidationState({ ...options, name: options.name, value: selectedValue }),
  };
}

/** Whether the group is disabled now (its live `isDisabled` accessor, else the creation value). */
export const isRadioGroupDisabled = (state: RadioGroupState): boolean => (state.disabled ? !!state.disabled() : state.isDisabled);
/** Whether the group is required now (its live `isRequired` accessor, else the creation value). */
export const isRadioGroupRequired = (state: RadioGroupState): boolean => (state.required ? !!state.required() : state.isRequired);
/** Whether the group is read-only now (its live `isReadOnly` accessor, else the creation value). */
export const isRadioGroupReadOnly = (state: RadioGroupState): boolean => (state.readOnly ? !!state.readOnly() : state.isReadOnly);

/** RA `setSelectedValue`: ignored while read-only / disabled; commits validation. */
export function setSelectedValue(state: RadioGroupState, value: string | null): void {
  if (isRadioGroupReadOnly(state) || isRadioGroupDisabled(state)) return;
  if (untrack(state.selectedValue) !== value) {
    if (!state.fixed) state.selectedValue.set(value);
    if (value !== null) state.onChange?.(value);
  }
  commitValidation(state.validation);
}

export function setLastFocusedValue(state: RadioGroupState, value: string | null): void {
  if (untrack(state.lastFocusedValue) !== value) state.lastFocusedValue.set(value);
}

export const isRadioInvalid = (state: RadioGroupState): boolean => displayValidation(state.validation).isInvalid;

/** RA useRadio tab index: the selected radio, else the last focused (or every radio when none). */
export function radioTabIndex(state: RadioGroupState, value: string, isDisabled: boolean): number | undefined {
  if (isDisabled) return undefined;
  const selected = state.selectedValue();
  if (selected != null) return selected === value ? 0 : -1;
  const last = state.lastFocusedValue();
  return last === value || last == null ? 0 : -1;
}
