// Enhanced submit (fetch), loaded by `onSubmit` on the first valid submit: POST with the browser's
// encoding, then follow the redirect, show server issues, or keep the success result (and revalidate
// the page from the answer's fresh route data).
import { signal } from "@rivetjs/reactivity";
import type { FormDefinition } from "./define.ts";
import { focusInvalid } from "./dom.ts";
import { reset } from "./mutate.ts";
import { clearPrefetch, invalidate } from "./router.ts";
import { arm, runtime, setBit, SUBMITTING, writeFormIssues, writeIssues, type FormReply, type FormStore } from "./store.ts";
import { follow, post } from "./transport.ts";
import type { Issue } from "./types.ts";

const isReply = (value: unknown): value is FormReply => typeof value === "object" && value !== null && typeof (value as FormReply).ok === "boolean";

/**
 * Send the validated form (`def.submit`: through it instead); a second submit aborts the first.
 * Resolves `true` once the server accepted it (after the page revalidated / the redirect was served),
 * `false` for issues, failures and aborted submits.
 */
export async function send(
  def: FormDefinition<any>,
  store: FormStore<any>,
  element: HTMLFormElement,
  data: FormData,
  value?: unknown,
  submitter?: HTMLElement | null,
): Promise<boolean> {
  // Custom transport: its own chunk, reached through this one (shares `reset`, no extra chunk for plain forms).
  if (def.submit) return (await import("./submit.ts")).send(def, store, element, data, value, submitter);
  const state = runtime(store);
  state.submit?.abort();
  const controller = new AbortController();
  state.submit = controller;
  setBit(store, SUBMITTING, true);
  try {
    const fresh = def.revalidate !== false;
    const { status, answer } = await post(element, data, controller.signal, fresh);
    // The action may have changed what loaders return: drop route data warmed meanwhile.
    clearPrefetch();
    if (controller.signal.aborted) return false;
    if (answer.redirect !== undefined) return (await follow(answer.redirect, answer), true);
    if (answer.error) {
      const failure: Issue = {
        key: status >= 500 ? "errors.server" : "errors.request",
        message: answer.error.message,
        params: { status: answer.error.status },
      };
      writeFormIssues(store, [failure]);
      return false;
    }
    const result = answer.action?.result;
    if (isReply(result) && !result.ok) {
      const issues = result.issues ?? {};
      for (const path in issues) arm(store, path);
      for (const path of new Set([...Object.keys(issues), ...Object.keys(store.f)])) writeIssues(store, path, issues[path]);
      writeFormIssues(store, result.form ?? []);
      if (def.focusOnInvalid !== false) focusInvalid(store, element);
      return false;
    }
    if (def.resetOnSuccess !== false) reset(store);
    (store.r ??= signal<unknown>(undefined)).set(isReply(result) ? result.data : result);
    // Same page, changed server state: fresh data from the answer (else one data request) — a live
    // page updates in place, others re-render.
    if (fresh)
      await invalidate(
        answer.data ? { data: answer.data, ...(answer.head ? { head: answer.head } : {}), ...(answer.deps ? { deps: answer.deps } : {}) } : undefined,
      );
    return true;
  } catch (error) {
    if (controller.signal.aborted) return false;
    writeFormIssues(store, [{ key: "errors.network", message: error instanceof Error ? error.message : String(error) }]);
    return false;
  } finally {
    if (state.submit === controller) {
      state.submit = undefined;
      setBit(store, SUBMITTING, false);
    }
  }
}
