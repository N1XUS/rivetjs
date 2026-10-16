// Multi-step wizards (`@rivetjs/forms/wizard`): each step is its own `defineForm` (schema per step);
// the wizard holds only the current step, completed steps and the draft id. Routing is the app's:
// `stepFromUrl` / `stepHref` cover the common `?step=` case. Server side: `wizardAction` and
// `loadWizard` in `@rivetjs/forms/server`, persisting step outputs through the app's `DraftStore`.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import type { FormDefinition } from "./define.ts";
import type { StandardSchemaV1 } from "./standard-schema.ts";
import type { InferOutput } from "./types.ts";

/** The app's draft persistence (wizards, autosave). Scope ids to the user/session in `load`/`save`. */
export interface DraftStore<T = unknown> {
  load(id: string, event: unknown): Draft<T> | undefined | Promise<Draft<T> | undefined>;
  /** Merge `patch` into the draft. `version`: the version the client last saw (undefined: new draft). */
  save(id: string, patch: Partial<T>, options: { version?: DraftVersion }, event: unknown): SaveResult<T> | Promise<SaveResult<T>>;
  delete(id: string, event: unknown): void | Promise<void>;
}
/** Version of a stored draft (compared to detect conflicts). */
export type DraftVersion = string | number;
/** A stored draft: its value and version. */
export interface Draft<T = unknown> {
  readonly value: T;
  readonly version: DraftVersion;
}
/** Saved (new version) or a conflict: someone saved a newer version (`value` = theirs). */
export type SaveResult<T = unknown> = { readonly ok: true; readonly version: DraftVersion } | { readonly ok: false; readonly conflict: true; readonly version: DraftVersion; readonly value?: T };

type Steps = readonly FormDefinition<any>[];
/** Merge of every step's output (intersection of step outputs). */
export type WizardValue<S extends Steps> = UnionToIntersection<InferOutput<S[number]>>;
type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

/** A multi-step form: id, ordered step forms and cross-step rules. */
export interface WizardDefinition<S extends Steps = Steps> {
  /** Draft namespace and URL param prefix. */
  readonly id: string;
  readonly steps: S;
  /** Cross-step rules, validated against the merged value before `onComplete`. */
  readonly final?: StandardSchemaV1;
}
/** What a wizard draft stores. */
export interface WizardDraft {
  /** Step outputs by step name. */
  readonly steps: Readonly<Record<string, unknown>>;
  readonly completed: readonly string[];
}

/** Define a wizard at module scope. Step names (definition names) must be unique. */
export function defineWizard<const S extends Steps>(options: { id: string; steps: S; final?: StandardSchemaV1 }): WizardDefinition<S> {
  if (!/^[\w-]+$/.test(options.id)) throw new TypeError(`defineWizard: id must be letters, digits, "_" or "-"`);
  if (!options.steps.length) throw new TypeError("defineWizard: at least one step");
  const names = new Set(options.steps.map((step) => step.name));
  if (names.size !== options.steps.length) throw new TypeError("defineWizard: step names must be unique");
  return Object.freeze({ ...options });
}

/** One rendered wizard (component local; serializable). */
export interface WizardState {
  /** Current step index. */
  readonly s: Signal<number>;
  /** Completed step indices. */
  readonly d: Signal<number[]>;
  /** Draft id (`_draft`), once the server created one. */
  readonly k?: string;
}

/** Wizard state from the page's data (`loadWizard` result) or defaults (in-page wizards). */
export function createWizard(wizard: WizardDefinition<any>, options: { step?: number; completed?: readonly (number | string)[]; draft?: string } = {}): WizardState {
  const completed = (options.completed ?? []).map((entry) => (typeof entry === "number" ? entry : indexOf(wizard, entry))).filter((index) => index >= 0);
  const state: WizardState = { s: signal(clampStep(wizard, options.step ?? 0, completed)), d: signal([...new Set(completed)].sort((a, b) => a - b)) };
  return options.draft ? { ...state, k: options.draft } : state;
}

/** Index of the step named `name`, or -1. */
export const indexOf = (wizard: WizardDefinition<any>, name: string): number => wizard.steps.findIndex((step: FormDefinition<any>) => step.name === name);
/** The furthest step reachable: no skipping past a step that is not completed. */
export function clampStep(wizard: WizardDefinition<any>, index: number, completed: readonly number[]): number {
  const wanted = Math.max(0, Math.min(Math.trunc(index) || 0, wizard.steps.length - 1));
  let reachable = 0;
  while (reachable < wanted && completed.includes(reachable)) reachable++;
  return reachable;
}

/** Current step index (reactive). */
export const step = (state: WizardState): number => state.s();
/** Current step definition (reactive). */
export const currentStep = <S extends Steps>(wizard: WizardDefinition<S>, state: WizardState): S[number] => wizard.steps[state.s()]!;
/** Whether the step at `index` is completed (reactive). */
export const isComplete = (state: WizardState, index: number): boolean => state.d().includes(index);
/** Whether the current step is the first one (reactive). */
export const isFirst = (state: WizardState): boolean => state.s() === 0;
/** Whether the current step is the last one (reactive). */
export const isLast = (wizard: WizardDefinition<any>, state: WizardState): boolean => state.s() === wizard.steps.length - 1;
/** Draft id of the wizard state, when it has one. */
export const draftId = (state: WizardState): string | undefined => state.k;

/** Mark the current step completed and advance (in-page wizards; validate the step first). */
export function next(wizard: WizardDefinition<any>, state: WizardState): void {
  const current = untrack(state.s);
  const done = untrack(state.d);
  if (!done.includes(current)) state.d.set([...done, current].sort((a, b) => a - b));
  if (current < wizard.steps.length - 1) state.s.set(current + 1);
}
/** Go to the previous step. */
export function back(state: WizardState): void {
  const current = untrack(state.s);
  if (current > 0) state.s.set(current - 1);
}
/** Go to `index` if reachable (every earlier step completed); returns whether it moved. */
export function goTo(wizard: WizardDefinition<any>, state: WizardState, index: number): boolean {
  const target = clampStep(wizard, index, untrack(state.d));
  if (target !== index) return false;
  state.s.set(index);
  return true;
}

/** Step index from `?<param>=<step name>` (default param `step`); 0 when absent or unknown. */
export function stepFromUrl(wizard: WizardDefinition<any>, url: URL | string, param = "step"): number {
  const name = new URL(url, "http://rivet.invalid").searchParams.get(param);
  const index = name === null ? 0 : indexOf(wizard, name);
  return index < 0 ? 0 : index;
}
/** Same path with `?<param>=<step name>` (and `draft` when given); other params kept. */
export function stepHref(wizard: WizardDefinition<any>, url: URL | string, index: number, options: { param?: string; draft?: string } = {}): string {
  const target = new URL(url, "http://rivet.invalid");
  target.searchParams.set(options.param ?? "step", wizard.steps[Math.max(0, Math.min(index, wizard.steps.length - 1))]!.name);
  if (options.draft) target.searchParams.set("draft", options.draft);
  return target.pathname + target.search + target.hash;
}
