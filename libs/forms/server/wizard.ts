// Server half of wizards: one router action per step (`wizardAction`) saving the step output into
// the app's DraftStore, then redirecting to the next step (303, no JS; JSON redirect, enhanced);
// the last step merges every output, checks `final`, and calls `onComplete`. `loadWizard` gives the
// page its step, completed steps, draft id and saved values.
import { HttpError, redirect, type RequestEvent } from "@rivetjs/router";
import type { FormDefinition } from "../define.ts";
import { mapSchemaIssues } from "../issues.ts";
import type { Issue } from "../types.ts";
import { clampStep, indexOf, stepHref, type DraftStore, type WizardDefinition, type WizardDraft, type WizardValue } from "../wizard.ts";
import { action, invalid, type ActionOptions } from "./action.ts";

const DRAFT = /^[\w-]{8,64}$/;
/** Options of the server wizard action: step param, completion and per-step callbacks. */
export interface WizardOptions<S extends readonly FormDefinition<any>[]> {
  /** Step query param (default `step`). */
  param?: string;
  /** After every step is valid and `final` passed: persist, then usually `redirect(...)`. The draft is deleted afterwards. */
  onComplete: (value: WizardValue<S>, event: RequestEvent, context: { draft: string }) => unknown;
  /** After a step's output is saved (not the last step). */
  onStep?: (name: string, value: unknown, event: RequestEvent, context: { draft: string }) => unknown;
  /** Passed to each step's `action()` (CSRF mode, limits, checks). */
  action?: ActionOptions;
}

/** Draft id: the form's `_draft`, else `?draft=`; undefined when absent or malformed. */
export function draftFrom(event: RequestEvent, data?: FormData): string | undefined {
  const posted = data?.get("_draft");
  const id = typeof posted === "string" && posted ? posted : event.url.searchParams.get("draft");
  return id && DRAFT.test(id) ? id : undefined;
}
/** The page URL without the `?/action` key. */
function pageUrl(event: RequestEvent): URL {
  const url = new URL(event.url);
  for (const key of [...url.searchParams.keys()]) if (key.startsWith("/")) url.searchParams.delete(key);
  return url;
}
const completedIndices = (wizard: WizardDefinition<any>, draft: WizardDraft | undefined) =>
  (draft?.completed ?? []).map((name) => indexOf(wizard, name)).filter((index) => index >= 0);

/** Router actions for every step, keyed by step name: `export const serverActions = wizardAction(...)`. */
export function wizardAction<S extends readonly FormDefinition<any>[]>(wizard: WizardDefinition<S>, drafts: DraftStore<WizardDraft>, options: WizardOptions<S>): Record<string, (event: RequestEvent) => Promise<unknown>> {
  const out: Record<string, (event: RequestEvent) => Promise<unknown>> = {};
  wizard.steps.forEach((definition: FormDefinition<any>, index: number) => {
    out[definition.name] = action(
      definition,
      async (value, event, context) => {
        const id = draftFrom(event, context.data) ?? crypto.randomUUID();
        const loaded = await drafts.load(id, event);
        const done = completedIndices(wizard, loaded?.value);
        const url = pageUrl(event);
        // No skipping: an earlier step without saved output sends the user back to it.
        const reachable = clampStep(wizard, index, done);
        if (reachable < index) return redirect(stepHref(wizard, url, reachable, { param: options.param, draft: id }));
        const steps = { ...loaded?.value.steps, [definition.name]: value };
        const completed = [...new Set([...(loaded?.value.completed ?? []), definition.name])];
        const saved = await drafts.save(id, { steps, completed }, loaded ? { version: loaded.version } : {}, event);
        if (!saved.ok) return invalid({}, { key: "errors.conflict" }, 409);
        if (index < wizard.steps.length - 1) {
          await options.onStep?.(definition.name, value, event, { draft: id });
          return redirect(stepHref(wizard, url, index + 1, { param: options.param, draft: id }));
        }
        const merged: Record<string, unknown> = {};
        for (const step of wizard.steps as readonly FormDefinition<any>[]) Object.assign(merged, steps[step.name] as object);
        let final: unknown = merged;
        if (wizard.final) {
          const result = await wizard.final["~standard"].validate(merged);
          if (result.issues) {
            const map = mapSchemaIssues(result.issues);
            const form: Issue[] = [...map.form, ...Object.values(map.fields).flat()];
            return invalid({}, form);
          }
          final = result.value;
        }
        const answer = await options.onComplete(final as WizardValue<S>, event, { draft: id });
        await drafts.delete(id, event);
        return answer;
      },
      options.action,
    );
  });
  return out;
}

/** A wizard's state loaded on the server: current step, completed steps, draft id and saved values. */
export interface LoadedWizard {
  /** Current step (the `?step=` request clamped to the furthest reachable step). */
  readonly step: number;
  readonly completed: readonly string[];
  readonly draft?: string;
  /** Saved outputs by step name (initial values when revisiting a step). */
  readonly values: Readonly<Record<string, unknown>>;
}
/** For the page's `serverLoad`: the draft named by `?draft=` (unknown ids start over). */
export async function loadWizard(wizard: WizardDefinition<any>, drafts: DraftStore<WizardDraft>, event: RequestEvent, options: { param?: string } = {}): Promise<LoadedWizard> {
  const id = draftFrom(event);
  const loaded = id ? await drafts.load(id, event) : undefined;
  const done = completedIndices(wizard, loaded?.value);
  const name = event.url.searchParams.get(options.param ?? "step");
  const wanted = name === null ? 0 : Math.max(0, indexOf(wizard, name));
  const step = clampStep(wizard, wanted, done);
  if (id && !loaded && wanted > 0) throw new HttpError(404, "Draft not found");
  return { step, completed: loaded?.value.completed ?? [], ...(loaded && id ? { draft: id } : {}), values: loaded?.value.steps ?? {} };
}
