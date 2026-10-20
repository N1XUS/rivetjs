// Rivet (no upstream counterpart): per-key reactive reads of a selection state. React re-renders every item
// on a selection change; a Rivet item binding that read `selectedKeys()` / `focusedKey()` would re-run for
// every item too. These helpers return the same values as `SelectionManager.isSelected` / `focusedKey ===
// key` / `isEmpty`, but a tracking reader depends only on its own key (reactivity `selector`): a selection
// change re-runs the items whose state changed (O(changed), not O(items)).
//
// The selectors live in module WeakMaps keyed by the state's signals (shared by spread copies of a state, e.g.
// `state/list.ts` ListState, and never serialized). `selector` is owner-free: its watcher lives while
// bindings read keys.
import { memberKeys, selector, type Signal } from "@rivetjs/reactivity";
import type { Key, Selection } from "../collections/types.ts";

/** The state shape the helpers read (both `selection/state.ts` and `_adapters/collections.ts` states). */
export interface KeyedSelectionSource {
  readonly selectedKeys?: Signal<Selection> | undefined;
  readonly selectedKey?: Signal<Key | null> | undefined;
  readonly focusedKey: Signal<Key | null>;
}

/** `selectionOf` result: not selected, in the selected Set, or covered by an "all" selection. */
export const NOT_SELECTED = 0,
  IN_SELECTION = 1,
  ALL_SELECTED = 2;
export type KeySelection = typeof NOT_SELECTED | typeof IN_SELECTION | typeof ALL_SELECTED;

const EMPTY: Set<Key> = new Set();
const selected = new WeakMap<object, (key: Key) => KeySelection>();
const empty = new WeakMap<object, (key: 0) => boolean>();
const focused = new WeakMap<object, (key: Key) => boolean>();
const hasFocus = new WeakMap<object, (key: 0) => boolean>();

const selectionIn = (key: Key, selection: Selection): KeySelection => (selection === "all" ? ALL_SELECTED : selection.has(key) ? IN_SELECTION : NOT_SELECTED);
const isEmpty = (_key: 0, selection: Selection): boolean => selection !== "all" && selection.size === 0;
const onlyKey = (): [0] => [0];

// Change hints are reactivity's own (`memberKeys`: keys in one of two Sets, null when "all" is involved; the default
// pair hint for focus): resume knows them, so a lazy collection row reading `selectionOf` / `isFocusedKey` of a
// signal-backed state wakes only when its key flips (LAZY-T6 keyed wake, `_trackReads` keyed hook).
const changedKeys: (next: Selection, previous: Selection) => Key[] | null = memberKeys;

/** The selection read of `state` (react-stately `useMultipleSelectionState`, or the single-key backing). */
function readerOf(state: KeyedSelectionSource): () => Selection {
  const single = state.selectedKey;
  if (!single) return state.selectedKeys!;
  return () => {
    const key = single();
    return key == null ? EMPTY : new Set([key]);
  };
}

/** Whether `key` is in the selection (`IN_SELECTION`), covered by "all" (`ALL_SELECTED`) or not; tracked per key. */
export function selectionOf(state: KeyedSelectionSource, key: Key): KeySelection {
  const id = state.selectedKey ?? state.selectedKeys!;
  let select = selected.get(id);
  if (select === undefined) selected.set(id, (select = selector(readerOf(state), selectionIn, { keys: changedKeys })));
  return select(key);
}

/** Whether the selection is empty (not "all", no keys); a binding re-runs only when that flips. */
export function isSelectionEmpty(state: KeyedSelectionSource): boolean {
  const id = state.selectedKey ?? state.selectedKeys!;
  let select = empty.get(id);
  if (select === undefined) empty.set(id, (select = selector(readerOf(state), isEmpty, { keys: onlyKey })));
  return select(0);
}

/** `state.focusedKey() === key`, tracked per key. */
export function isFocusedKey(state: KeyedSelectionSource, key: Key): boolean {
  const id = state.focusedKey;
  let select = focused.get(id);
  if (select === undefined) focused.set(id, (select = selector<Key | null, Key>(id)));
  return select(key);
}

/** `state.focusedKey() != null`; a binding re-runs only when that flips (not on every focus move). */
export function hasFocusedKey(state: KeyedSelectionSource): boolean {
  const id = state.focusedKey;
  let select = hasFocus.get(id);
  if (select === undefined) hasFocus.set(id, (select = selector<Key | null, 0>(id, (_key, focusedKey) => focusedKey != null, { keys: onlyKey })));
  return select(0);
}
