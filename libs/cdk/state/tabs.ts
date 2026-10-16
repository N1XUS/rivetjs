// Tabs state (react-stately useTabListState over useSingleSelectListState): the selected key, the
// focused key, disabled keys, orientation and keyboard activation. Serializable (signals + JSON).
// Ported from react-spectrum (Apache-2.0, © Adobe): packages/react-stately/src/tabs/useTabListState.ts,
// list/useSingleSelectListState.ts.
//
// Rivet:
// - `selectedKey` is the source of truth: a two-way `Signal<Key | null>`, a plain value (RAC controlled:
//   never written, `onSelectionChange` still fires) or absent (uncontrolled, `defaultSelectedKey`). The
//   SelectionManager runs on a transient lens (`tabsSelectionState`) at event time.
// - useTabListState's effect "a tab is always selected" runs once, at creation, over the tab keys the
//   caller found (`TabListStateOptions.tabs`: `Tabs` builds them from its children, the `items` preset
//   from its items). It writes the selection without calling `onSelectionChange` (the original fires it
//   from a mount effect; Rivet creates the state on the server).
// - Its second effect (focus follows selection while the tablist is not focused) is the
//   `effectiveFocusedKey` read: `focusedSelection` remembers the selection the focused key was set
//   under, so a selection change from outside moves the tab stop like the original's effect.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/cdk/id";
import { hasKey, type MultipleSelectionState } from "../_adapters/grid-selection.ts";
import type { Key, Orientation, SelectionValue } from "../_adapters/collection.ts";
import type { FocusStrategy } from "../collections/types.ts";

export type { Key } from "../_adapters/collection.ts";

/** A tab the state knows of at creation (default selection): its key and whether it is disabled. */
export interface TabKey {
  readonly id: Key;
  readonly isDisabled?: boolean | undefined;
}

export type KeyboardActivation = "automatic" | "manual";

export interface TabListStateOptions {
  /** Base of the generated ids (tabs `<id>-tab-<key>`, panels `<id>-tabpanel-<key>`); default a fresh id. */
  id?: string | undefined;
  /** The currently selected key: a two-way signal, a plain value or an accessor (controlled; live props). */
  selectedKey?: Key | null | Signal<Key | null> | Signal<Key> | (() => Key | null) | undefined;
  /** The initial selected key (uncontrolled). */
  defaultSelectedKey?: Key | undefined;
  /** Handler that is called when the selection changes (also on re-selecting the selected tab). */
  onSelectionChange?: ((key: Key) => void) | undefined;
  /** The item keys that are disabled. These items cannot be selected, focused, or otherwise interacted with. An accessor stays live (read through `tabsDisabledKeys`). */
  disabledKeys?: Iterable<Key> | (() => Iterable<Key> | undefined) | undefined;
  /** Whether the whole tab list is disabled (an accessor: live props, read at use through `isTabsDisabled`). */
  isDisabled?: boolean | (() => boolean | undefined) | undefined;
  /** @default "horizontal". An accessor stays live (read through `tabsOrientation`). */
  orientation?: Orientation | (() => Orientation | undefined) | undefined;
  /** @default "automatic". An accessor stays live (read through `tabsKeyboardActivation`). */
  keyboardActivation?: KeyboardActivation | (() => KeyboardActivation | undefined) | undefined;
  /**
   * Rivet: the tabs in order, for the default selection (first enabled tab, else the first tab) when no tab is
   * selected or the selected key is not a tab (not for a plain controlled `selectedKey`). Read once, at creation;
   * omit to keep the given selection as is.
   */
  tabs?: (() => readonly TabKey[]) | undefined;
}

export interface TabListState {
  /** Base id: tabs are `<id>-tab-<key>`, panels `<id>-tabpanel-<key>`. */
  readonly id: string;
  /** The selected key (a read-only cell for a plain controlled value, the accessor for a live one: `controlled`, never written). */
  readonly selectedKey: Signal<Key | null>;
  /** A plain controlled `selectedKey`: never written. */
  readonly controlled: boolean;
  readonly focusedKey: Signal<Key | null>;
  /** Selection the focused key was set under (see effectiveFocusedKey). */
  readonly focusedSelection: Signal<Key | null>;
  readonly isFocused: Signal<boolean>;
  readonly disabledKeys: Set<Key>;
  /** Whether the whole tab list was disabled at creation; read `isTabsDisabled(state)` (follows a live `disabled`). */
  readonly isDisabled: boolean;
  /** A live `isDisabled` (live props). */
  readonly disabled?: (() => boolean | undefined) | undefined;
  readonly orientation: Orientation;
  readonly keyboardActivation: KeyboardActivation;
  /** Rivet (live props): accessors of a live `orientation` / `keyboardActivation` / `disabledKeys` (the fields above
   *  hold the creation values); read through `tabsOrientation` / `tabsKeyboardActivation` / `tabsDisabledKeys`. */
  readonly live?: TabListLive | undefined;
  readonly onSelectionChange?: ((key: Key) => void) | undefined;
}

/** Live accessors of a tab list state (live props). */
export interface TabListLive {
  readonly orientation?: () => Orientation | undefined;
  readonly keyboardActivation?: () => KeyboardActivation | undefined;
  readonly disabledKeys?: () => Iterable<Key> | undefined;
}

/** The tab list's current orientation (a live one, else the creation value). */
export const tabsOrientation = (state: TabListState): Orientation => (state.live?.orientation ? (state.live.orientation() ?? "horizontal") : state.orientation);
/** The tab list's current keyboard activation. */
export const tabsKeyboardActivation = (state: TabListState): KeyboardActivation =>
  state.live?.keyboardActivation ? (state.live.keyboardActivation() ?? "automatic") : state.keyboardActivation;
/** The tab list's current disabled keys (a live one is read into a new Set). */
export const tabsDisabledKeys = (state: TabListState): Set<Key> =>
  state.live?.disabledKeys ? new Set<Key>(state.live.disabledKeys() ?? []) : state.disabledKeys;

const isSignal = <T>(value: unknown): value is Signal<T> => typeof value === "function" && typeof (value as { set?: unknown }).set === "function";

/** Whether the whole tab list is disabled (reads a live `isDisabled`). */
export const isTabsDisabled = (state: TabListState): boolean => (state.disabled ? !!state.disabled() : state.isDisabled);

/** react-stately findDefaultSelectedKey: first enabled tab, else the first tab. */
export function findDefaultSelectedKey(tabs: readonly TabKey[], disabledKeys: Set<Key>, isDisabled = false): Key | null {
  if (!tabs.length) return null;
  const enabled = isDisabled ? undefined : tabs.find((tab) => !tab.isDisabled && !hasKey(disabledKeys, tab.id));
  return (enabled ?? tabs[0]!).id;
}

const sameKey = (a: Key | null | undefined, b: Key | null | undefined): boolean => (a == null || b == null ? a == b : String(a) === String(b));

export function createTabListState(options: TabListStateOptions): TabListState {
  // Rivet (live props): an accessor `orientation` / `keyboardActivation` / `disabledKeys` stays live (`live`).
  let live: Record<string, unknown> | undefined;
  const now = <V>(key: "orientation" | "keyboardActivation" | "disabledKeys"): V | undefined => {
    const v = options[key];
    if (typeof v !== "function") return v as V | undefined;
    (live ??= {})[key] = v;
    return untrack(v as () => V | undefined);
  };
  const disabledKeys = new Set<Key>(now<Iterable<Key>>("disabledKeys") ?? []);
  const orientation = now<Orientation>("orientation") ?? "horizontal";
  const keyboardActivation = now<KeyboardActivation>("keyboardActivation") ?? "automatic";
  const disabled = typeof options.isDisabled === "function" ? options.isDisabled : undefined;
  const isDisabled = disabled ? !!untrack(disabled) : !!options.isDisabled;
  const given = options.selectedKey;
  const controlled = given !== undefined && !isSignal(given);
  let selectedKey: Signal<Key | null>;
  if (isSignal<Key | null>(given)) selectedKey = given;
  // A live controlled value (accessor; live props): kept as is (resumable), only read — `controlled` writes nothing.
  else if (typeof given === "function") selectedKey = given as unknown as Signal<Key | null>;
  else if (controlled) {
    const value = given as Key | null;
    // A plain controlled value: a read-only cell (useControlledState: writes only call onSelectionChange).
    const cell = Object.assign(() => value, { set: () => value, update: () => value });
    selectedKey = cell as unknown as Signal<Key | null>;
  } else selectedKey = signal<Key | null>(options.defaultSelectedKey ?? null);
  // "Ensure a tab is always selected": none selected / the selected key is not a tab → first enabled tab.
  const tabs = options.tabs;
  if (tabs && !controlled) {
    const current = untrack(selectedKey);
    const list = tabs();
    if (current == null || !list.some((tab) => sameKey(tab.id, current))) {
      const key = findDefaultSelectedKey(list, disabledKeys, isDisabled);
      if (key != null) selectedKey.set(key);
    }
  }
  const initial = untrack(selectedKey);
  return {
    id: options.id ?? createId(),
    selectedKey,
    controlled,
    focusedKey: signal<Key | null>(initial),
    focusedSelection: signal<Key | null>(initial),
    isFocused: signal(false),
    disabledKeys,
    isDisabled,
    disabled,
    orientation,
    keyboardActivation,
    ...(live ? { live: live as TabListLive } : {}),
    onSelectionChange: options.onSelectionChange,
  };
}

/** The key that is the tab stop (reads signals): the focused key, or the selection when it changed from outside while unfocused. */
export function effectiveFocusedKey(state: TabListState): Key | null {
  const selected = state.selectedKey(),
    focused = state.focusedKey();
  if (!state.isFocused() && !sameKey(selected, state.focusedSelection())) return selected;
  return focused;
}

/** Select `key` (and focus it), firing `onSelectionChange` (always, like useSingleSelectListState). */
export function selectTab(state: TabListState, key: Key): void {
  if (!state.controlled) state.selectedKey.set(key);
  setTabFocusedKey(state, key);
  state.onSelectionChange?.(key);
}

/** Set the focused tab (records the selection it was set under). */
export function setTabFocusedKey(state: TabListState, key: Key | null): void {
  state.focusedKey.set(key);
  state.focusedSelection.set(untrack(state.selectedKey));
}

/**
 * Transient MultipleSelectionState view of the tabs state for the SelectionManager
 * (useSingleSelectListState: single, disallowEmptySelection, duplicate events allowed). Event time only.
 */
export function tabsSelectionState(state: TabListState): MultipleSelectionState {
  const keys = () => {
    const key = state.selectedKey();
    return new Set<Key>(key == null ? [] : [key]);
  };
  const lens = Object.assign(keys, {
    set(value: SelectionValue) {
      if (value === "all") return value;
      const key = value.values().next().value ?? null;
      if (key != null) selectTab(state, key);
      return value;
    },
    update(fn: (value: SelectionValue) => SelectionValue) {
      return lens.set(fn(untrack(keys)));
    },
  }) as Signal<SelectionValue>;
  const focusLens = Object.assign(() => state.focusedKey(), {
    set(value: Key | null) {
      setTabFocusedKey(state, value);
      return value;
    },
    update(fn: (value: Key | null) => Key | null) {
      return focusLens.set(fn(untrack(state.focusedKey)));
    },
  }) as Signal<Key | null>;
  return {
    selectionMode: "single",
    disallowEmptySelection: true,
    selectionBehaviorProp: "toggle",
    selectionBehavior: signal<"toggle" | "replace">("toggle"),
    selectedKeys: lens,
    anchorKey: signal<Key | null>(null),
    currentKey: signal<Key | null>(null),
    disabledKeys: tabsDisabledKeys(state),
    disabledBehavior: "all",
    allowDuplicateSelectionEvents: true,
    isFocused: state.isFocused,
    focusedKey: focusLens,
    childFocusStrategy: signal<FocusStrategy | null>(null),
  };
}
