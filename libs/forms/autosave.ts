// Autosave (`@rivetjs/forms/autosave`): debounced saves of changed fields (raw FormData values; drafts
// may be invalid) through the app's save function, with a version token per save and conflict state.
//
//   const drafts = defineAutosave({ save: postDraft("?/draft") });           // module scope
//   const auto = createAutosave({ version: data.version, draft: data.id });   // component local
//   <form onInput={(e) => onAutosave(drafts, auto, e)} onFocusOut={(e) => onAutosave(drafts, auto, e)}>
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { beforeLeave } from "@rivetjs/router/leave";
import { formOf } from "./dom.ts";
import { canonicalName, matchesPattern } from "./path.ts";
import type { Issue } from "./types.ts";
import type { DraftVersion, SaveResult } from "./wizard.ts";
import type { ActionAnswer } from "@rivetjs/router";

/** Changed fields by path, as passed to `save`. */
export type Patch = Record<string, string | string[]>;
/** What `save` receives besides the patch: last seen version, draft id and abort signal. */
export interface SaveContext {
  readonly version?: DraftVersion;
  readonly draft?: string;
  readonly signal: AbortSignal;
}
/** An autosave defined with `defineAutosave()`: save function, debounce and excluded paths. */
export interface AutosaveDefinition {
  /** Persist `patch` (changed fields by path). Resolve the new version, or a conflict. */
  readonly save: (patch: Patch, context: SaveContext) => Promise<SaveResult>;
  /** Quiet period after the last input (ms, default 800); blur saves at once. */
  readonly debounce?: number;
  /** Never saved (default: paths containing "password"/"secret"; files are never saved). */
  readonly exclude?: readonly string[];
}
/** Define an autosave at module scope. */
export const defineAutosave = (options: AutosaveDefinition): AutosaveDefinition => Object.freeze({ ...options });

const SAVING = 1;
/** Per-form autosave state (component local; serializable). */
export interface AutosaveState {
  /** Last version the server confirmed. */
  readonly v: Signal<DraftVersion | undefined>;
  /** Status bits (saving). */
  readonly b: Signal<number>;
  /** Unsaved field count. */
  readonly n: Signal<number>;
  /** Last successful save (epoch ms). */
  readonly t: Signal<number | undefined>;
  /** Last save failure. */
  readonly e: Signal<Issue | undefined>;
  /** A newer version saved elsewhere: the server's version (and value when given). */
  readonly c: Signal<{ version: DraftVersion; value?: unknown } | undefined>;
  readonly k?: string;
}
/** Create the autosave state of one rendered form, starting from a saved version / draft. */
export function createAutosave(options: { version?: DraftVersion; draft?: string } = {}): AutosaveState {
  const state: AutosaveState = { v: signal(options.version), b: signal(0), n: signal(0), t: signal<number | undefined>(undefined), e: signal<Issue | undefined>(undefined), c: signal<{ version: DraftVersion; value?: unknown } | undefined>(undefined) };
  return options.draft ? { ...state, k: options.draft } : state;
}

interface Pending {
  patch: Patch;
  timer?: ReturnType<typeof setTimeout>;
  inflight?: AbortController;
  done?: Promise<void>;
}
const pendings = new WeakMap<AutosaveState, Pending>();
const pendingOf = (state: AutosaveState): Pending => {
  let found = pendings.get(state);
  if (!found) pendings.set(state, (found = { patch: {} }));
  return found;
};
const SECRET = /password|secret/i;

/** `onInput` / `onFocusOut` on the `<form>`: record the field's current value; save after the quiet period (blur: now). */
export function onAutosave(def: AutosaveDefinition, state: AutosaveState, event: Event): void {
  const element = formOf(event);
  const target = event.target as HTMLInputElement | null;
  const name = target?.name;
  if (!element || !name || name.startsWith("_") || target.type === "file") return;
  const path = canonicalName(name);
  if (!path || (def.exclude ? def.exclude.some((pattern) => matchesPattern(pattern, path)) : SECRET.test(path))) return;
  const values = new FormData(element).getAll(name).filter((value): value is string => typeof value === "string");
  markChanged(def, state, path, values.length === 1 && !name.endsWith("[]") ? values[0]! : values, event.type === "focusout");
}

/** Record a changed value (custom widgets; `onAutosave` calls it) and schedule a save (`now`: immediately). */
export function markChanged(def: AutosaveDefinition, state: AutosaveState, path: string, value: string | string[], now = false): void {
  const pending = pendingOf(state);
  pending.patch[path] = value;
  state.n.set(Object.keys(pending.patch).length);
  clearTimeout(pending.timer);
  if (now) void flush(def, state);
  else pending.timer = setTimeout(() => void flush(def, state), def.debounce ?? 800);
}

/** Save pending changes now (waits for a save in flight first). Resolves when settled. */
export async function flush(def: AutosaveDefinition, state: AutosaveState): Promise<void> {
  const pending = pendingOf(state);
  clearTimeout(pending.timer);
  pending.timer = undefined;
  // One save at a time: the next one carries the version the previous returned.
  while (pending.done) await pending.done;
  if (!Object.keys(pending.patch).length || untrack(state.c)) return;
  const patch = pending.patch;
  pending.patch = {};
  const controller = new AbortController();
  pending.inflight = controller;
  state.b.set(untrack(state.b) | SAVING);
  const run = (async () => {
    try {
      const version = untrack(state.v);
      const result = await def.save(patch, { signal: controller.signal, ...(version !== undefined ? { version } : {}), ...(state.k ? { draft: state.k } : {}) });
      if (result.ok) {
        state.v.set(result.version);
        state.t.set(Date.now());
        state.e.set(undefined);
      } else {
        state.c.set({ version: result.version, ...(result.value !== undefined ? { value: result.value } : {}) });
        restore(pending, patch);
      }
    } catch (error) {
      restore(pending, patch);
      if (!controller.signal.aborted) state.e.set({ key: "errors.save", message: error instanceof Error ? error.message : String(error) });
    } finally {
      pending.inflight = undefined;
      pending.done = undefined;
      state.b.set(untrack(state.b) & ~SAVING);
      state.n.set(Object.keys(pending.patch).length);
    }
  })();
  pending.done = run;
  await run;
}
/** Unsaved changes go back in front of newer ones (newer values win). */
function restore(pending: Pending, patch: Patch): void {
  pending.patch = { ...patch, ...pending.patch };
}

/** Resolve a conflict: continue from `version` (the app merged or chose); pending changes save next. */
export function resolveConflict(def: AutosaveDefinition, state: AutosaveState, version: DraftVersion): Promise<void> {
  state.v.set(version);
  state.c.set(undefined);
  return flush(def, state);
}

/** Whether a save is in progress (reactive). */
export const saving = (state: AutosaveState): boolean => (state.b() & SAVING) !== 0;
/** When the last save finished, in ms since the epoch (reactive). */
export const savedAt = (state: AutosaveState): number | undefined => state.t();
/** The last save's error (reactive). */
export const saveError = (state: AutosaveState): Issue | undefined => state.e();
/** A newer version saved elsewhere, when the last save hit a conflict (reactive). */
export const conflict = (state: AutosaveState): { version: DraftVersion; value?: unknown } | undefined => state.c();
/** The version of the last successful save (reactive). */
export const savedVersion = (state: AutosaveState): DraftVersion | undefined => state.v();
/** Changes not yet saved (reactive). */
export const unsaved = (state: AutosaveState): boolean => state.n() > 0 || (state.b() & SAVING) !== 0;
/**
 * Leave guard: true while changes are unsaved or saving (`guardLeave` wires it to the router's
 * `beforeLeave`).
 */
export const shouldBlockLeave = (state: AutosaveState): boolean => untrack(state.n) > 0 || (untrack(state.b) & SAVING) !== 0;

/**
 * Ask before leaving with unsaved changes: client navigation confirms (`message`), closing or
 * reloading gets the browser's prompt. Browser only; returns the unregister function, so
 * `clientEffect(() => guardLeave(auto))` in the component removes it with the component.
 */
export function guardLeave(state: AutosaveState, options: { message?: string; confirm?: (message: string) => boolean } = {}): () => void {
  const message = options.message ?? "You have unsaved changes. Leave this page?";
  return beforeLeave((leave) => {
    if (!shouldBlockLeave(state)) return;
    if (leave.type === "unload" || !(options.confirm ?? globalThis.confirm)(message)) leave.cancel();
  });
}

/**
 * A `save` that POSTs the patch to a router action (`"?/draft"`, resolved against the page) as a form:
 * fields plus `_draft` and `_version`; the action answers `{ ok, version }` (see `draftAction`).
 */
export function postDraft(action: string): AutosaveDefinition["save"] {
  return async (patch, context) => {
    const body = new URLSearchParams();
    for (const [name, value] of Object.entries(patch)) for (const item of Array.isArray(value) ? value : [value]) body.append(name, item);
    if (context.draft) body.set("_draft", context.draft);
    if (context.version !== undefined) body.set("_version", String(context.version));
    const response = await fetch(new URL(action, location.href), { method: "POST", body, headers: { accept: "application/json" }, credentials: "same-origin", signal: context.signal });
    const { _decodeWire } = await import("@rivetjs/runtime/resume-format");
    const answer = (await _decodeWire(await response.text())) as ActionAnswer;
    if (!answer.action) throw new Error(answer.error?.message ?? `Save failed (${response.status})`);
    return answer.action.result as SaveResult;
  };
}
