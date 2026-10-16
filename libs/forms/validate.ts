// Imperative validation (e.g. before a custom submit): shows every issue, returns typed output.
import type { FormDefinition } from "./define.ts";
import { elementOf, formData } from "./dom.ts";
import { validateAll } from "./engine.ts";
import { storeOf, type Form } from "./store.ts";
import type { InferInput, InferOutput } from "./types.ts";

/** Result of `validate()`: the typed value, or `ok: false` with the issues shown on the form. */
export type ValidateResult<D> = { readonly ok: true; readonly value: InferOutput<D> } | { readonly ok: false };

/** Validate the whole form now (field checks included) and show all issues. */
export async function validate<D extends FormDefinition<any>>(def: D, form: Form<InferInput<D>>, data?: FormData): Promise<ValidateResult<D>> {
  const store = storeOf(form);
  const element = elementOf(store);
  const result = await validateAll(def, store, element, data ?? (element ? formData(element) : new FormData()));
  return result.ok ? { ok: true, value: result.value as InferOutput<D> } : { ok: false };
}
