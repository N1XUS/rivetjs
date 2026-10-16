// Imperative store operations: custom widgets (`setValue`), server-driven errors (`setIssues`),
// clearing and resetting.
import { signal, untrack } from "@rivetjs/reactivity";
import type { FormDefinition } from "./define.ts";
import { elementOf, formData } from "./dom.ts";
import { trigger } from "./engine.ts";
import { toIssues } from "./issues.ts";
import { absolute, arm, prefixOf, runtime, setBit, storeOf, SUBMITTED, writeFormIssues, writeIssues, type Form } from "./store.ts";
import type { FieldPath, IssueLike, PathValue } from "./types.ts";

/** Write a value into the field's control(s) and the store (custom widgets), then validate as input. */
export function setValue<T, P extends FieldPath<T>>(def: FormDefinition<any>, form: Form<T>, path: P, next: PathValue<T, P>): void {
  const store = storeOf(form);
  const name = absolute(form, path);
  const element = elementOf(store);
  if (element) writeControl(element, name, next);
  const values = (store.v ??= {});
  if (values[name]) values[name].set(next);
  else values[name] = signal<unknown>(next);
  store.d?.update((n) => n + 1);
  if (element) trigger(def, store, element, name, "input", () => formData(element));
}
function writeControl(element: HTMLFormElement, name: string, next: unknown): void {
  const item = element.elements.namedItem(name);
  if (!item) return;
  const values = Array.isArray(next) ? next.map(String) : [String(next ?? "")];
  const controls = (typeof RadioNodeList !== "undefined" && item instanceof RadioNodeList ? Array.from(item) : [item]) as HTMLInputElement[];
  for (const control of controls) {
    if (control.type === "checkbox" || control.type === "radio")
      control.checked = typeof next === "boolean" ? next : values.includes(control.value);
    else if (typeof HTMLSelectElement !== "undefined" && control instanceof HTMLSelectElement && control.multiple) for (const option of Array.from(control.options)) option.selected = values.includes(option.value);
    else if (control.type !== "file") control.value = values[0] ?? "";
  }
}

/** Show issues from outside the schema (e.g. a backend reply): field paths relative to the view; `""` = form-level. */
export function setIssues<T>(form: Form<T>, issues: Partial<Record<FieldPath<T> | "", IssueLike | readonly IssueLike[]>>): void {
  const store = storeOf(form);
  for (const path in issues) {
    const list = toIssues(issues[path as keyof typeof issues] as IssueLike | readonly IssueLike[]);
    if (path === "" && !prefixOf(form)) {
      writeFormIssues(store, list);
      continue;
    }
    const name = absolute(form, path);
    arm(store, name);
    writeIssues(store, name, list);
  }
}
/** Clear shown issues of one field, or of every field under the form/view (and form issues for a store). */
export function clearIssues<T>(form: Form<T>, path?: FieldPath<T>): void {
  const store = storeOf(form);
  if (path !== undefined) return void writeIssues(store, absolute(form, path), undefined);
  const prefix = prefixOf(form);
  for (const name in store.f) if (name.startsWith(prefix)) writeIssues(store, name, undefined);
  if (!prefix) writeFormIssues(store, []);
}

/** Restore DOM defaults (`form.reset()`), clear issues, touched and submitted state. */
export function reset<T>(form: Form<T>): void {
  const store = storeOf(form);
  const element = elementOf(store);
  element?.reset();
  const state = runtime(store);
  for (const controller of state.aborts.values()) controller.abort();
  for (const timer of state.timers.values()) clearTimeout(timer);
  state.aborts.clear();
  state.timers.clear();
  state.checks.clear();
  state.schema = {};
  state.generation++;
  state.armed.clear();
  for (const name in store.f) writeIssues(store, name, undefined);
  for (const name in store.t ?? {}) if (untrack(store.t![name]!)) store.t![name]!.set(false);
  writeFormIssues(store, []);
  setBit(store, SUBMITTED, false);
  delete store.x;
  if (element) for (const name in store.v ?? {}) store.v![name]!.set(readDefault(element, name));
  store.d?.update((n) => n + 1);
}
const readDefault = (element: HTMLFormElement, name: string): unknown => {
  const item = element.elements.namedItem(name) as HTMLInputElement | null;
  return item && "value" in item ? (item.type === "checkbox" ? item.checked : item.value) : undefined;
};
