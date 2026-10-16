// Custom submit (`defineForm({ submit })`): `enhance.ts` hands over to this chunk on a valid submit
// instead of fetching the router action. Runs the definition's transport with the validated value,
// then shows its issues or keeps its success result.
import { signal } from "@rivetjs/reactivity";
import type { FormDefinition, SubmitFailure } from "./define.ts";
import { focusInvalid } from "./dom.ts";
import { toIssues } from "./issues.ts";
import { reset } from "./mutate.ts";
import { arm, runtime, setBit, SUBMITTING, writeFormIssues, writeIssues, type FormStore } from "./store.ts";

const isAnswer = (value: unknown): value is { ok: boolean; data?: unknown } =>
  typeof value === "object" && value !== null && typeof (value as { ok?: unknown }).ok === "boolean";

/** Run `def.submit` for a validated form; a second submit aborts the first. `true`: it succeeded. */
export async function send(
  def: FormDefinition<any>,
  store: FormStore<any>,
  element: HTMLFormElement,
  data: FormData,
  value: unknown,
  submitter?: HTMLElement | null,
): Promise<boolean> {
  const state = runtime(store);
  state.submit?.abort();
  const controller = new AbortController();
  state.submit = controller;
  setBit(store, SUBMITTING, true);
  try {
    const result = await def.submit!(value, { formData: data, element, signal: controller.signal, submitter: submitter ?? null, form: store });
    if (controller.signal.aborted) return false;
    if (isAnswer(result) && !result.ok) {
      const issues = (result as SubmitFailure).issues ?? {};
      for (const path in issues) arm(store, path);
      for (const path of new Set([...Object.keys(issues), ...Object.keys(store.f)])) writeIssues(store, path, toIssues(issues[path]));
      writeFormIssues(store, toIssues((result as SubmitFailure).form));
      if (def.focusOnInvalid !== false) focusInvalid(store, element);
      return false;
    }
    if (def.resetOnSuccess !== false) reset(store);
    (store.r ??= signal<unknown>(undefined)).set(isAnswer(result) ? result.data : result);
    return true;
  } catch (error) {
    if (controller.signal.aborted) return false;
    writeFormIssues(store, [{ key: "errors.submit", message: error instanceof Error ? error.message : String(error) }]);
    return false;
  } finally {
    if (state.submit === controller) {
      state.submit = undefined;
      setBit(store, SUBMITTING, false);
    }
  }
}
