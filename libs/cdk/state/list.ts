// Ported from react-spectrum (react-stately: list/useListState, list/useSingleSelectListState), Apache-2.0,
// © Adobe.
//
// List state of ListBox, Select, ComboBox, Menu and Autocomplete: selection + focus (signals + JSON,
// resumable) and the collection's static options. Items are not stored: on the server the data
// items render the collection; in the browser handlers read it back from the DOM ("DOM as
// collection"), so filtering / async items need no state change here.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/cdk/id";
import {
  createMultipleSelectionState,
  flatItems,
  isKeyDisabled,
  isKeySelected,
  readSelection,
  type CollectionEntry,
  type CollectionItem,
  type DisabledBehavior,
  type Key,
  type MultipleSelectionStateProps,
  type Orientation,
  type Selection,
  type SelectionBehavior,
  type SelectionMode,
} from "../_adapters/collections.ts";
import type { LinkBehavior, SelectableCollection, SelectableOptions } from "../_adapters/selection.ts";
import { isFocusedKey } from "../selection/keyed.ts";

export type { Key, Selection, SelectionMode, SelectionBehavior, DisabledBehavior, Orientation, CollectionEntry, CollectionItem } from "../_adapters/collections.ts";
export type { CollectionSection } from "../_adapters/collections.ts";
export type { SelectableOptions, LinkBehavior } from "../_adapters/selection.ts";
export { isSection, textOf, flatItems } from "../_adapters/collections.ts";

/** An item of a data-driven collection (alias of `CollectionItem`). */
export type Item = CollectionItem;

export interface ListState extends SelectableCollection {
  /** Id of the collection element; option ids are `<id>-option-<key>`. */
  readonly id: string;
}

export interface ListProps extends MultipleSelectionStateProps, SelectableOptions {
  /** Data items: their `disabled` flags join `disabledKeys`; the first enabled / selected item is the initial tab stop. */
  items?: readonly CollectionEntry[] | (() => readonly CollectionEntry[]);
  id?: string;
  onAction?: (key: Key) => void;
  /** Initial focused key (default: none for virtual focus, else the first selected or first enabled item). */
  focusedKey?: Key | null;
  /** @deprecated use `selectedKeys`. */
  selected?: Signal<Set<Key>>;
  /** @deprecated use `defaultSelectedKeys`. */
  defaultSelected?: Iterable<Key>;
  /** @deprecated use `selectOnFocus` (or `selectionBehavior: "replace"`). */
  followFocus?: boolean;
}

const entriesOf = (items: ListProps["items"]): readonly CollectionEntry[] =>
  typeof items === "function" ? untrack(items) : (items ?? []);

/** react-stately `useListState`: multiple selection + focus over a collection. */
export function createListState(props: ListProps): ListState {
  const items = flatItems(entriesOf(props.items));
  const disabledKeys = new Set<Key>(props.disabledKeys ?? []);
  for (const item of items) if (item.disabled) disabledKeys.add(item.key);
  const selectionProps: MultipleSelectionStateProps = {
    ...props,
    selectionMode: props.selectionMode ?? "single",
    disabledKeys,
    ...(props.selected && !props.selectedKeys ? { selectedKeys: props.selected as Signal<Selection> } : {}),
    ...(props.defaultSelected && !props.defaultSelectedKeys ? { defaultSelectedKeys: props.defaultSelected } : {}),
  };
  const selection = createMultipleSelectionState(selectionProps);
  return withList(selection, props, items, disabledKeys);
}

export interface SingleSelectListProps extends Omit<ListProps, "selectionMode" | "selectedKeys" | "defaultSelectedKeys" | "onSelectionChange" | "disallowEmptySelection"> {
  /** Two-way selected key (RAC controlled `selectedKey`). */
  selectedKey?: Signal<Key | null>;
  defaultSelectedKey?: Key | null;
  /** Called with the selected key (also when the same key is selected again). */
  onSelectionChange?: (key: Key | null) => void;
}

export interface SingleSelectListState extends ListState {
  readonly selectedKey: Signal<Key | null>;
}

/** react-stately `useSingleSelectListState`: single selection, never empty by user action. */
export function createSingleSelectListState(props: SingleSelectListProps): SingleSelectListState {
  const items = flatItems(entriesOf(props.items));
  const disabledKeys = new Set<Key>(props.disabledKeys ?? []);
  for (const item of items) if (item.disabled) disabledKeys.add(item.key);
  const { onSelectionChange: onChange, ...rest } = props;
  const selectedKey = props.selectedKey ?? signal<Key | null>(props.defaultSelectedKey ?? null);
  const selection = createMultipleSelectionState({
    ...rest,
    selectionMode: "single",
    disallowEmptySelection: true,
    allowDuplicateSelectionEvents: true,
    disabledKeys,
    selectedKey,
    ...(onChange ? { onSelectionChange: (keys: Selection) => onChange(keys === "all" ? null : (keys.values().next().value ?? null)) } : {}),
  });
  return withList(selection, props, items, disabledKeys) as SingleSelectListState;
}

function withList(
  selection: ReturnType<typeof createMultipleSelectionState>,
  props: ListProps | SingleSelectListProps,
  items: readonly CollectionItem[],
  disabledKeys: Set<Key>,
): ListState {
  const options: SelectableOptions = {};
  const source = props as Record<string, unknown>;
  for (const name of OPTION_NAMES) if (source[name] !== undefined) (options as Record<string, unknown>)[name] = source[name];
  if ((props as ListProps).followFocus && options.selectOnFocus === undefined) options.selectOnFocus = true;
  // Initial tab stop (roving tabindex in the server HTML): first selected enabled item, else first enabled.
  if (props.focusedKey !== undefined) selection.focusedKey.set(props.focusedKey);
  else if (!options.shouldUseVirtualFocus) {
    const chosen = untrack(() => readSelection(selection));
    // One pass, no copy of the item list: the first enabled chosen item ends it, else the first enabled one stays.
    let first: CollectionItem | undefined;
    for (const item of items) {
      if (disabledKeys.has(item.key)) continue;
      if (chosen === "all" || chosen.has(item.key)) {
        first = item;
        break;
      }
      first ??= item;
    }
    if (first) selection.focusedKey.set(first.key);
  }
  return {
    ...selection,
    id: props.id ?? createId(),
    options,
    ...(props.onAction ? { onAction: props.onAction } : {}),
  };
}

const OPTION_NAMES = [
  "shouldFocusWrap",
  "disallowEmptySelection",
  "disallowSelectAll",
  "escapeKeyBehavior",
  "selectOnFocus",
  "disallowTypeAhead",
  "shouldUseVirtualFocus",
  "allowsTabNavigation",
  "linkBehavior",
  "orientation",
  "layout",
  "shouldSelectOnPressUp",
  "allowsDifferentPressOrigin",
  "shouldFocusOnHover",
] as const satisfies readonly (keyof SelectableOptions)[];

// ---------------------------------------------------------------------------------------------
// Render accessors (server + bindings). They read signals: call them inside attribute bindings.
// ---------------------------------------------------------------------------------------------

/** react-aria `getItemId`: `<list id>-option-<key without whitespace>`. */
export const getItemId = (state: { id: string }, key: Key): string => `${state.id}-option-${typeof key === "string" ? key.replace(/\s*/g, "") : String(key)}`;

/** `aria-selected` of an option: absent with selection mode "none". */
export const itemSelected = (state: ListState, key: Key, disabled = false): boolean | undefined =>
  state.selectionMode === "none" ? undefined : isKeySelected(state, key, disabled);

/** Whether the item is disabled for every interaction (`aria-disabled`, `data-disabled`). */
export const itemDisabled = (state: ListState, key: Key, disabled = false): boolean => isKeyDisabled(state, key, disabled);

/** Roving `tabindex` of an item (none with virtual focus or when disabled). */
export const itemTabIndex = (state: ListState, key: Key, disabled = false): number | undefined =>
  state.options.shouldUseVirtualFocus || isKeyDisabled(state, key, disabled) ? undefined : isFocusedKey(state, key) ? 0 : -1;

/** `data-focused` of an item: the collection is focused and this is its focused key (keyed read first: only the
 * focused item re-runs when the collection's focus changes). */
export const itemFocused = (state: ListState, key: Key): boolean => isFocusedKey(state, key) && state.isFocused();

/** `tabindex` of the collection element: tabbable while no item is the focus target. */
export const collectionTabIndex = (state: ListState): number | undefined =>
  state.options.shouldUseVirtualFocus ? undefined : state.focusedKey() == null ? 0 : -1;

/** RAC `linkBehavior` default of a ListBox: "action" with `selectionBehavior="replace"`, else "override". */
export function listBoxLinkBehavior(selectionBehavior: SelectionBehavior = "toggle", linkBehavior?: LinkBehavior): LinkBehavior {
  let behavior = linkBehavior || (selectionBehavior === "replace" ? "action" : "override");
  // "action" cannot work with "toggle" (no way to start selecting): links are not selectable then.
  if (selectionBehavior === "toggle" && behavior === "action") behavior = "override";
  return behavior;
}
