// @rivetjs/forms core: definitions, stores, reads, ids, handlers, imperative operations, types.
// Re-exports only (sideEffects: false): an app pays for the functions it imports.
export {
  defineForm,
  type FormDefinition,
  type FormOptions,
  type FieldConfig,
  type FieldCheckContext,
  type FieldCheckResult,
  type ValidateOn,
  type RevalidateOn,
  type SubmitContext,
  type SubmitFailure,
  type SubmitResult,
} from "./define.ts";
export { createForm, type CreateFormOptions, type Form, type FormStore, type FormView, type FormReply } from "./store.ts";
export {
  issues,
  issue,
  issueText,
  isInvalid,
  fieldIssues,
  formIssues,
  touched,
  dirty,
  value,
  submitting,
  submitted,
  submitCount,
  validating,
  lastResult,
  defaultValue,
  defaultChecked,
  autofocus,
  formId,
  path,
  fieldId,
  errorId,
  descriptionId,
  summaryId,
  describedBy,
} from "./reads.ts";
export { onInput, onChange, onBlur, onSubmit, onInvalid } from "./handlers.ts";
export { focusFirstInvalid } from "./dom.ts";
export { setValue, setIssues, clearIssues, reset } from "./mutate.ts";
export { validate, type ValidateResult } from "./validate.ts";
export { decodeFormData, FormDecodeError, type Coercion, type CoerceMap, type DecodeOptions, type DecodeLimits } from "./decode.ts";
export { formatIssue, mapSchemaIssues, toIssue, toIssues, type IssueMap } from "./issues.ts";
export type { FieldPath, FieldArrayPath, PathValue, Issue, IssueLike, InferInput, InferOutput } from "./types.ts";
export type { StandardSchemaV1 } from "./standard-schema.ts";
