// Ported from react-aria `useFormValidation` + `useFormReset` (packages/react-aria/src/form/useFormValidation.ts,
// src/utils/useFormReset.ts), Apache-2.0, © Adobe.
// Rivet: no layout effect runs before interaction, so the native custom validity is synced from the
// field's handlers (`syncValidity` at input / change / focus / invalid) and, for fields never touched,
// by `<Form>`'s submit handler from the `data-rv-error` attribute the field renders (`formSubmit`).
// Deviation: no `form.reset` override (`isIgnoredReset`: detects React's automatic form reset after
// server actions; Rivet never resets forms programmatically), so every reset clears the validation.
import { untrack } from "@rivetjs/reactivity";
import { setInteractionModality } from "../interactions/focus-visible.tsx";
import {
  clearServerErrors,
  commitValidation,
  displayValidation,
  realtimeValidation,
  resetValidation,
  updateValidation,
  type FormValidationState,
  type ValidationResult,
} from "../state/form-validation.ts";

export type ValidatableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const ERROR_ATTR = "data-rv-error";

/**
 * `data-rv-error` attribute value (render it on the native input in `native` mode): the realtime
 * error text, so `<Form>` can apply it as custom validity before a cold submit. Reads the state.
 */
export function validityError(state: FormValidationState): string | undefined {
  if (state.behavior !== "native") return undefined;
  const realtime = realtimeValidation(state);
  return realtime.isInvalid ? realtime.validationErrors.join(" ") || "Invalid value." : undefined;
}

/** Snapshot of the element's native validity. */
export function nativeValidity(input: ValidatableElement): ValidationResult {
  const v = input.validity;
  return {
    isInvalid: !v.valid,
    validationDetails: {
      badInput: v.badInput,
      customError: v.customError,
      patternMismatch: v.patternMismatch,
      rangeOverflow: v.rangeOverflow,
      rangeUnderflow: v.rangeUnderflow,
      stepMismatch: v.stepMismatch,
      tooLong: v.tooLong,
      tooShort: v.tooShort,
      typeMismatch: v.typeMismatch,
      valueMissing: v.valueMissing,
      valid: v.valid,
    },
    validationErrors: input.validationMessage ? [input.validationMessage] : [],
  };
}

/**
 * The layout effect of `useFormValidation`: native mode sets the realtime error as custom validity
 * (prevents submit) and, when valid, records the native validity for the next commit.
 */
export function syncValidity(state: FormValidationState, input: ValidatableElement | null | undefined): void {
  if (state.behavior !== "native" || !input || !("setCustomValidity" in input) || input.disabled) return;
  const realtime = untrack(() => realtimeValidation(state));
  input.setCustomValidity(realtime.isInvalid ? realtime.validationErrors.join(" ") || "Invalid value." : "");
  // Prevent the default tooltip for the validation message (Firefox).
  if (!input.hasAttribute("title")) input.title = "";
  if (!realtime.isInvalid) updateValidation(state, nativeValidity(input));
  attachReset(state, input);
}

function firstInvalid(form: HTMLFormElement): Element | null {
  for (let i = 0; i < form.elements.length; i++) {
    const element = form.elements[i] as ValidatableElement;
    if (element.validity?.valid === false) return element;
  }
  return null;
}

/** `invalid` event on the native input (fires on submit / checkValidity; captured, it does not bubble). */
export function validationInvalid(state: FormValidationState, event: Event, focus?: () => void): void {
  const input = event.target as ValidatableElement;
  // Only commit when not already displaying an error: keeps server errors the user did not fix.
  if (!untrack(() => displayValidation(state)).isInvalid) commit(state, input);
  // Focus the first invalid input of the form unless the event was already handled.
  const form = input.form;
  if (!event.defaultPrevented && form && firstInvalid(form) === input) {
    if (focus) focus();
    else input.focus();
    // Always show focus ring.
    setInteractionModality("keyboard");
  }
  // Prevent the browser's error bubble.
  event.preventDefault();
}

/** `change` on the native input: commit (RA `onChange` listener). */
export function validationChange(state: FormValidationState, input: ValidatableElement | null): void {
  commit(state, input);
}

/** RA order: server errors cleared → (render) layout effect syncs the custom validity → effect commits. */
export function commit(state: FormValidationState, input: ValidatableElement | null | undefined): void {
  clearServerErrors(state);
  syncValidity(state, input);
  commitValidation(state);
}

// Form reset (RA `useFormReset` + reset listener): attached on the first handler that sees the input.
// Rivet: attached from handlers (no owner to clean up with), so an entry whose input left the form is dropped on the
// next attach / reset of that form — it is no longer one of the form's fields (native reset skips it too), and its
// closure (state + input) was kept for the form's lifetime. Its owner can attach again once the input is back.
interface ResetEntry {
  readonly input: Element;
  readonly fn: () => void;
}
const resetFns = new WeakMap<HTMLFormElement, Map<object, ResetEntry>>();
const attached = new WeakSet<object>();

/** Drops entries whose input is no longer a field of `form`. */
function prune(form: HTMLFormElement, entries: Map<object, ResetEntry>): void {
  for (const [owner, entry] of entries)
    if (!entry.input.isConnected || (entry.input as HTMLInputElement).form !== form) {
      entries.delete(owner);
      attached.delete(owner);
    }
}

/** Run `fn` when the input's form resets (once per state). */
export function onFormReset(owner: object, input: ValidatableElement | HTMLElement | null | undefined, fn: () => void): void {
  const form = (input as HTMLInputElement | null)?.form;
  if (!form || attached.has(owner)) return;
  attached.add(owner);
  let entries = resetFns.get(form);
  if (!entries) {
    const own = new Map<object, ResetEntry>();
    resetFns.set(form, (entries = own));
    // RA useFormReset: a reset cancelled (in the capture phase) resets nothing.
    form.addEventListener("reset", (event) => {
      if (event.defaultPrevented) return;
      prune(form, own);
      for (const entry of [...own.values()]) entry.fn();
    });
  } else prune(form, entries);
  entries.set(owner, { input: input!, fn });
}

function attachReset(state: FormValidationState, input: ValidatableElement): void {
  onFormReset(state, input, () => resetValidation(state));
}

/**
 * `<Form>` submit (and any form's submit): apply `data-rv-error` of every field as custom validity
 * (fields never interacted with have not synced it yet); when that makes the form invalid, cancel and
 * report (fires `invalid` → fields commit and the first one focuses).
 */
export function applyPendingValidity(form: HTMLFormElement): boolean {
  let changed = false;
  for (const element of form.querySelectorAll<ValidatableElement>(`[${ERROR_ATTR}]`)) {
    const message = element.getAttribute(ERROR_ATTR) ?? "";
    if (element.validationMessage !== message && !element.disabled) {
      element.setCustomValidity(message);
      changed = true;
    }
  }
  return changed;
}

export function formSubmit(event: SubmitEvent): void {
  const form = event.currentTarget as HTMLFormElement;
  if (form.noValidate) return;
  if (applyPendingValidity(form) && !form.checkValidity()) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
