// DOM access: the form element owns field values; these read them on demand.
import { untrack } from "@rivetjs/reactivity";
import { canonicalName } from "./path.ts";
import { storeOf, type Form, type FormStore } from "./store.ts";

/** The `<form>` an event belongs to (delegated handlers: `currentTarget` may be the document). */
export function formOf(event: Event): HTMLFormElement | null {
  const target = event.target as (Element & { form?: HTMLFormElement | null }) | null;
  if (!target || typeof (target as Element).closest !== "function") return null;
  if (target.tagName === "FORM") return target as HTMLFormElement;
  return target.form ?? (target as Element).closest("form");
}
/** Canonical field path of an event's target (`items[0][sku]` → `items.0.sku`), or null. */
export function fieldOf(event: Event): string | null {
  const name = (event.target as HTMLInputElement | null)?.name;
  return typeof name === "string" && name ? canonicalName(name) : null;
}
/** Whether a form element belongs to this store (forms without an id accept any store). */
export const owns = (store: FormStore<any>, element: HTMLFormElement): boolean => {
  // Named controls shadow HTMLFormElement properties: <input name="id"> replaces element.id.
  const id = element.getAttribute("id");
  return !id || id === store.i;
};
/** The store's `<form id>` in the document. */
export const elementOf = (store: FormStore<any>): HTMLFormElement | null =>
  typeof document === "undefined" ? null : (document.getElementById(store.i) as HTMLFormElement | null);

/** FormData of the form, including the submitter's name/value. */
export function formData(element: HTMLFormElement, submitter?: HTMLElement | null): FormData {
  try {
    return new FormData(element, submitter ?? null);
  } catch {
    // Older engines: no submitter argument (or a submitter of another form).
    const data = new FormData(element);
    const button = submitter as HTMLButtonElement | null | undefined;
    if (button?.name) data.append(button.name, button.value);
    return data;
  }
}

/** Typed value of a named control: number inputs as numbers, checkbox groups as arrays, files as FileList. */
export function readValue(element: HTMLFormElement, name: string): unknown {
  const item = element.elements.namedItem(name);
  if (!item) return undefined;
  if (typeof RadioNodeList !== "undefined" && item instanceof RadioNodeList) {
    const controls = Array.from(item) as HTMLInputElement[];
    if (controls.every((c) => c.type === "radio")) return item.value || undefined;
    return controls.filter((c) => c.checked).map((c) => c.value);
  }
  if (item instanceof HTMLInputElement) {
    if (item.type === "checkbox") return item.checked;
    if (item.type === "radio") return item.checked ? item.value : undefined;
    if (item.type === "file") return item.files;
    if (item.type === "number" || item.type === "range") return Number.isNaN(item.valueAsNumber) ? undefined : item.valueAsNumber;
    return item.value;
  }
  if (item instanceof HTMLSelectElement && item.multiple) return Array.from(item.selectedOptions, (option) => option.value);
  return (item as HTMLInputElement).value;
}

/**
 * Focus (and scroll to) the first control, in DOM order, whose field shows issues; else the error
 * summary. `element` defaults to the form's `<form id>`. False when nothing was focused.
 */
export function focusFirstInvalid(form: Form<any>, element?: HTMLFormElement | null): boolean {
  const store = storeOf(form);
  const target = element ?? elementOf(store);
  return target ? focusInvalid(store, target) : false;
}
export function focusInvalid(store: FormStore<any>, element: HTMLFormElement): boolean {
  for (const control of Array.from(element.elements) as HTMLElement[]) {
    const name = (control as HTMLInputElement).name;
    if (!name) continue;
    const field = store.f[canonicalName(name) ?? ""];
    if (field && untrack(field)) return focus(control);
  }
  const summary = document.getElementById(store.i + "-summary");
  return summary ? focus(summary) : false;
}
function focus(control: HTMLElement): boolean {
  control.focus({ preventScroll: true });
  control.scrollIntoView?.({ block: "center" });
  return true;
}
