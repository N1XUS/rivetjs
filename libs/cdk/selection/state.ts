// Ported from @react-stately/selection (Selection.ts, useMultipleSelectionState.ts, types.ts),
// Apache-2.0, © Adobe.
//
// Rivet: the state is plain data + signals (serializable, resumable), created once in the component
// body; the setters of react-stately's state object are free functions taking the state. The
// anchor / current keys that react-stately keeps on its `Selection` Set subclass live in their own
// signals (class instances do not serialize).
import { batch, signal, untrack, type Signal } from "@rivetjs/reactivity";
import type { DisabledBehavior, FocusStrategy, Key, Selection, SelectionBehavior, SelectionMode } from "../collections/types.ts";

/**
 * A Set of keys that also has an anchor and current key for range selection (react-stately
 * `Selection`). Passed to `onSelectionChange`; state signals hold plain Sets.
 */
export class SelectionSet extends Set<Key> {
  anchorKey: Key | null;
  currentKey: Key | null;

  constructor(keys?: Iterable<Key> | SelectionSet, anchorKey?: Key | null, currentKey?: Key | null) {
    super(keys);
    if (keys instanceof SelectionSet) {
      this.anchorKey = anchorKey ?? keys.anchorKey;
      this.currentKey = currentKey ?? keys.currentKey;
    } else {
      this.anchorKey = anchorKey ?? null;
      this.currentKey = currentKey ?? null;
    }
  }
}

export interface FocusState {
  /** Whether the collection is currently focused. */
  readonly isFocused: Signal<boolean>;
  /** The current focused key in the collection. */
  readonly focusedKey: Signal<Key | null>;
  /** Whether the first or last child of the focused key should receive focus. */
  readonly childFocusStrategy: Signal<FocusStrategy | null>;
}

export interface MultipleSelectionState extends FocusState {
  /** The type of selection that is allowed in the collection. */
  readonly selectionMode: SelectionMode;
  /** The selection behavior for the collection (changes on touch long press). */
  readonly selectionBehavior: Signal<SelectionBehavior>;
  /** The `selectionBehavior` option (the behavior to return to once the selection is empty). */
  readonly selectionBehaviorProp: SelectionBehavior;
  /** Whether the collection allows empty selection. */
  readonly disallowEmptySelection: boolean;
  /** The currently selected keys (`"all"` or a Set). */
  readonly selectedKeys: Signal<Selection>;
  /** Range anchor / current key (react-stately keeps them on the Selection object). */
  readonly anchorKey: Signal<Key | null>;
  readonly currentKey: Signal<Key | null>;
  /** The currently disabled keys in the collection. */
  readonly disabledKeys: Set<Key>;
  /** Whether `disabledKeys` applies to selection, actions, or both. */
  readonly disabledBehavior: DisabledBehavior;
  /** Controlled by a plain value: never written, changes only reported to `onSelectionChange`. */
  readonly controlled: boolean;
  /** Whether onSelectionChange should fire even if the new set of keys is the same as the last. */
  readonly allowDuplicateSelectionEvents: boolean;
  readonly onSelectionChange?: ((keys: Selection) => void) | undefined;
  /**
   * Single-key backing (react-stately `useSingleSelectListState`): when set, the selection is
   * `selectedKey` (read and written), and `onSelectedKeyChange` reports changes.
   */
  readonly selectedKey?: Signal<Key | null> | undefined;
  readonly selectedKeyControlled?: boolean | undefined;
  readonly onSelectedKeyChange?: ((key: Key | null) => void) | undefined;
}

export interface MultipleSelectionStateProps {
  /** The type of selection that is allowed in the collection. Default "none". */
  selectionMode?: SelectionMode | undefined;
  /** Whether the collection allows empty selection. */
  disallowEmptySelection?: boolean | undefined;
  /**
   * The selected keys: a signal (two-way), a plain value or an accessor returning a `Selection` (controlled: the
   * state never changes it, `onSelectionChange` reports requested changes).
   */
  selectedKeys?: Signal<Selection> | (() => Selection) | "all" | Iterable<Key> | undefined;
  /** The initial selected keys (uncontrolled). */
  defaultSelectedKeys?: "all" | Iterable<Key> | undefined;
  /** Handler that is called when the selection changes. */
  onSelectionChange?: ((keys: Selection) => void) | undefined;
  /** The currently disabled keys in the collection. */
  disabledKeys?: Iterable<Key> | undefined;
  /** How multiple selection should behave in the collection. Default "toggle". */
  selectionBehavior?: SelectionBehavior | undefined;
  /** Whether onSelectionChange should fire even if the new set of keys is the same as the last. */
  allowDuplicateSelectionEvents?: boolean | undefined;
  /** Whether `disabledKeys` applies to all interactions, or only selection. Default "all". */
  disabledBehavior?: DisabledBehavior | undefined;
  /** Initial focused key (Rivet: focus state is plain state too). */
  defaultFocusedKey?: Key | null | undefined;
  /** Single-key backing (see `MultipleSelectionState.selectedKey`). */
  selectedKey?: Signal<Key | null> | undefined;
  selectedKeyControlled?: boolean | undefined;
  onSelectedKeyChange?: ((key: Key | null) => void) | undefined;
}

const isSignal = (value: unknown): value is Signal<Selection> => typeof value === "function" && typeof (value as Signal<Selection>).set === "function";

function convertSelection(selection: "all" | Iterable<Key> | null | undefined, defaultValue?: Selection): Selection | undefined {
  if (!selection) return defaultValue;
  return selection === "all" ? "all" : new Set(selection);
}

function equalSets(setA: Selection, setB: Selection): boolean {
  if (setA === "all" || setB === "all") return setA === setB;
  if (setA.size !== setB.size) return false;
  for (const item of setA) if (!setB.has(item)) return false;
  return true;
}

/** Manages state for multiple selection and focus in a collection (react-stately `useMultipleSelectionState`). */
export function createMultipleSelectionState(props: MultipleSelectionStateProps = {}): MultipleSelectionState {
  const {
    selectionMode = "none",
    disallowEmptySelection = false,
    allowDuplicateSelectionEvents = false,
    selectionBehavior: selectionBehaviorProp = "toggle",
    disabledBehavior = "all",
  } = props;
  const prop = props.selectedKeys;
  const controlled = prop != null && !isSignal(prop);
  // An accessor (live prop, `utils/live.tsx` `liveKeys`: returns a Set or "all") is controlled: read, never written.
  const selectedKeys =
    typeof prop === "function"
      ? (prop as Signal<Selection>)
      : signal<Selection>(convertSelection(controlled ? (prop as Iterable<Key>) : props.defaultSelectedKeys, new Set())!);
  return {
    selectionMode,
    disallowEmptySelection,
    selectionBehavior: signal(selectionBehaviorProp),
    selectionBehaviorProp,
    selectedKeys,
    anchorKey: signal<Key | null>(null),
    currentKey: signal<Key | null>(null),
    isFocused: signal(false),
    focusedKey: signal<Key | null>(props.defaultFocusedKey ?? null),
    childFocusStrategy: signal<FocusStrategy | null>(null),
    disabledKeys: props.disabledKeys ? new Set(props.disabledKeys) : new Set(),
    disabledBehavior,
    controlled,
    allowDuplicateSelectionEvents,
    onSelectionChange: props.onSelectionChange,
    selectedKey: props.selectedKey,
    selectedKeyControlled: props.selectedKeyControlled,
    onSelectedKeyChange: props.onSelectedKeyChange,
  };
}

const EMPTY: Set<Key> = new Set();

/** The current selection (`"all"` or a Set). Reads the signals (tracked in bindings). */
export function readSelection(state: MultipleSelectionState): Selection {
  if (state.selectedKey) {
    const key = state.selectedKey();
    return key == null ? EMPTY : new Set([key]);
  }
  return state.selectedKeys();
}

/** Sets whether the collection is focused. */
export function setFocused(state: FocusState, isFocused: boolean): void {
  state.isFocused.set(isFocused);
}

/** Sets the focused key, and whether the first or last child of that key should receive focus. */
export function setFocusedKey(state: FocusState, key: Key | null, childFocusStrategy: FocusStrategy = "first"): void {
  batch(() => {
    state.childFocusStrategy.set(childFocusStrategy);
    state.focusedKey.set(key);
  });
}

/** Sets the selection behavior for the collection. */
export function setSelectionBehavior(state: MultipleSelectionState, behavior: SelectionBehavior): void {
  state.selectionBehavior.set(behavior);
}

/**
 * Sets the selected keys (`"all"`, a Set, or a `SelectionSet` carrying anchor / current keys).
 * Skips unchanged selections unless `allowDuplicateSelectionEvents`.
 */
export function setSelectedKeys(state: MultipleSelectionState, keys: Selection): void {
  batch(() => writeSelectedKeys(state, keys));
}

function writeSelectedKeys(state: MultipleSelectionState, keys: Selection): void {
  const current = untrack(() => readSelection(state));
  if (!state.allowDuplicateSelectionEvents && equalSets(keys, current)) return;
  const set = keys instanceof SelectionSet;
  state.anchorKey.set(set ? keys.anchorKey : null);
  state.currentKey.set(set ? keys.currentKey : null);
  if (state.selectedKey) {
    const key = keys === "all" ? null : ((keys.values().next().value as Key | undefined) ?? null);
    if (!state.selectedKeyControlled) state.selectedKey.set(key);
    state.onSelectedKeyChange?.(key);
  } else if (!state.controlled) state.selectedKeys.set(keys === "all" ? "all" : new Set(keys));
  state.onSelectionChange?.(keys);
  // If the selectionBehavior prop is "replace" but the current behavior is "toggle" (e.g. after a
  // long press entered selection mode on touch), and the selection becomes empty, reset it.
  if (state.selectionBehaviorProp === "replace" && untrack(state.selectionBehavior) === "toggle" && keys !== "all" && keys.size === 0) {
    state.selectionBehavior.set("replace");
  }
}

/** Current selection as a `SelectionSet` with anchor / current keys (or "all"). Reads the signals. */
export function getSelection(state: MultipleSelectionState): Selection {
  const keys = readSelection(state);
  return keys === "all" ? "all" : new SelectionSet(keys, state.anchorKey(), state.currentKey());
}
