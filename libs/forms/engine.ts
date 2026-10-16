// Validation engine: whole-schema runs (cross-field rules revalidate dependents for free), writes
// filtered to armed fields, timing (validateOn / revalidateOn), debounced abortable field checks.
import { signal, untrack } from "@rivetjs/reactivity";
import type { FieldConfig, FormDefinition, RevalidateOn, ValidateOn } from "./define.ts";
import { decodeFormData } from "./decode.ts";
import { mapSchemaIssues, toIssues, type IssueMap } from "./issues.ts";
import { byPattern, canonicalName, getAt } from "./path.ts";
import { anyArmed, arm, hasBit, isArmed, runtime, setBit, SUBMITTED, VALIDATING, validatingSignal, writeFormIssues, writeIssues, type FormStore } from "./store.ts";
import type { Issue } from "./types.ts";

export type Trigger = "input" | "change" | "blur";
type MaybePromise<T> = T | Promise<T>;

/** Decode FormData into schema input with the definition's coercion. */
export const decodeWith = (def: FormDefinition<any>, data: Iterable<[string, FormDataEntryValue]>): Record<string, unknown> =>
  decodeFormData(data, { coerce: def.coerce, emptyAs: def.emptyAs });

/** Run the schema; issues grouped by path. */
export function runSchema(def: FormDefinition<any>, input: unknown): MaybePromise<{ value?: unknown; issues: IssueMap }> {
  const result = def.schema["~standard"].validate(input);
  const map = (r: { value?: unknown; issues?: readonly unknown[] | undefined }) =>
    r.issues ? { issues: mapSchemaIssues(r.issues as never) } : { value: r.value, issues: { fields: {}, form: [] } };
  return result instanceof Promise ? result.then(map) : map(result);
}

const firstTime = (mode: ValidateOn, kind: Trigger) => (mode === "input" ? kind !== "blur" : mode === kind);
const again = (mode: RevalidateOn, kind: Trigger) => (mode === "input" ? kind !== "blur" : mode === kind);
const showsAll = (def: FormDefinition<any>, store: FormStore<any>) => def.showIssues === "always" || hasBit(store, SUBMITTED);

/** Shown issues for a path: schema issues, then field-check issues. */
function combined(store: FormStore<any>, path: string): Issue[] {
  const state = runtime(store);
  return [...(state.schema[path] ?? []), ...(state.checks.get(path) ?? [])];
}

/**
 * Store the latest schema issues and write them to armed fields (every field when `all`, arming
 * them). Root issues show after a submit.
 */
export function applyIssues(def: FormDefinition<any>, store: FormStore<any>, map: IssueMap, all: boolean): void {
  const state = runtime(store);
  const previous = state.schema;
  state.schema = map.fields;
  // Field checks for paths that now fail the schema are moot.
  for (const path in map.fields) state.checks.delete(path);
  const everything = all || showsAll(def, store);
  const paths = new Set([...Object.keys(map.fields), ...Object.keys(previous), ...Object.keys(store.f)]);
  for (const path of paths) {
    if (!everything && !isArmed(store, path)) continue;
    if (!store.f[path] && !map.fields[path]) continue;
    if (all && map.fields[path]) arm(store, path);
    writeIssues(store, path, combined(store, path));
  }
  if (all || hasBit(store, SUBMITTED)) writeFormIssues(store, map.form);
}

/** Validate after an input/change/blur on `path` per the definition's timing. */
export function trigger(def: FormDefinition<any>, store: FormStore<any>, element: HTMLFormElement, path: string, kind: Trigger, data: () => FormData): void {
  if (isArmed(store, path) || showsAll(def, store)) {
    if (!again(def.revalidateOn ?? "input", kind)) return;
  } else if (firstTime(def.validateOn ?? "submit", kind)) arm(store, path);
  // A pristine field's input still revalidates armed dependents (cross-field rules: confirm ← password).
  else if (!again(def.revalidateOn ?? "input", kind) || !anyArmed(store)) return;
  const input = decodeWith(def, data());
  const state = runtime(store);
  const generation = ++state.generation;
  const result = runSchema(def, input);
  const done = (outcome: { issues: IssueMap }) => {
    if (generation !== state.generation) return; // superseded by a newer run
    applyIssues(def, store, outcome.issues, false);
    if (isArmed(store, path) && !outcome.issues.fields[path]) void check(def, store, element, path, input, kind === "blur" ? 0 : undefined);
  };
  if (result instanceof Promise) {
    pending(store, 1);
    result.then(done).finally(() => pending(store, -1));
  } else done(result);
}

/** Count async work; the VALIDATING bit is on while any runs. */
function pending(store: FormStore<any>, delta: number): void {
  const state = runtime(store);
  state.busy += delta;
  setBit(store, VALIDATING, state.busy > 0);
}

/**
 * Run the field check configured for `path` (debounced unless `delay` is 0; a newer call aborts the
 * older). Resolves once settled or superseded; undefined when the path has no check.
 */
export function check(def: FormDefinition<any>, store: FormStore<any>, element: HTMLFormElement | null, path: string, values: unknown, delay?: number): Promise<void> | undefined {
  const config = byPattern<FieldConfig | undefined>(def.fields, path);
  if (!config || (!config.validate && !config.remote)) return undefined;
  const state = runtime(store);
  state.aborts.get(path)?.abort();
  clearTimeout(state.timers.get(path));
  const controller = new AbortController();
  state.aborts.set(path, controller);
  const wait = delay ?? config.debounce ?? (config.remote ? 300 : 0);
  const busy = validatingSignal(store, path);
  const run = async (): Promise<void> => {
    state.timers.delete(path);
    if (controller.signal.aborted) return;
    busy.set(true);
    pending(store, 1);
    try {
      let result: unknown;
      if (config.validate) result = await config.validate(getAt(values, path), { signal: controller.signal, values, path });
      else if (element) result = await remote(store, element, path, controller.signal);
      if (controller.signal.aborted) return;
      state.checks.set(path, toIssues(result as never));
      if (isArmed(store, path) || showsAll(def, store)) writeIssues(store, path, combined(store, path));
    } catch (error) {
      if (controller.signal.aborted) return;
      state.checks.set(path, [{ key: "errors.check", message: error instanceof Error ? error.message : String(error) }]);
      if (isArmed(store, path) || showsAll(def, store)) writeIssues(store, path, combined(store, path));
    } finally {
      if (state.aborts.get(path) === controller) state.aborts.delete(path);
      if (!state.aborts.has(path)) busy.set(false);
      pending(store, -1);
    }
  };
  const promise = new Promise<void>((resolve) => {
    controller.signal.addEventListener("abort", () => resolve(), { once: true });
    if (wait > 0) state.timers.set(path, setTimeout(() => void run().then(resolve), wait));
    else void run().then(resolve);
  });
  return promise;
}

/** Server field check: POST the form with `_intent=validate:<path>`; the action answers its issues. */
async function remote(store: FormStore<any>, element: HTMLFormElement, path: string, signal: AbortSignal): Promise<Issue[] | undefined> {
  const { post } = await import("./transport.ts");
  const data = new FormData(element);
  data.set("_intent", "validate:" + path);
  if (!data.has("_form")) data.set("_form", store.i);
  const { answer } = await post(element, data, signal);
  const reply = answer.action?.result as { issues?: Record<string, Issue[]> } | undefined;
  return reply?.issues?.[path];
}

/**
 * Submit-time validation: whole schema (all issues shown), then every configured field check for
 * the submitted paths, awaited up to `asyncTimeout`. Resolves validity and the schema output.
 */
export async function validateAll(def: FormDefinition<any>, store: FormStore<any>, element: HTMLFormElement | null, data: FormData): Promise<{ ok: boolean; value?: unknown }> {
  const input = decodeWith(def, data);
  const state = runtime(store);
  const generation = ++state.generation;
  const outcome = runSchema(def, input);
  let resolved: { value?: unknown; issues: IssueMap };
  if (outcome instanceof Promise) {
    pending(store, 1);
    try {
      resolved = await outcome;
    } finally {
      pending(store, -1);
    }
  } else resolved = outcome;
  if (generation === state.generation) applyIssues(def, store, resolved.issues, true);
  const checks: Promise<void>[] = [];
  if (def.fields) {
    const names = new Set<string>();
    for (const [name] of data) {
      const path = canonicalName(name);
      if (path && !resolved.issues.fields[path]) names.add(path);
    }
    for (const path of names) {
      const running = check(def, store, element, path, input, 0);
      if (running) checks.push(running);
    }
  }
  if (checks.length) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => (timer = setTimeout(() => resolve("timeout"), def.asyncTimeout ?? 10_000)));
    const finished = await Promise.race([Promise.all(checks).then(() => "done" as const), timeout]);
    clearTimeout(timer);
    if (finished === "timeout") {
      writeFormIssues(store, [...untrack(store.fe), { key: "errors.timeout" }]);
      return { ok: false };
    }
    for (const path of state.checks.keys()) {
      if (state.checks.get(path)!.length) arm(store, path);
      writeIssues(store, path, combined(store, path));
    }
  }
  const failed = Object.keys(resolved.issues.fields).length > 0 || resolved.issues.form.length > 0 || [...state.checks.values()].some((list) => list.length > 0);
  return failed ? { ok: false } : { ok: true, value: resolved.value };
}
