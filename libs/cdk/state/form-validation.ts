// Ported from react-stately `useFormValidationState` (packages/react-stately/src/form/useFormValidationState.ts),
// Apache-2.0, © Adobe. Rivet: plain signals + JSON (serializable, resumable); "realtime" / "display"
// validation are read functions (bindings call them) instead of per-render values.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";

/** Snapshot of `ValidityState` (the native object is live and not serializable). */
export interface ValidityDetails {
  badInput: boolean;
  customError: boolean;
  patternMismatch: boolean;
  rangeOverflow: boolean;
  rangeUnderflow: boolean;
  stepMismatch: boolean;
  tooLong: boolean;
  tooShort: boolean;
  typeMismatch: boolean;
  valueMissing: boolean;
  valid: boolean;
}

export interface ValidationResult {
  /** Whether the input value is invalid. */
  isInvalid: boolean;
  /** The current error messages for the input if it is invalid, otherwise an empty array. */
  validationErrors: string[];
  /** The native validation details for the input. */
  validationDetails: ValidityDetails;
}

/** Server errors per field name (RAC `Form validationErrors`). */
export type ValidationErrors = Record<string, string | string[]>;
/** Custom client validation: error message(s), or `true` / null / undefined when valid. */
export type ValidationFunction<T> = (value: T) => string | string[] | true | null | undefined;
export type ValidationBehavior = "aria" | "native";

export const VALID_VALIDITY_STATE: ValidityDetails = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valueMissing: false,
  valid: true,
};

const CUSTOM_VALIDITY_STATE: ValidityDetails = { ...VALID_VALIDITY_STATE, customError: true, valid: false };

export const DEFAULT_VALIDATION_RESULT: ValidationResult = {
  isInvalid: false,
  validationDetails: VALID_VALIDITY_STATE,
  validationErrors: [],
};

/** A value or an accessor (props that may read signals are accessors: the component body must not read). */
export type MaybeAccessor<T> = T | (() => T);
export const read = <T>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

export interface FormValidationOptions<T> {
  /** Controlled invalid state (`true` / `false`); a signal or accessor stays live. */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  /** Legacy `validationState="invalid"`. */
  validationState?: "valid" | "invalid";
  /** Custom client validation of the current value. */
  validate?: ValidationFunction<T>;
  /** `native` (default for the components): constraint validation blocks submit, errors show on commit; `aria`: realtime, never blocks. */
  validationBehavior?: ValidationBehavior;
  /** Field name(s) whose server errors (`validationErrors`) apply. */
  name?: string | string[];
  /** Server errors (from `<Form validationErrors>` context, or passed directly). */
  validationErrors?: MaybeAccessor<ValidationErrors | undefined>;
  /** Built-in validation of a composite state (e.g. CheckboxGroup required), valid → ignored. */
  builtinValidation?: MaybeAccessor<ValidationResult | undefined>;
}

export interface FormValidationState {
  readonly behavior: ValidationBehavior;
  /** Current value accessor (the field's value signal). */
  readonly value: () => unknown;
  readonly isInvalid: MaybeAccessor<boolean | undefined> | undefined;
  readonly validate: ValidationFunction<any> | undefined;
  readonly name: string | string[] | undefined;
  readonly serverErrors: MaybeAccessor<ValidationErrors | undefined> | undefined;
  readonly builtin: MaybeAccessor<ValidationResult | undefined> | undefined;
  /** Committed (displayed) validation result — RA `currentValidity`. */
  readonly current: Signal<ValidationResult>;
  /** The server-errors object the user cleared by editing (`isServerErrorCleared` keyed by identity: a new object shows again). */
  readonly cleared: Signal<ValidationErrors | null | undefined>;
  /** Native mode: the next result (from native validity), shown on commit — RA `nextValidation` ref. */
  readonly next: Signal<ValidationResult>;
}

/** Create the validation state of a field. `value` is the field's value accessor (pass the value signal). */
export function createFormValidationState<T>(options: FormValidationOptions<T> & { value: () => T }): FormValidationState {
  let isInvalid = options.isInvalid;
  if (options.validationState === "invalid" && isInvalid === undefined) isInvalid = true;
  return {
    behavior: options.validationBehavior ?? "aria",
    value: options.value,
    isInvalid,
    validate: options.validate,
    name: options.name,
    serverErrors: options.validationErrors,
    builtin: options.builtinValidation,
    current: signal(DEFAULT_VALIDATION_RESULT),
    cleared: signal<ValidationErrors | null | undefined>(null),
    next: signal(DEFAULT_VALIDATION_RESULT),
  };
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function runValidate<T>(validate: ValidationFunction<T> | undefined, value: T): string[] {
  if (typeof validate === "function") {
    const e = validate(value);
    if (e && typeof e !== "boolean") return asArray(e);
  }
  return [];
}

export function getValidationResult(errors: string[]): ValidationResult | null {
  return errors.length ? { isInvalid: true, validationErrors: errors, validationDetails: CUSTOM_VALIDITY_STATE } : null;
}

export function isEqualValidation(a: ValidationResult | null | undefined, b: ValidationResult | null | undefined): boolean {
  if (a === b) return true;
  return (
    !!a &&
    !!b &&
    a.isInvalid === b.isInvalid &&
    a.validationErrors.length === b.validationErrors.length &&
    a.validationErrors.every((e, i) => e === b.validationErrors[i]) &&
    (Object.keys(a.validationDetails) as (keyof ValidityDetails)[]).every((k) => b.validationDetails[k] === a.validationDetails[k])
  );
}

export function mergeValidation(...results: ValidationResult[]): ValidationResult {
  const errors = new Set<string>();
  let isInvalid = false;
  const validationDetails = { ...VALID_VALIDITY_STATE };
  for (const v of results) {
    for (const e of v.validationErrors) errors.add(e);
    isInvalid ||= v.isInvalid;
    for (const key in validationDetails) {
      const k = key as keyof ValidityDetails;
      validationDetails[k] ||= v.validationDetails[k];
    }
  }
  validationDetails.valid = !isInvalid;
  return { isInvalid, validationErrors: [...errors], validationDetails };
}

const controlledError = (state: FormValidationState): ValidationResult | null => {
  const invalid = state.isInvalid === undefined ? undefined : read(state.isInvalid);
  return invalid !== undefined ? { isInvalid: invalid, validationErrors: [], validationDetails: CUSTOM_VALIDITY_STATE } : null;
};

const clientError = (state: FormValidationState): ValidationResult | null => {
  if (!state.validate) return null;
  const value = state.value();
  if (value == null) return null;
  return getValidationResult(runValidate(state.validate, value));
};

const builtinError = (state: FormValidationState): ValidationResult | null => {
  const builtin = state.builtin === undefined ? undefined : read(state.builtin);
  return builtin && !builtin.validationDetails.valid ? builtin : null;
};

function serverError(state: FormValidationState): ValidationResult | null {
  if (state.serverErrors === undefined || state.name === undefined) return null;
  const errors = read(state.serverErrors);
  if (!errors || state.cleared() === errors) return null;
  const { name } = state;
  const messages = Array.isArray(name) ? name.flatMap((n) => asArray(errors[n])) : asArray(errors[name]);
  return getValidationResult(messages);
}

/** Realtime validation (drives the native custom validity). Reads the value, controlled and server errors. */
export function realtimeValidation(state: FormValidationState): ValidationResult {
  return controlledError(state) || serverError(state) || clientError(state) || builtinError(state) || DEFAULT_VALIDATION_RESULT;
}

/** Displayed validation (aria-invalid, error message). `native`: committed results only (after change / blur / submit). */
export function displayValidation(state: FormValidationState): ValidationResult {
  if (state.behavior === "native") return controlledError(state) || serverError(state) || state.current();
  return controlledError(state) || serverError(state) || clientError(state) || builtinError(state) || state.current();
}

/** Store a validation result (native validity). `aria`: shown at once; `native`: shown on the next commit. */
export function updateValidation(state: FormValidationState, result: ValidationResult): void {
  if (state.behavior === "aria") {
    if (!isEqualValidation(untrack(state.current), result)) state.current.set(result);
  } else if (!isEqualValidation(untrack(state.next), result)) state.next.set(result);
}

/** Hide the current server errors (RA `setServerErrorCleared(true)`); a new errors object shows again. */
export function clearServerErrors(state: FormValidationState): void {
  if (state.serverErrors === undefined) return;
  const errors = untrack(() => read(state.serverErrors!));
  if (errors && untrack(state.cleared) !== errors) state.cleared.set(errors);
}

/** Reset the displayed result to valid (form reset); server errors are cleared too. */
export function resetValidation(state: FormValidationState): void {
  if (!isEqualValidation(untrack(state.current), DEFAULT_VALIDATION_RESULT)) state.current.set(DEFAULT_VALIDATION_RESULT);
  if (state.behavior === "native" && !isEqualValidation(untrack(state.next), DEFAULT_VALIDATION_RESULT)) state.next.set(DEFAULT_VALIDATION_RESULT);
  clearServerErrors(state);
}

/**
 * Commit the realtime validation so the user sees it (blur / change / submit). Also clears server
 * errors. RA defers the commit to after the next render; handlers here run after the value signal
 * was written, so the commit is immediate.
 */
export function commitValidation(state: FormValidationState): void {
  clearServerErrors(state);
  if (state.behavior !== "native") return;
  const error = untrack(() => clientError(state) || builtinError(state)) || untrack(state.next);
  if (!isEqualValidation(error, untrack(state.current))) state.current.set(error);
}
