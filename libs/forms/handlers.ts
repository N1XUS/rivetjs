// Delegated handlers for `<form>`: `onInput` (input + change), `onBlur` (focusout), `onSubmit`, `onInvalid`.
// One small chunk regardless of field count; values are read from the DOM when needed.
import type { FormDefinition } from "./define.ts";
import { fieldOf, focusInvalid, formData, formOf, owns, readValue } from "./dom.ts";
import { trigger, validateAll } from "./engine.ts";
import { ENHANCED, hasBit, setBit, storeOf, SUBMITTED, touchedSignal, writeFormIssues, type Form, type FormStore } from "./store.ts";

/** First handler run in the browser: library messages and focus replace native validation bubbles. */
function activate(store: FormStore<any>, element: HTMLFormElement): void {
  if (hasBit(store, ENHANCED)) return;
  setBit(store, ENHANCED, true);
  element.noValidate = true;
}
const target = (form: Form<any>, event: Event): [FormStore<any>, HTMLFormElement] | null => {
  const store = storeOf(form);
  const element = formOf(event);
  return element && owns(store, element) ? [store, element] : null;
};

/** `onInput` / `onChange` on the `<form>`: keeps bound values current and validates per timing. */
export function onInput(def: FormDefinition<any>, form: Form<any>, event: Event): void {
  const hit = target(form, event);
  const path = hit && fieldOf(event);
  if (!hit || !path) return;
  const [store, element] = hit;
  activate(store, element);
  store.v?.[path]?.set(readValue(element, (event.target as HTMLInputElement).name));
  store.d?.update((n) => n + 1);
  trigger(def, store, element, path, event.type === "change" ? "change" : "input", () => formData(element));
}
/** `onChange` on the `<form>`: same as `onInput` (validates per the `change` timing). */
export const onChange = onInput;

/** `onFocusOut` on the `<form>`: marks the field touched and validates per timing. */
export function onBlur(def: FormDefinition<any>, form: Form<any>, event: Event): void {
  const hit = target(form, event);
  const path = hit && fieldOf(event);
  if (!hit || !path) return;
  const [store, element] = hit;
  // Leaving one control of a radio/checkbox group for another is not a blur of the field.
  const next = (event as FocusEvent).relatedTarget as HTMLInputElement | null;
  if (next && next.form === element && next.name === (event.target as HTMLInputElement).name) return;
  activate(store, element);
  touchedSignal(store, path).set(true);
  trigger(def, store, element, path, "blur", () => formData(element));
}

const resubmitting = new WeakSet<HTMLFormElement>();
/**
 * `onSubmit` on the `<form>`: validates everything (field checks awaited), focuses the first invalid
 * field, else submits with fetch (`enhance: false`: natively). Resolves when the submit settles:
 * `true` when the server accepted it and the page is fresh (revalidated in place / redirect served) —
 * e.g. `if (await onSubmit(def, form, event)) open.set(false)` closes the drawer the form lives in.
 */
export function onSubmit(def: FormDefinition<any>, form: Form<any>, event: Event): Promise<boolean> | undefined {
  const hit = target(form, event);
  if (!hit) return undefined;
  const [store, element] = hit;
  if (resubmitting.delete(element)) return undefined; // our own native resubmission
  activate(store, element);
  event.preventDefault();
  const submitter = (event as SubmitEvent).submitter ?? null;
  // Field-array intent buttons (`insert:items`): applied in the browser, no submit.
  const intent = submitter?.getAttribute("name") === "_intent" ? (submitter as HTMLButtonElement).value : "";
  if (/^(insert|remove|move|swap):/.test(intent)) return import("./array.ts").then(({ applyArrayIntent }) => (applyArrayIntent(store, intent), false));
  return submit(def, store, element, submitter);
}

const reporting = new WeakSet<HTMLFormElement>();
/**
 * `onInvalidCapture` on the `<form>` (`invalid` does not bubble): native constraint validation
 * (`required`, `type="email"`… kept for no-JS posts) stopped a submit before `onSubmit` ran — the first
 * submit of a resumed page none of whose form handlers ran yet. Turns native validation off and reports
 * with library messages + focus instead of bubbles, once per validation pass. It never submits (the
 * event may come from a `checkValidity()` call): the next submit goes through `onSubmit`.
 */
export function onInvalid(def: FormDefinition<any>, form: Form<any>, event: Event): Promise<void> | undefined {
  const hit = target(form, event);
  if (!hit) return undefined;
  const [store, element] = hit;
  event.preventDefault();
  activate(store, element);
  if (reporting.has(element)) return undefined;
  reporting.add(element);
  setTimeout(() => reporting.delete(element));
  return attempt(def, store, element, formData(element)).then(() => {});
}

/** A submit attempt: counted, every field validated (field checks awaited), first invalid focused. */
async function attempt(def: FormDefinition<any>, store: FormStore<any>, element: HTMLFormElement, data: FormData): Promise<{ ok: boolean; value?: unknown }> {
  store.c.update((n) => n + 1);
  setBit(store, SUBMITTED, true);
  writeFormIssues(store, []);
  const result = await validateAll(def, store, element, data);
  if (!result.ok && def.focusOnInvalid !== false) focusInvalid(store, element);
  return result;
}

async function submit(def: FormDefinition<any>, store: FormStore<any>, element: HTMLFormElement, submitter: HTMLElement | null): Promise<boolean> {
  const data = formData(element, submitter);
  const { ok, value } = await attempt(def, store, element, data);
  if (!ok) return false;
  if (def.enhance === false) {
    resubmitting.add(element);
    element.requestSubmit(submitter as HTMLButtonElement | null);
    return false;
  }
  const { send } = await import("./enhance.ts");
  return send(def, store, element, data, value, submitter);
}
