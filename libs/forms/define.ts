// Form definitions: module-scope values (schema, coercion, timing, field checks). Never serialized;
// handlers and actions import them, so the resumed browser reaches them through module imports.
import type { StandardSchemaV1 } from "./standard-schema.ts";
import type { CoerceMap } from "./decode.ts";
import type { FormStore } from "./store.ts";
import type { FieldPath, IssueLike, Schematic } from "./types.ts";

/** When a pristine field is first validated. */
export type ValidateOn = "submit" | "blur" | "input" | "change";
/** When a field that shows issues (or any field after a submit) is validated again. */
export type RevalidateOn = "input" | "blur" | "submit";
/** What a field check receives: abort signal, the decoded form input and the field path. */
export interface FieldCheckContext {
  /** Aborted when newer input supersedes this check. */
  readonly signal: AbortSignal;
  /** The whole decoded form input. */
  readonly values: unknown;
  readonly path: string;
}
/** What a field check returns: one issue, several, or nothing when the field is valid. */
export type FieldCheckResult = IssueLike | readonly IssueLike[] | undefined | null | void;
/** A field-level check (async allowed): availability lookups, server-side rules. */
export interface FieldConfig {
  /** Runs in the browser (and inside `action()` with `server: true`). */
  validate?: (value: unknown, context: FieldCheckContext) => FieldCheckResult | Promise<FieldCheckResult>;
  /** Ask the server: posts `_intent=validate:<path>`; the action runs its `checks` for the path. */
  remote?: boolean;
  /** Debounce input-triggered checks (ms; default 0, remote default 300). */
  debounce?: number;
  /** Also run `validate` in `action()` before the handler. */
  server?: boolean;
}
/** What a custom `submit` receives besides the validated value. */
export interface SubmitContext<T = unknown> {
  /** The submitted FormData (submitter's name/value included), e.g. a third-party POST body. */
  readonly formData: FormData;
  readonly element: HTMLFormElement;
  /** Aborted when the form is submitted again before this submit settles. */
  readonly signal: AbortSignal;
  /** The button that submitted the form, if any. */
  readonly submitter: HTMLElement | null;
  /** The form's store (`setIssues`, `reset`, reads). */
  readonly form: FormStore<T>;
}
/** A custom submit's failure answer: field issues by path, form-level issues. */
export interface SubmitFailure {
  readonly ok: false;
  readonly issues?: Readonly<Record<string, IssueLike | readonly IssueLike[] | undefined>>;
  readonly form?: IssueLike | readonly IssueLike[];
}
/** A custom submit's answer: `{ ok: false, issues?, form? }`, `{ ok: true, data }`, or any value (= data). */
export type SubmitResult = SubmitFailure | { readonly ok: true; readonly data?: unknown } | unknown;
/** Options of `defineForm()`: name, schema, coercion, validation timing and field checks. */
export interface FormOptions<S extends StandardSchemaV1> {
  /** Action name (`?/name`) and default form id. Letters, digits, `_` and `-`. */
  name: string;
  schema: S;
  /** FormData → typed input (`$` = any array index). */
  coerce?: CoerceMap;
  emptyAs?: "undefined" | "string";
  validateOn?: ValidateOn;
  revalidateOn?: RevalidateOn;
  /** Field checks by path or pattern (`items.$.sku`). */
  fields?: Partial<Record<FieldPath<StandardSchemaV1.InferInput<S>>, FieldConfig>> & Record<string, FieldConfig | undefined>;
  /** Extra paths/patterns never echoed after a failed POST; added to the always-on default (files, names matching /password|secret/i). */
  echo?: { exclude?: readonly string[] };
  /** Submit waits this long for pending field checks (ms, default 10000) → form issue `errors.timeout`. */
  asyncTimeout?: number;
  /** Focus (and scroll to) the first invalid field after a failed submit (default true). */
  focusOnInvalid?: boolean;
  /** Reset the form after a successful enhanced submit (default true). */
  resetOnSuccess?: boolean;
  /**
   * Re-render the page with fresh route data after a successful enhanced submit that stays on the
   * page (default true). Single flight: the action's answer carries the re-run loaders' data.
   */
  revalidate?: boolean;
  /** `false`: no fetch; a valid form submits natively (full page round trip). `submit` is then unused. */
  enhance?: boolean;
  /**
   * Custom transport (third-party endpoint, client-only logic) instead of the router action fetch:
   * runs in the browser after a valid submit with the schema output. `submitting()` is on while it
   * runs; a resubmit aborts `signal`. Return `{ ok: false, issues, form }` to show issues (first
   * invalid field focused), anything else is success (`lastResult()` = `data` or the value; form
   * reset unless `resetOnSuccess: false`); a throw → form issue `errors.submit` (message = error's).
   * Without JavaScript the form still posts natively to its `action`.
   */
  submit?: (value: StandardSchemaV1.InferOutput<S>, context: SubmitContext<StandardSchemaV1.InferInput<S>>) => SubmitResult | Promise<SubmitResult>;
  /** `"always"`: show issues as soon as they exist, not only for touched fields / after submit. */
  showIssues?: "touched" | "always";
}
/** A form defined with `defineForm()`. */
export interface FormDefinition<S extends StandardSchemaV1 = StandardSchemaV1> extends Readonly<FormOptions<S>>, Schematic<S> {
  readonly schema: S;
}

/** Define a form at module scope. */
export function defineForm<S extends StandardSchemaV1>(options: FormOptions<S>): FormDefinition<S> {
  if (!/^[\w-]+$/.test(options.name)) throw new TypeError(`defineForm: name must be letters, digits, "_" or "-" (got ${JSON.stringify(options.name)})`);
  if (!options.schema || typeof options.schema["~standard"]?.validate !== "function")
    throw new TypeError("defineForm: schema must implement Standard Schema v1");
  return Object.freeze({ ...options });
}
