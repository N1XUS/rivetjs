// Collections and selection. DOM as collection (default): the server-rendered items are the
// collection — handlers query `[role=option]` (etc.) and read `data-key`; no item model is serialized.
// Selection is plain serializable state: a `Signal<Set<Key>>` plus mode strings.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";

import type { Key, SelectionMode } from "./types.ts";

/** Item key (`./types.ts`): serializable, rendered as `data-key`. */
export type { Key, SelectionMode };

/** Items of a DOM collection: elements matching `selector` inside `root`, in DOM order, skipping hidden ones. */
export function domItems(root: Element, selector: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => !el.hidden && !el.closest("[hidden]:not([popover])"));
}

/** `data-key` of `element` (string; compare state keys with `sameKey`). */
export const keyOf = (element: Element): string | null => element.getAttribute("data-key");

/** Keys compare as strings: `data-key` attributes are strings, state keys may be numbers. */
export const sameKey = (a: Key | null | undefined, b: Key | null | undefined): boolean => a != null && b != null && String(a) === String(b);

/** Whether a DOM item is disabled (`aria-disabled="true"` or a disabled control). */
export const isDisabledItem = (element: Element): boolean =>
  element.getAttribute("aria-disabled") === "true" || (element as HTMLButtonElement).disabled === true;

/** Text used for typeahead: `data-text`, else trimmed text content. */
export const itemText = (element: Element): string => element.getAttribute("data-text") ?? element.textContent?.trim() ?? "";

/** Escape a key into an id fragment (`<listId>-<key>`): word characters kept, others `_<hex>`. */
export const keyId = (base: string, key: Key): string => base + "-" + String(key).replace(/[^\w-]/g, (c) => "_" + c.charCodeAt(0).toString(16));

export interface Selection {
  readonly selected: Signal<Set<Key>>;
  readonly mode: SelectionMode;
  /** Range anchor for Shift+click / Shift+Arrow (multiple). */
  readonly anchor: Signal<Key | null>;
  /** Single mode: whether selecting the selected key again clears it (default false). */
  readonly toggleSingle: boolean;
}

/** Selection state: `selected` (two-way) or `defaultSelected` (internal signal). */
export function createSelection(
  options: {
    mode?: SelectionMode;
    selected?: Signal<Set<Key>>;
    defaultSelected?: Iterable<Key>;
    toggleSingle?: boolean;
  } = {},
): Selection {
  return {
    selected: options.selected ?? signal(new Set(options.defaultSelected ?? [])),
    mode: options.mode ?? "single",
    anchor: signal<Key | null>(null),
    toggleSingle: options.toggleSingle ?? false,
  };
}

/** Whether `key` is selected (reads the signal: use inside bindings). */
export function isSelected(selection: Selection, key: Key): boolean {
  return holds(selection.selected(), key);
}

/**
 * `sameKey` membership without a `String()` per element: `has` answers same-type keys (String is injective on strings
 * and numbers, `has` covers `0` / `-0` and `NaN`), so the loop only compares keys of the other type (`1` vs `"1"`).
 */
function holds(set: ReadonlySet<Key>, key: Key): boolean {
  if (key == null) return false;
  if (set.has(key)) return true;
  for (const k of set) if (typeof k !== typeof key && sameKey(k, key)) return true;
  return false;
}

/** First selected key (single mode value), or null. */
export function firstSelected(selection: Selection): Key | null {
  for (const key of selection.selected()) return key;
  return null;
}

function without(set: Set<Key>, key: Key): Set<Key> {
  const out = new Set<Key>();
  for (const k of set) if (!sameKey(k, key)) out.add(k);
  return out;
}

/** Replace the selection with `key` (single) or toggle `key` (multiple). Mode "none": no-op. */
export function selectKey(selection: Selection, key: Key): void {
  if (selection.mode === "none") return;
  const current = untrack(selection.selected);
  if (selection.mode === "single") {
    const on = holds(current, key);
    if (on && !selection.toggleSingle) return;
    selection.selected.set(on ? new Set() : new Set([key]));
  } else toggleKey(selection, key);
  selection.anchor.set(key);
}

/** Toggle `key` (multiple; single behaves like `selectKey` with toggling). */
export function toggleKey(selection: Selection, key: Key): void {
  if (selection.mode === "none") return;
  const current = untrack(selection.selected);
  const on = holds(current, key);
  if (selection.mode === "single") selection.selected.set(on ? new Set() : new Set([key]));
  else selection.selected.set(on ? without(current, key) : new Set(current).add(key));
  selection.anchor.set(key);
}

/** Select the range from the anchor (or `key`) to `key` among `keys` (collection order); multiple only. */
export function extendTo(selection: Selection, keys: readonly Key[], key: Key): void {
  if (selection.mode !== "multiple") return selectKey(selection, key);
  const anchor = untrack(selection.anchor) ?? key;
  const a = keys.findIndex((k) => sameKey(k, anchor)),
    b = keys.findIndex((k) => sameKey(k, key));
  if (a < 0 || b < 0) return selectKey(selection, key);
  const [from, to] = a < b ? [a, b] : [b, a];
  selection.selected.set(new Set([...untrack(selection.selected), ...keys.slice(from, to + 1)]));
}

/** Select every key in `keys` (multiple only). */
export function selectAll(selection: Selection, keys: readonly Key[]): void {
  if (selection.mode === "multiple") selection.selected.set(new Set(keys));
}

/** Clear the selection. */
export function clearSelection(selection: Selection): void {
  selection.selected.set(new Set());
}
