// Ported from react-aria `useRadioGroup` + `useRadio` (packages/react-aria/src/radio/useRadioGroup.ts,
// src/radio/useRadio.ts), Apache-2.0, © Adobe.
// Rivet: native radios sharing a name give arrow-key navigation (wrap, skip disabled, select on arrow),
// the single tab stop and form submission without JS; these handlers keep the state, read-only and
// validation in step.
import { untrack } from "@rivetjs/reactivity";
import {
  DEFAULT_VALIDATION_RESULT,
  clearServerErrors,
  commitValidation,
  realtimeValidation,
  resetValidation,
  updateValidation,
} from "../state/form-validation.ts";
import { nativeValidity, onFormReset, validationInvalid } from "../form/behaviour.ts";
import { isRadioGroupDisabled, isRadioGroupReadOnly, setLastFocusedValue, setSelectedValue, type RadioGroupState } from "../state/radio-group.ts";

const radios = (input: HTMLInputElement): HTMLInputElement[] => {
  const group = input.closest('[role="radiogroup"]');
  return group ? [...group.querySelectorAll<HTMLInputElement>('input[type="radio"]')] : [input];
};

/** Native validation of the group (RA useRadio `useFormValidation` on every radio). */
export function syncRadioValidity(state: RadioGroupState, input: HTMLInputElement): void {
  const { validation } = state;
  onFormReset(state, input, () => {
    if (!state.fixed) state.selectedValue.set(state.defaultSelectedValue);
    resetValidation(validation);
  });
  if (validation.behavior !== "native") return;
  const realtime = untrack(() => realtimeValidation(validation));
  const message = realtime.isInvalid ? realtime.validationErrors.join(" ") || "Invalid value." : "";
  const inputs = radios(input);
  for (const el of inputs) {
    if (el.disabled) continue;
    el.setCustomValidity(message);
    if (!el.hasAttribute("title")) el.title = "";
  }
  if (!realtime.isInvalid) {
    const invalid = inputs.filter((el) => !el.disabled && !el.validity.valid).map(nativeValidity);
    updateValidation(validation, invalid.length ? invalid[0]! : DEFAULT_VALIDATION_RESULT);
  }
}

/** `change` on a radio (`value` = the radio value). Read-only: restore the selected radio. */
export function radioChange(state: RadioGroupState, value: string, event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  event.stopPropagation();
  if (isRadioGroupReadOnly(state) || isRadioGroupDisabled(state)) {
    const selected = untrack(state.selectedValue);
    for (const el of radios(input)) el.checked = el.value === selected;
    return;
  }
  if (!input.checked) return;
  clearServerErrors(state.validation);
  // RA setSelectedValue commits; sync the custom validity first (RA layout effect order).
  if (untrack(state.selectedValue) !== value) {
    if (!state.fixed) state.selectedValue.set(value);
    state.onChange?.(value);
    // Controlled (plain / accessor value): the radios show the prop, not the click (React restores a controlled
    // input) — re-sync after the caller's update has flushed.
    if (state.fixed) queueMicrotask(() => restoreRadios(state, input));
  }
  syncRadioValidity(state, input);
  commitValidation(state.validation);
}

function restoreRadios(state: RadioGroupState, input: HTMLInputElement): void {
  const selected = untrack(state.selectedValue);
  for (const el of radios(input)) el.checked = el.value === selected;
}

export function radioFocus(state: RadioGroupState, value: string, event: Event): void {
  setLastFocusedValue(state, value);
  syncRadioValidity(state, event.currentTarget as HTMLInputElement);
}

/** RA useRadioGroup `onBlur` (focus-within): forget the last focused radio when focus leaves the group. */
export function radioGroupFocusOut(state: RadioGroupState, event: FocusEvent): void {
  const group = event.currentTarget as HTMLElement;
  if (!group.contains(event.relatedTarget as Node | null)) setLastFocusedValue(state, null);
}

export function radioInvalid(state: RadioGroupState, event: Event): void {
  syncRadioValidity(state, event.currentTarget as HTMLInputElement);
  validationInvalid(state.validation, event);
}

/** Programmatic selection (RA `state.setSelectedValue`). */
export { setSelectedValue };
