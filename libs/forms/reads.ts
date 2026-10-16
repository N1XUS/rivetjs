// Reads for bindings (`aria-invalid={isInvalid(form, "email")}`): each reads the fewest signals —
// a field binding subscribes to that field's record only.
import { signal, untrack } from "@rivetjs/reactivity";
import { getAt, idSafe } from "./path.ts";
import { formatIssue } from "./issues.ts";
import { absolute, initialOf, issueSignal, prefixOf, storeOf, SUBMITTED, SUBMITTING, touchedSignal, VALIDATING, validatingSignal, valueSignal, type Form } from "./store.ts";
import type { FieldPath, Issue, PathValue } from "./types.ts";

/** Shown issues of a field (undefined when none). */
export function issues<T, P extends FieldPath<T>>(form: Form<T>, path: P): Issue[] | undefined {
  return issueSignal(storeOf(form), absolute(form, path))();
}
/** First shown issue of a field. */
export function issue<T, P extends FieldPath<T>>(form: Form<T>, path: P): Issue | undefined {
  return issueSignal(storeOf(form), absolute(form, path))()?.[0];
}
/** First shown issue as text: `format(issue)` (i18n), else its message or key. */
export function issueText<T, P extends FieldPath<T>>(form: Form<T>, path: P, format?: (issue: Issue) => string): string | undefined {
  const first = issueSignal(storeOf(form), absolute(form, path))()?.[0];
  return first && formatIssue(first, format);
}
/** `true` while the field (or, without a path, the form or view) shows issues; else undefined (no attribute). */
export function isInvalid<T>(form: Form<T>, path?: FieldPath<T>): true | undefined {
  const store = storeOf(form);
  if (path !== undefined) return issueSignal(store, absolute(form, path))() ? true : undefined;
  return fieldIssues(form).length || (!prefixOf(form) && store.fe().length) ? true : undefined;
}
/** Every shown field issue list under the form or view, in field order: `[path, issues]`. */
export function fieldIssues<T>(form: Form<T>): [path: string, issues: Issue[]][] {
  const store = storeOf(form);
  const prefix = prefixOf(form);
  store.u();
  const out: [string, Issue[]][] = [];
  for (const path in store.f) {
    if (!path.startsWith(prefix)) continue;
    const shown = store.f[path]!();
    if (shown) out.push([path.slice(prefix.length), shown]);
  }
  return out;
}
/** Form-level issues (schema root issues, action errors, network failures). */
export function formIssues<T>(form: Form<T>): Issue[] {
  return storeOf(form).fe();
}
/** The field was blurred at least once. */
export function touched<T, P extends FieldPath<T>>(form: Form<T>, path: P): boolean {
  return touchedSignal(storeOf(form), absolute(form, path))();
}
/** Whether a submit is in progress (reactive). */
export const submitting = <T>(form: Form<T>): boolean => (storeOf(form).st() & SUBMITTING) !== 0;
/** Whether the form was submitted at least once (reactive). */
export const submitted = <T>(form: Form<T>): boolean => (storeOf(form).st() & SUBMITTED) !== 0;
/** How many times the form was submitted (reactive). */
export const submitCount = <T>(form: Form<T>): number => storeOf(form).c();
/** A field check (or, without a path, any check or async schema) is pending. */
export function validating<T>(form: Form<T>, path?: FieldPath<T>): boolean {
  const store = storeOf(form);
  if (path === undefined) return (store.st() & VALIDATING) !== 0;
  return validatingSignal(store, absolute(form, path))();
}
/** Data of the last successful submit (enhanced or no-JS). */
export function lastResult<T>(form: Form<T>): unknown {
  return (storeOf(form).r ??= signal<unknown>(undefined))();
}

/** Server-side default for an input's `value`: echoed submission, else `initial`. Not reactive. */
export function defaultValue<T, P extends FieldPath<T>>(form: Form<T>, path: P): string | undefined {
  const store = storeOf(form);
  const name = absolute(form, path);
  const echoed = store.x?.[name];
  if (echoed !== undefined) return Array.isArray(echoed) ? echoed[0] : echoed;
  const initial = getAt(initialOf(store), name);
  if (initial === undefined || initial === null || typeof initial === "object") return initial instanceof Date ? initial.toISOString().slice(0, 10) : undefined;
  return String(initial);
}
/** Server-side `checked` for a checkbox/radio (`value` = the input's value; omit for boolean checkboxes). */
export function defaultChecked<T, P extends FieldPath<T>>(form: Form<T>, path: P, value?: string): boolean {
  const store = storeOf(form);
  const name = absolute(form, path);
  if (store.x) {
    const echoed = store.x[name];
    if (echoed === undefined) return false; // the submission did not include it: unchecked
    return value === undefined ? true : Array.isArray(echoed) ? echoed.includes(value) : echoed === value;
  }
  const initial = getAt(initialOf(store), name);
  if (value === undefined) return initial === true;
  return Array.isArray(initial) ? initial.map(String).includes(value) : initial !== undefined && String(initial) === value;
}
/** `true` on the first field showing issues (no-JS: the re-rendered page focuses it). */
export function autofocus<T, P extends FieldPath<T>>(form: Form<T>, path: P): true | undefined {
  const store = storeOf(form);
  const name = absolute(form, path);
  for (const key in store.f) if (untrack(store.f[key]!)) return key === name ? true : undefined;
  return undefined;
}

/** Current value (reactive; created on first read from the server default, then kept by input handlers). */
export function value<T, P extends FieldPath<T>>(form: Form<T>, path: P): PathValue<T, P> | undefined {
  const store = storeOf(form);
  return valueSignal(store, absolute(form, path), () => defaultValue(form, path))() as PathValue<T, P> | undefined;
}
/** The field's value differs from its default (needs `value` updates: browser only); without a path, any field. */
export function dirty<T>(form: Form<T>, path?: FieldPath<T>): boolean {
  const store = storeOf(form);
  (store.d ??= signal(0))();
  if (typeof document === "undefined") return false;
  const element = document.getElementById(store.i) as HTMLFormElement | null;
  if (!element) return false;
  const prefix = absolute(form, path ?? "");
  for (const control of Array.from(element.elements)) {
    const name = (control as HTMLInputElement).name;
    if (!name || (path !== undefined ? name !== prefix : !name.startsWith(prefix))) continue;
    if (changed(control)) return true;
  }
  return false;
}
function changed(control: Element): boolean {
  if (control instanceof HTMLInputElement) {
    if (control.type === "checkbox" || control.type === "radio") return control.checked !== control.defaultChecked;
    if (control.type === "file") return (control.files?.length ?? 0) > 0;
    return control.value !== control.defaultValue;
  }
  if (control instanceof HTMLTextAreaElement) return control.value !== control.defaultValue;
  if (control instanceof HTMLSelectElement) return Array.from(control.options).some((option) => option.selected !== option.defaultSelected);
  return false;
}

// --- ids (stable across server and browser) -------------------------------------------------

/** `id` of the form. */
export const formId = <T>(form: Form<T>): string => storeOf(form).i;
/** `name` attribute for a (scoped) path: typed, returns the absolute dotted path. */
export const path = <T, P extends FieldPath<T>>(form: Form<T>, name: P): string => absolute(form, name);
/** `id` of a field's input, unique per form. */
export const fieldId = <T, P extends FieldPath<T>>(form: Form<T>, name: P): string => storeOf(form).i + "-" + idSafe(absolute(form, name));
/** `id` of a field's error element (for `aria-describedby` / `aria-errormessage`). */
export const errorId = <T, P extends FieldPath<T>>(form: Form<T>, name: P): string => fieldId(form, name) + "-error";
/** `id` of a field's description element (for `aria-describedby`). */
export const descriptionId = <T, P extends FieldPath<T>>(form: Form<T>, name: P): string => fieldId(form, name) + "-desc";
/** `id` of the form's error summary element. */
export const summaryId = <T>(form: Form<T>): string => storeOf(form).i + "-summary";
/** `aria-describedby`: description id (when `description`) + error id only while issues show. */
export function describedBy<T, P extends FieldPath<T>>(form: Form<T>, name: P, options: { description?: boolean } = {}): string | undefined {
  const ids: string[] = [];
  if (options.description) ids.push(descriptionId(form, name));
  if (issueSignal(storeOf(form), absolute(form, name))()) ids.push(errorId(form, name));
  return ids.length ? ids.join(" ") : undefined;
}
