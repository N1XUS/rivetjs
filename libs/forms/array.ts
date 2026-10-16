// Field arrays (`@rivetjs/forms/array`): stable row keys for `For`, client operations that move
// issue/touched/value records with their rows, and no-JS intent buttons the action applies.
//
//   <For each={() => keys(form, "items")} by={(key) => key}>{(key, index) =>
//     <input name={`items.${index()}.sku`} value={defaultValue(form, `items.${key()}.sku`)} />}</For>
//   (names follow the index; defaults follow the row key: server rows are keyed by their index)
//   <button type="submit" name="_intent" value={insertIntent("items")}>Add</button>   (onSubmit applies it)
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import type { FormDefinition } from "./define.ts";
import { elementOf } from "./dom.ts";
import { getAt, isIndex } from "./path.ts";
import { absolute, initialOf, runtime, storeOf, type Form, type FormStore } from "./store.ts";
import type { FieldArrayPath } from "./types.ts";

/** Rows of an array path in the echo (`#path` count from an intent, else the highest index). */
function echoedRows(store: FormStore<any>, name: string): number {
  const x = store.x;
  if (!x) return 0;
  const counted = x["#" + name];
  if (typeof counted === "string") return Number(counted);
  let count = 0;
  const prefix = name + ".";
  for (const key in x) {
    if (!key.startsWith(prefix)) continue;
    const index = key.slice(prefix.length).split(".")[0]!;
    if (isIndex(index)) count = Math.max(count, Number(index) + 1);
  }
  return count;
}
let serial = 0;
const fresh = (): string => (serial++).toString(36) + Math.random().toString(36).slice(2, 6);

function keySignal(store: FormStore<any>, name: string): Signal<string[]> {
  const map = (store.k ??= {});
  if (!map[name]) {
    const initial = getAt(initialOf(store), name);
    const rows = Math.max(echoedRows(store, name), Array.isArray(initial) ? initial.length : 0);
    map[name] = signal(Array.from({ length: rows }, (_, index) => String(index)));
  }
  return map[name];
}

/** Stable row keys of an array field (reactive): render rows with `For`; the index names the inputs. */
export function keys<T, P extends FieldArrayPath<T>>(form: Form<T>, path: P): string[] {
  return keySignal(storeOf(form), absolute(form, path))();
}
/** Row count (reactive). */
export const rows = <T, P extends FieldArrayPath<T>>(form: Form<T>, path: P): number => keys(form, path).length;

/**
 * Reorder rows: `order[newIndex] = oldIndex` (−1 = new row). Keys and every per-path record (issues,
 * touched, values, pending checks, armed) under the array move with their rows.
 */
function reorder(store: FormStore<any>, name: string, order: number[]): void {
  const current = untrack(keySignal(store, name));
  const prefix = name + ".";
  const remap = (path: string): string | null => {
    const rest = path.slice(prefix.length);
    const dot = rest.indexOf(".");
    const index = Number(dot < 0 ? rest : rest.slice(0, dot));
    const next = order.indexOf(index);
    return next < 0 ? null : prefix + next + (dot < 0 ? "" : rest.slice(dot));
  };
  const under = (path: string) => path.startsWith(prefix) && isIndex(path.slice(prefix.length).split(".")[0]!);
  for (const records of [store.f, store.t, store.v, store.w] as (Record<string, Signal<unknown>> | undefined)[]) {
    if (!records) continue;
    const snapshot = new Map<string, unknown>();
    for (const path in records) if (under(path)) snapshot.set(path, untrack(records[path]!));
    for (const path of snapshot.keys()) {
      // Each target takes its source row's value; rows without a source reset.
      const rest = path.slice(prefix.length);
      const dot = rest.indexOf(".");
      const index = Number(dot < 0 ? rest : rest.slice(0, dot));
      const source = order[index];
      const from = source === undefined || source < 0 ? undefined : prefix + source + (dot < 0 ? "" : rest.slice(dot));
      const empty = records === store.t || records === store.w ? false : undefined;
      records[path]!.set(from !== undefined && snapshot.has(from) ? snapshot.get(from) : empty);
    }
    for (const [path, value] of snapshot) {
      const target = remap(path);
      if (target && !records[target]) records[target] = signal<unknown>(value);
    }
  }
  const state = runtime(store);
  state.armed = new Set([...state.armed].flatMap((path) => (under(path) ? (remap(path) ? [remap(path)!] : []) : [path])));
  for (const path of [...state.checks.keys()]) if (under(path)) state.checks.delete(path);
  for (const path of Object.keys(state.schema)) if (under(path)) delete state.schema[path];
  store.u.update((n) => n + 1);
  store.d?.update((n) => n + 1);
  keySignal(store, name).set(order.map((from) => (from < 0 ? fresh() : current[from]!)));
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const count = (store: FormStore<any>, name: string) => untrack(keySignal(store, name)).length;

/** Insert an empty row at `index` (default: the end); focuses its first control. */
export function insert<T, P extends FieldArrayPath<T>>(form: Form<T>, path: P, index?: number): void {
  const store = storeOf(form);
  const name = absolute(form, path);
  const order = range(count(store, name));
  const at = Math.max(0, Math.min(index ?? order.length, order.length));
  order.splice(at, 0, -1);
  reorder(store, name, order);
  focusRow(store, name, at);
}
/** Remove row `index`; focuses the row that took its place, if any. */
export function remove<T, P extends FieldArrayPath<T>>(form: Form<T>, path: P, index: number): void {
  const store = storeOf(form);
  const name = absolute(form, path);
  const order = range(count(store, name));
  if (index < 0 || index >= order.length) return;
  order.splice(index, 1);
  reorder(store, name, order);
  if (index < order.length) focusRow(store, name, index);
}
/** Move row `from` to `to`. */
export function move<T, P extends FieldArrayPath<T>>(form: Form<T>, path: P, from: number, to: number): void {
  const store = storeOf(form);
  const name = absolute(form, path);
  const order = range(count(store, name));
  if (from < 0 || to < 0 || from >= order.length || to >= order.length || from === to) return;
  order.splice(to, 0, order.splice(from, 1)[0]!);
  reorder(store, name, order);
}
/** Swap rows `a` and `b`. */
export function swap<T, P extends FieldArrayPath<T>>(form: Form<T>, path: P, a: number, b: number): void {
  const store = storeOf(form);
  const name = absolute(form, path);
  const order = range(count(store, name));
  if (a < 0 || b < 0 || a >= order.length || b >= order.length || a === b) return;
  [order[a], order[b]] = [order[b]!, order[a]!];
  reorder(store, name, order);
}
/** Replace all rows with `length` fresh empty rows (records under the array cleared). */
export function replace<T, P extends FieldArrayPath<T>>(form: Form<T>, path: P, length: number): void {
  reorder(storeOf(form), absolute(form, path), Array.from({ length }, () => -1));
}

function focusRow(store: FormStore<any>, name: string, index: number): void {
  if (typeof document === "undefined") return;
  // After the row's DOM exists (effects flush synchronously or in a microtask).
  setTimeout(() => {
    const element = elementOf(store);
    const prefix = `${name}.${index}.`;
    const control = element && Array.from(element.elements).find((el) => {
      const field = (el as HTMLInputElement).name;
      return field === `${name}.${index}` || field?.startsWith(prefix);
    });
    (control as HTMLElement | undefined)?.focus();
  });
}

// --- intent buttons (no JS: the action applies them to the echo; with JS: `onArrayIntent`) ---

/** Intent value for a submit button that inserts an item into the array at `path` (works without JS). */
export const insertIntent = (path: string, index?: number): string => `insert:${path}${index === undefined ? "" : ":" + index}`;
/** Intent value for a submit button that removes an array item (works without JS). */
export const removeIntent = (path: string, index: number): string => `remove:${path}:${index}`;
/** Intent value for a submit button that moves an array item (works without JS). */
export const moveIntent = (path: string, from: number, to: number): string => `move:${path}:${from}:${to}`;
/** Intent value for a submit button that swaps two array items (works without JS). */
export const swapIntent = (path: string, a: number, b: number): string => `swap:${path}:${a}:${b}`;

const INTENT = /^(insert|remove|move|swap):([\w.-]+?)((?::\d+)*)$/;
/** Whether `value` is an array intent (`insert:items`, `remove:items:1`, ...). */
export const isArrayIntent = (value: string): boolean => INTENT.test(value);

/** Apply an array intent value to the form in the browser; false when it is not one. Paths are absolute. */
export function applyArrayIntent(form: Form<any>, value: string): boolean {
  const match = INTENT.exec(value);
  if (!match) return false;
  const [, op, name, rest] = match;
  const [a, b] = rest!.split(":").slice(1).map(Number);
  const root = storeOf(form) as Form<any>;
  if (op === "insert") insert(root, name as never, a);
  else if (op === "remove" && a !== undefined) remove(root, name as never, a);
  else if (op === "move" && a !== undefined && b !== undefined) move(root, name as never, a, b);
  else if (op === "swap" && a !== undefined && b !== undefined) swap(root, name as never, a, b);
  return true;
}

/**
 * `onClick` for `type="button"` intent buttons (or delegated on the `<form>`). Submit-type intent
 * buttons need nothing: `onSubmit` applies their intent in the browser, the action without JS.
 */
export function onArrayIntent(_def: FormDefinition<any>, form: Form<any>, event: Event): void {
  const button = (event.target as Element | null)?.closest?.("button[name=_intent]") as HTMLButtonElement | null;
  if (!button || button.type === "submit") return;
  const element = elementOf(storeOf(form));
  if (element && button.form !== element) return;
  if (applyArrayIntent(form, button.value)) event.preventDefault();
}
