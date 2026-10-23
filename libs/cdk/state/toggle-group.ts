// Ported from react-stately `useToggleGroupState` (packages/react-stately/src/toggle/useToggleGroupState.ts), Apache-2.0, © Adobe.
// Toggle group state (ToggleButtonGroup): pure signals + JSON, serializable, server-safe.
// Rivet:
// - `selectedKeys` (RA `useControlledState`): a `Signal<Iterable<Key>>` is two-way (written on every change);
//   a plain iterable is controlled (the signal keeps it, only `onSelectionChange` reports changes), so is an accessor
//   (a live prop: read on use, never written); omitted →
//   uncontrolled from `defaultSelectedKeys`. Read the selection with `selectedKeysOf(state)` / `isKeySelected`.
// - Methods are free functions taking the state (`toggleKey(state, key)`, `setSelected`, `setSelectedKeys`).
// - `useControlledState` calls `onChange` when the new value is not `Object.is` the current one; every write
//   here is a fresh Set, so `onSelectionChange` fires on every toggle (upstream behaviour).
// - Live `isDisabled` (React re-creates the state with the new prop each render): `state.isDisabled` is the value at creation
//   (plain data, so the state encodes by value on resume: a getter would make the resume encoder rebuild it from its recipe,
//   with a fresh selection signal the server bindings do not track); `live` (2nd argument, a compiler-registered getter
//   object of the component) is read by `isGroupDisabled(state)`, which every in-cdk reader uses.
// - Rivet extension (no RAC counterpart; RAC Tabs / Select / RadioGroup shape): `selectedKey` / `defaultSelectedKey` for single
//   selection. A `Signal<Key | null>` is two-way (`keySource`, written with the first key of the new set or `null`); a plain key is
//   controlled (= `selectedKeys: [key]`); `defaultSelectedKey` = `defaultSelectedKeys: [key]`. `selectedKeys` wins when both are given.
//   Used by `@rivetjs/ui/segment` (feature set inspired by HeroUI Pro's public docs).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import type { Key } from "../collections/types.ts";

export interface ToggleGroupProps {
  /**
   * Whether single or multiple selection is enabled. Read once at mount (it picks the group / item roles and the selection model).
   *
   * @default 'single'
   */
  selectionMode?: "single" | "multiple";
  /** Whether the collection allows empty selection (live through the `live` source: `ToggleButtonGroup`). */
  disallowEmptySelection?: boolean;
  /** The currently selected keys in the collection (controlled: a plain iterable, or a two-way Signal). */
  selectedKeys?: Iterable<Key> | Signal<Iterable<Key>> | (() => Iterable<Key>);
  /** The initial selected keys in the collection (uncontrolled). */
  defaultSelectedKeys?: Iterable<Key>;
  /** Handler that is called when the selection changes. */
  onSelectionChange?: (keys: Set<Key>) => void;
  /** Whether all items are disabled. */
  isDisabled?: boolean;
  /**
   * Rivet extension: the selected key in single selection (controlled: a plain key or `null`, or a two-way `Signal<Key | null>`).
   * Ignored when `selectedKeys` is given.
   */
  selectedKey?: Key | null | Signal<Key | null> | Signal<string | null> | Signal<number | null> | (() => Key | null);
  /** Rivet extension: the initial selected key in single selection (uncontrolled). Ignored when `defaultSelectedKeys` is given. */
  defaultSelectedKey?: Key;
}

export interface ToggleGroupState {
  /** Whether single or multiple selection is enabled. */
  readonly selectionMode: "single" | "multiple";
  /** Whether all items are disabled, when the state was created (live: `isGroupDisabled(state)`). */
  readonly isDisabled: boolean;
  /** Rivet: live source of `isDisabled` (`createToggleGroupState(props, live)`), read by `isGroupDisabled`. */
  readonly live: ToggleGroupLive | undefined;
  /** Whether the collection allows empty selection. */
  readonly disallowEmptySelection: boolean;
  /** A set of keys for items that are selected (read it to track). */
  readonly selectedKeys: Signal<Set<Key>>; // unused while `source` is given (read `selectedKeysOf`)
  /** Two-way selection Signal given as `selectedKeys` (written on change). */
  readonly source: Signal<Iterable<Key>> | undefined;
  /** Rivet: two-way single-key Signal given as `selectedKey` (written with the first selected key, or `null`). */
  readonly keySource?: Signal<Key | null> | undefined;
  /** Plain / accessor controlled `selectedKeys` / `selectedKey`: changes are only reported. */
  readonly controlled: boolean;
  readonly onSelectionChange: ((keys: Set<Key>) => void) | undefined;
}

/** Rivet: live sources of the group flags (an object of getters, e.g. `ToggleButtonGroup`'s own props / context). */
export interface ToggleGroupLive {
  readonly isDisabled?: boolean;
  readonly disallowEmptySelection?: boolean;
}

const isSignal = (value: unknown): value is Signal<any> => typeof value === "function" && typeof (value as Signal<unknown>).set === "function";

/**
 * Manages state for a group of toggles.
 * It supports both single and multiple selected items.
 */
export function createToggleGroupState(props: ToggleGroupProps = {}, live?: ToggleGroupLive): ToggleGroupState {
  const { selectionMode = "single", disallowEmptySelection = false } = props;
  const keyProp = props.selectedKeys === undefined ? props.selectedKey : undefined;
  // A Signal is two-way; an accessor (live prop `selectedKeys={k()}`) is read as is and never written (`controlled`).
  const keySource = typeof keyProp === "function" ? (keyProp as Signal<Key | null>) : undefined;
  const prop = props.selectedKeys ?? (keyProp === undefined || keySource ? undefined : keyProp === null ? [] : [keyProp as Key]);
  const source = typeof prop === "function" ? (prop as Signal<Iterable<Key>>) : undefined;
  const controlled = (prop != null && !isSignal(prop)) || (keySource !== undefined && !isSignal(keySource));
  const defaults = props.defaultSelectedKeys ?? (props.defaultSelectedKey !== undefined ? [props.defaultSelectedKey] : []);
  // Region state: a resumed page re-creating the group's region keeps the selection.
  const selectedKeys = signal(new Set<Key>(source || keySource ? [] : controlled ? (prop as Iterable<Key>) : defaults));
  return {
    selectionMode,
    isDisabled: !!props.isDisabled,
    disallowEmptySelection,
    selectedKeys,
    source,
    keySource,
    controlled,
    onSelectionChange: props.onSelectionChange,
    live,
  };
}

/** Whether the group is disabled now: the live source when given (tracked when it reads signals), else `state.isDisabled`. */
export function isGroupDisabled(state: ToggleGroupState): boolean {
  return state.live !== undefined ? !!state.live.isDisabled : state.isDisabled;
}

/** Whether empty selection is disallowed now: the live source when it defines it, else `state.disallowEmptySelection`. */
export function isEmptySelectionDisallowed(state: ToggleGroupState): boolean {
  const live = state.live?.disallowEmptySelection;
  return live !== undefined ? !!live : state.disallowEmptySelection;
}

/** Selected keys: the two-way source when given (tracked), else the state's own set. */
export function selectedKeysOf(state: ToggleGroupState): Set<Key> {
  if (state.keySource) {
    const key = state.keySource();
    return new Set(key == null ? [] : [key]);
  }
  if (state.source) {
    const value = state.source();
    return value instanceof Set ? (value as Set<Key>) : new Set(value);
  }
  return state.selectedKeys();
}

/** Whether `key` is selected (tracked). */
export function isKeySelected(state: ToggleGroupState, key: Key): boolean {
  return selectedKeysOf(state).has(key);
}

/** Replaces the set of selected keys (RA `setSelectedKeys`). */
export function setSelectedKeys(state: ToggleGroupState, keys: Set<Key>): void {
  const current = untrack(() => selectedKeysOf(state));
  if (Object.is(current, keys)) return;
  if (!state.controlled) {
    if (state.keySource) state.keySource.set(keys.values().next().value ?? null);
    else if (state.source) state.source.set(keys);
    else state.selectedKeys.set(keys);
  }
  state.onSelectionChange?.(keys);
}

/** Toggles the selected state for an item by its key. */
export function toggleKey(state: ToggleGroupState, key: Key): void {
  const selectedKeys = untrack(() => selectedKeysOf(state));
  const disallowEmpty = untrack(() => isEmptySelectionDisallowed(state));
  let keys: Set<Key>;
  if (state.selectionMode === "multiple") {
    keys = new Set(selectedKeys);
    if (keys.has(key) && (!disallowEmpty || keys.size > 1)) keys.delete(key);
    else keys.add(key);
  } else {
    keys = new Set(selectedKeys.has(key) && !disallowEmpty ? [] : [key]);
  }
  setSelectedKeys(state, keys);
}

/** Sets whether the given key is selected. */
export function setSelected(state: ToggleGroupState, key: Key, isSelected: boolean): void {
  if (isSelected !== untrack(() => selectedKeysOf(state)).has(key)) toggleKey(state, key);
}
