// The form store: a plain object of signals and literals (resume-serializable when a handler or
// binding captures it). Field values stay in the DOM; per-field signals appear on first use, one
// map per kind (issues, touched, value, validating), so an unbound field costs nothing.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import type { FormDefinition } from "./define.ts";
import type { InferInput, Issue } from "./types.ts";
import { sameIssues } from "./issues.ts";

/** Status bits of `st`. */
export const SUBMITTING = 1, SUBMITTED = 2, VALIDATING = 4, ENHANCED = 8;

/** What the server answers for a forms action (also the no-JS action result). */
export interface FormReply {
  readonly ok: boolean;
  /** Form instance id (`_form`), when the page has several forms of one definition. */
  readonly id?: string;
  readonly issues?: Readonly<Record<string, Issue[]>>;
  readonly form?: Issue[];
  /** Submitted values (excluded fields removed) for re-rendering after a failed no-JS POST. */
  readonly values?: Readonly<Record<string, string | string[]>>;
  /** The handler's return value (success). */
  readonly data?: unknown;
  /** A no-JS intent button the server applied instead of running the handler. */
  readonly intent?: string;
  /** Field-array row counts after a no-JS array intent (rows may be empty, so not in `values`). */
  readonly rows?: Readonly<Record<string, number>>;
}
declare const phantom: unique symbol;
/** One form instance. `T` = schema input (field paths are typed against it). */
export interface FormStore<T = unknown> {
  /** Form id (`formId`): the `<form id>` and the prefix of field ids. */
  readonly i: string;
  /** Definition (action) name. */
  readonly n: string;
  /** Status bits: submitting, submitted, validating, enhanced. */
  readonly st: Signal<number>;
  /** Submit count. */
  readonly c: Signal<number>;
  /** Form-level issues. */
  readonly fe: Signal<Issue[]>;
  /** Bumped whenever any field's shown issues change (summaries, form-wide reads). */
  readonly u: Signal<number>;
  /** Shown issues per field path (field order = first use order ≈ DOM order on the server). */
  readonly f: Record<string, Signal<Issue[] | undefined>>;
  /** Touched (blurred) per field, when read or blurred. */
  t?: Record<string, Signal<boolean>>;
  /** Values per field, when read (`value`, `setValue`). */
  v?: Record<string, Signal<unknown>>;
  /** Pending field check per field, when read or checked. */
  w?: Record<string, Signal<boolean>>;
  /** Field-array row keys. */
  k?: Record<string, Signal<string[]>>;
  /** Echoed raw values after a failed no-JS POST. */
  x?: Record<string, string | string[]>;
  /** Last successful result data. */
  r?: Signal<unknown>;
  /** Input version (form-level `dirty`). */
  d?: Signal<number>;
  readonly [phantom]?: (value: T) => T;
}
/** A typed view of a store rooted at a path (`@rivetjs/forms/scope`): names/ids/issues relative. */
export interface FormView<T = unknown> {
  readonly s: FormStore<any>;
  /** Prefix with trailing dot (`"billing."`). */
  readonly p: string;
  readonly [phantom]?: (value: T) => T;
}
/** A store or a scoped view of one. */
export type Form<T = unknown> = FormStore<T> | FormView<T>;

/** The store behind a form or view, and the view's path prefix. */
export const storeOf = (form: Form<any>): FormStore<any> => ("s" in form ? form.s : form);
export const prefixOf = (form: Form<any>): string => ("s" in form ? form.p : "");
/** Absolute path of a (possibly scoped) relative path. */
export const absolute = (form: Form<any>, path: string): string => prefixOf(form) + path;

/** A field's issue signal, created on first use. */
export const issueSignal = (store: FormStore<any>, path: string): Signal<Issue[] | undefined> => (store.f[path] ??= signal<Issue[] | undefined>(undefined));
export const touchedSignal = (store: FormStore<any>, path: string): Signal<boolean> => ((store.t ??= {})[path] ??= signal(false));
export const validatingSignal = (store: FormStore<any>, path: string): Signal<boolean> => ((store.w ??= {})[path] ??= signal(false));
/** A field's value signal, created with `initial` on first use. */
export const valueSignal = (store: FormStore<any>, path: string, initial: () => unknown): Signal<unknown> => ((store.v ??= {})[path] ??= signal<unknown>(untrack(initial)));

/** Write a field's shown issues (no-op when equal); bumps the store's issue version. */
export function writeIssues(store: FormStore<any>, path: string, issues: readonly Issue[] | undefined): boolean {
  const field = issueSignal(store, path);
  const next = issues?.length ? [...issues] : undefined;
  if (sameIssues(untrack(field), next)) return false;
  field.set(next);
  store.u.update((n) => n + 1);
  return true;
}
export function writeFormIssues(store: FormStore<any>, issues: readonly Issue[]): void {
  if (!sameIssues(untrack(store.fe), issues)) store.fe.set([...issues]);
}
export const setBit = (store: FormStore<any>, bit: number, on: boolean): void => {
  const current = untrack(store.st);
  const next = on ? current | bit : current & ~bit;
  if (next !== current) store.st.set(next);
};
export const hasBit = (store: FormStore<any>, bit: number): boolean => (untrack(store.st) & bit) !== 0;

/** Browser-only state per store (armed fields, timers, aborts, last issues); never serialized. */
export interface Runtime {
  /** Fields that show issues as they change (validated once); fields showing issues count too. */
  armed: Set<string>;
  /** Latest schema issues for every path (shown or not). */
  schema: Record<string, Issue[]>;
  /** Latest field-check issues per path. */
  checks: Map<string, Issue[]>;
  timers: Map<string, ReturnType<typeof setTimeout>>;
  aborts: Map<string, AbortController>;
  /** Validation generation: stale async schema results are dropped. */
  generation: number;
  /** Async validations in flight (the VALIDATING bit). */
  busy: number;
  submit?: AbortController;
}
const runtimes = new WeakMap<FormStore<any>, Runtime>();
export function runtime(store: FormStore<any>): Runtime {
  let state = runtimes.get(store);
  if (!state) runtimes.set(store, (state = { armed: new Set(), schema: {}, checks: new Map(), timers: new Map(), aborts: new Map(), generation: 0, busy: 0 }));
  return state;
}
/** Armed: validated before, or showing issues (server issues after a POST arm their fields). */
export const isArmed = (store: FormStore<any>, path: string): boolean => runtime(store).armed.has(path) || untrack(store.f[path] ?? noIssues) !== undefined;
export const arm = (store: FormStore<any>, path: string): void => void runtime(store).armed.add(path);
export function anyArmed(store: FormStore<any>): boolean {
  if (runtime(store).armed.size) return true;
  for (const path in store.f) if (untrack(store.f[path]!)) return true;
  return false;
}
const noIssues = (): undefined => undefined;

/** Initial values per store (server render only: `defaultValue` reads them; never serialized). */
const initials = new WeakMap<FormStore<any>, unknown>();
export const initialOf = (store: FormStore<any>): unknown => initials.get(store);

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
/** Options of `createForm()`. */
export interface CreateFormOptions<T> {
  /** Form id (default: the definition name). Needed when a page renders one definition twice. */
  id?: string;
  /** Initial values for `defaultValue` / `defaultChecked` (rendered as input values; not serialized). */
  initial?: DeepPartial<T>;
  /** The page's action result (`actionResult()`): applied when it belongs to this form. */
  result?: { readonly name: string; readonly result: unknown } | undefined;
}

/** Create a form store for one rendered form. */
export function createForm<D extends FormDefinition<any>>(def: D, options: CreateFormOptions<InferInput<D>> = {}): FormStore<InferInput<D>> {
  const id = options.id ?? def.name;
  if (!/^[A-Za-z][\w-]*$/.test(id)) throw new TypeError(`createForm: id must start with a letter and use letters, digits, "_" or "-" (got ${JSON.stringify(id)})`);
  const store: FormStore<any> = { i: id, n: def.name, st: signal(0), c: signal(0), fe: signal<Issue[]>([]), u: signal(0), f: {} };
  if (options.initial !== undefined) initials.set(store, options.initial);
  const result = options.result;
  if (result && result.name === def.name) applyReply(store, result.result as FormReply | undefined);
  return store;
}

/** Apply a server reply: issues (shown), form issues, submitted state, echoed values, result data. */
export function applyReply(store: FormStore<any>, reply: FormReply | undefined): void {
  if (!reply || typeof reply !== "object" || typeof reply.ok !== "boolean") return;
  if (reply.id !== undefined && reply.id !== store.i) return;
  if (reply.values) store.x = { ...reply.values };
  // Row counts ride along in the echo under `#path` (never a field name).
  if (reply.rows) for (const path in reply.rows) (store.x ??= {})["#" + path] = String(reply.rows[path]);
  if (reply.intent) return;
  setBit(store, SUBMITTED, true);
  if (untrack(store.c) === 0) store.c.set(1);
  if (reply.ok) {
    (store.r ??= signal<unknown>(undefined)).set(reply.data);
    return;
  }
  for (const path in reply.issues ?? {}) writeIssues(store, path, reply.issues![path]);
  writeFormIssues(store, reply.form ?? []);
}
