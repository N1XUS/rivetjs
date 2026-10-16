// Development façade of `@rivetjs/forms` (`development` export condition: Vite dev, never a production
// build). Same exports; with a devtools hook installed every `createForm` store is reported
// (`lib.form`) with its creating owner and a describer the DevTools Forms pane reads: values (the
// form's FormData), shown issues, touched and dirty fields, submit state. Reads are untracked and never
// create the lazy per-field signals.
import { getOwner, untrack } from "@rivetjs/reactivity";
import { devtoolsHook } from "@rivetjs/reactivity/debug";
import * as forms from "./index.ts";
import { SUBMITTED, SUBMITTING, VALIDATING, ENHANCED, type FormStore } from "./store.ts";
import type { FormDefinition } from "./define.ts";
import type { InferInput, Issue } from "./types.ts";
export * from "./index.ts";

/** What the DevTools Forms pane shows for one store. */
export interface FormSnapshot {
  id: string;
  name: string;
  mounted: boolean;
  values: Record<string, string | string[]>;
  errors: Record<string, Issue[]>;
  formErrors: Issue[];
  touched: string[];
  dirty: string[];
  submitting: boolean;
  submitted: boolean;
  validating: boolean;
  enhanced: boolean;
  submitCount: number;
  result?: unknown;
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

/** A store's current state, read without tracking or creating field signals (password values masked). */
function describeForm(store: FormStore<any>): FormSnapshot {
  return untrack(() => {
    const element = typeof document === "undefined" ? null : (document.getElementById(store.i) as HTMLFormElement | null);
    const values: Record<string, string | string[]> = {};
    const dirty = new Set<string>();
    if (element instanceof HTMLFormElement) {
      // Password fields (and names like autosave's default exclusions) are masked.
      const secret = new Set(Array.from(element.elements).flatMap((control) => ((control as HTMLInputElement).type === "password" ? [(control as HTMLInputElement).name] : [])));
      for (const [name, entry] of new FormData(element)) {
        if (name.startsWith("_") || typeof entry !== "string") continue;
        const value = secret.has(name) || /password|secret/i.test(name) ? (entry ? "••••••" : "") : entry;
        const existing = values[name];
        values[name] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
      }
      for (const control of Array.from(element.elements)) {
        const name = (control as HTMLInputElement).name;
        if (name && !name.startsWith("_") && changed(control)) dirty.add(name);
      }
    }
    const errors: Record<string, Issue[]> = {};
    for (const path in store.f) {
      const shown = store.f[path]!();
      if (shown) errors[path] = shown;
    }
    const touched = Object.keys(store.t ?? {}).filter((path) => store.t![path]!());
    const st = store.st();
    return {
      id: store.i,
      name: store.n,
      mounted: element instanceof HTMLFormElement && element.isConnected,
      values,
      errors,
      formErrors: store.fe(),
      touched,
      dirty: [...dirty],
      submitting: (st & SUBMITTING) !== 0,
      submitted: (st & SUBMITTED) !== 0,
      validating: (st & VALIDATING) !== 0,
      enhanced: (st & ENHANCED) !== 0,
      submitCount: store.c(),
      ...(store.r ? { result: store.r() } : {}),
    };
  });
}

/** `createForm`, reporting the store (`lib.form { store, owner, describe }`). */
export function createForm<D extends FormDefinition<any>>(def: D, options?: forms.CreateFormOptions<InferInput<D>>): FormStore<InferInput<D>> {
  const store = forms.createForm(def, options);
  const hook = devtoolsHook();
  if (hook !== undefined) hook.emit("lib.form", { store, owner: getOwner(), describe: () => describeForm(store) });
  return store;
}
