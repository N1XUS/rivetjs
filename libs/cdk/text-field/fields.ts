// Shared field helpers (pure functions over a validation state): error text and `aria-describedby` of
// fields that are not yet RAC-composed (radio-group, select, date fields). The `useTextField` /
// `useFormattedTextField` ports live in `behaviour.tsx` (`@rivetjs/cdk/text-field/behaviour`).
import { displayValidation, type FormValidationState, type ValidationResult } from "../state/form-validation.ts";
import { describedBy, type FieldIds } from "../label/behaviour.ts";

// ---- shared field helpers (checkbox, radio-group, select, date fields) ----

/** Any field state carrying a validation state (or the validation state itself). */
export type HasValidation = { readonly validation: FormValidationState } | FormValidationState;

export type ErrorMessage<C> = C | ((validation: ValidationResult) => C);

/** Error text shown for the current validation (RAC `FieldError` default children: errors joined). */
export function errorText<C>(state: HasValidation, errorMessage: ErrorMessage<C> | undefined): C | string | undefined {
  const validation = displayValidation("validation" in state ? state.validation : state);
  if (!validation.isInvalid) return undefined;
  const custom = typeof errorMessage === "function" ? (errorMessage as (v: ValidationResult) => C)(validation) : errorMessage;
  if (custom != null && (custom as unknown) !== "") return custom;
  return validation.validationErrors.length ? validation.validationErrors.join(" ") : undefined;
}

/** `aria-describedby` of the control (error id only while an error message renders). */
export function fieldDescribedBy<C>(state: HasValidation, ids: FieldIds, errorMessage: ErrorMessage<C> | undefined): string | undefined {
  return describedBy(ids, errorText(state, errorMessage) !== undefined);
}

export const isInvalid = (state: HasValidation): boolean => displayValidation("validation" in state ? state.validation : state).isInvalid;
