// Ported from @react-stately/list (useListState.ts, useSingleSelectListState.ts), Apache-2.0, © Adobe.
//
// List state (collection-class form) for list-like components: ListBox, Select, ComboBox, Menu, GridList, TagGroup:
// `items` / `children` (or DOM / pre-built collection) plus multiple-selection + focus state.
//
// Rivet: the state object is serializable (signals + plain data + resumable functions). The
// collection and the `SelectionManager` are class instances, so they are derived on demand:
// `listCollection(state)` / `listSelectionManager(state)` (cached per state and items array; a
// resumed handler rebuilds them from the state). React's `state.selectionManager.x` is
// `listSelectionManager(state).x`.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/cdk/id";
import { CollectionBuilder, Item as CollectionItem, createCollection } from "@rivetjs/cdk/collections/builder";
import { ListCollection } from "@rivetjs/cdk/collections/list";
import type { Collection, CollectionChildren, CollectionElement, Key, LayoutDelegate, Node } from "@rivetjs/cdk/collections/types";
import { SelectionManager } from "@rivetjs/cdk/selection/manager";
import { createMultipleSelectionState, type MultipleSelectionState, type MultipleSelectionStateProps } from "@rivetjs/cdk/selection/state";
import { BaseCollection } from "@rivetjs/cdk/collections/base";
import { domCollection } from "@rivetjs/cdk/collections/dom";
import { isSlot } from "@rivetjs/runtime/slot";

export type { Key, SelectionMode } from "@rivetjs/cdk/collections/types";

/** An item of a data-driven collection (Rivet shorthand: rendered with a default `Item`). */
export interface Item {
  readonly key: Key;
  /** Visible label (default render) and typeahead / filter text. */
  readonly label: string;
  readonly disabled?: boolean;
  /** Link items (Menu): rendered as `<a href>`. */
  readonly href?: string;
  /** Secondary text (rendered as the description slot). */
  readonly description?: string;
}

export interface ListProps<T> extends MultipleSelectionStateProps {
  /** Item objects (array or accessor of one). */
  items?: readonly T[] | (() => readonly T[]) | undefined;
  /**
   * Collection elements, or a renderer `(item) => Item({...})` for `items`. Default: items render
   * as `Item({ key: item.key ?? item.id, textValue: item.textValue ?? item.label ?? item.name,
   * children: item.label ?? item.name, isDisabled: item.isDisabled ?? item.disabled, href })`.
   */
  children?: CollectionChildren<NoInfer<T>> | ((...args: any[]) => unknown) | undefined;
  /**
   * A pre-constructed collection (RAC hosts: `collectionOf(content)` accessor, BaseCollection, …).
   * Without `collection` / `items` / `children` the collection is read from the DOM of the host
   * element (live RAC parts, `listCollection(state, root)`).
   */
  collection?: Collection<Node<T>> | (() => Collection<Node<T>>) | undefined;
  /** Filter function to generate a filtered list of nodes. */
  filter?: ((nodes: Iterable<Node<T>>) => Iterable<Node<T>>) | undefined;
  /** @private */
  suppressTextValueWarning?: boolean | undefined;
  /** A delegate object that provides layout information (overrides shift selection ranges). */
  layoutDelegate?: LayoutDelegate | undefined;
  /** Rivet: id of the collection element (`data-collection`); option ids are `<id>-option-<key>`. */
  id?: string | undefined;
}

export interface ListState<T = any> {
  /** Id of the collection element. */
  readonly id: string;
  /** Selection + focus state (serializable). */
  readonly selectionState: MultipleSelectionState;
  /** A set of items that are disabled. */
  readonly disabledKeys: Set<Key>;
  /** Builder inputs (kept so handlers can rebuild the collection after resume). */
  readonly items: readonly T[] | (() => readonly T[]) | undefined;
  readonly children: CollectionChildren<T> | undefined;
  readonly collection: Collection<Node<T>> | (() => Collection<Node<T>>) | undefined;
  readonly filter: ((nodes: Iterable<Node<T>>) => Iterable<Node<T>>) | undefined;
  readonly suppressTextValueWarning: boolean;
  readonly layoutDelegate: LayoutDelegate | undefined;
}

/** Default renderer for `items` without `children`: `{ key | id, label | name | textValue, … }` objects. */
export function defaultItemRenderer(item: any): CollectionElement {
  const label = item.label ?? item.name ?? item.textValue ?? "";
  return CollectionItem({
    key: item.key ?? item.id,
    textValue: item.textValue ?? (typeof label === "string" ? label : ""),
    children: label,
    isDisabled: item.isDisabled ?? item.disabled,
    href: item.href,
    description: item.description,
  });
}

/** `children` as collection children: elements (a compiler slot is resolved) or a renderer. */
function collectionChildren<T>(children: ListProps<T>["children"]): CollectionChildren<T> | undefined {
  if (children == null) return undefined;
  return (isSlot(children) ? children() : children) as CollectionChildren<T>;
}

/**
 * Provides state management for list-like components (react-stately `useListState`): builds the
 * collection inputs, and manages multiple selection + focus state.
 */
export function createListState<T = Item>(options: ListProps<T>): ListState<T> {
  const disabledKeys = new Set<Key>(options.disabledKeys ?? []);
  const selectionState = createMultipleSelectionState({ ...options, disabledKeys });
  return {
    id: options.id ?? createId(),
    selectionState,
    disabledKeys,
    items: options.items,
    children: collectionChildren(options.children),
    collection: options.collection,
    filter: options.filter,
    suppressTextValueWarning: !!options.suppressTextValueWarning,
    layoutDelegate: options.layoutDelegate,
  };
}

const collections = new WeakMap<object, { items: unknown; collection: Collection<Node<any>>; builder: CollectionBuilder<any> }>();

/**
 * The collection of a list state (react-stately `state.collection`). Rebuilt when the items array
 * changes; reads `items` when it is an accessor (tracked in bindings).
 */
export function listCollection<T>(state: ListState<T>, root?: Element | null): Collection<Node<T>> {
  const provided = state.collection;
  if (provided) return typeof provided === "function" ? provided() : provided;
  if (state.items == null && state.children == null) {
    // Live RAC parts: the rendered items are the collection.
    const el = root ?? (typeof document !== "undefined" ? document.getElementById(state.id) : null);
    const dom = el ? domCollection<T>(el) : new BaseCollection<T>();
    return state.filter ? new ListCollection(state.filter(dom)) : dom;
  }
  const items = typeof state.items === "function" ? state.items() : state.items;
  const cached = collections.get(state);
  if (cached && cached.items === items) return cached.collection as Collection<Node<T>>;
  const builder = cached?.builder ?? new CollectionBuilder<any>();
  const children = state.children ?? (items ? (defaultItemRenderer as CollectionChildren<T>) : null);
  const collection = createCollection<T, Collection<Node<T>>>(
    { children, items: items as Iterable<T> | undefined },
    (nodes) => (state.filter ? new ListCollection(state.filter(nodes)) : new ListCollection(nodes)),
    { suppressTextValueWarning: state.suppressTextValueWarning || !state.children },
    builder,
  );
  collections.set(state, { items, collection, builder });
  return collection;
}

/** The selection manager of a list state (react-stately `state.selectionManager`). */
export function listSelectionManager<T>(state: ListState<T>, collection: Collection<Node<T>> = listCollection(state)): SelectionManager {
  return new SelectionManager(collection as Collection<Node<unknown>>, state.selectionState, { layoutDelegate: state.layoutDelegate });
}

/**
 * Reset the focused key when its item left the collection (react-stately `useFocusedKeyReset`):
 * walk forward in the previous collection to the next key still present and enabled, else
 * backward. Call from an effect when the items change.
 */
export function resetFocusedKey<T>(state: ListState<T>, previous: Collection<Node<T>>, collection: Collection<Node<T>> = listCollection(state)): void {
  const manager = listSelectionManager(state, collection);
  const focusedKey = untrack(() => manager.focusedKey);
  if (focusedKey == null || collection.getItem(focusedKey)) return;
  let next: Key | null = null;
  for (let key = previous.getKeyAfter(focusedKey); key != null; key = previous.getKeyAfter(key)) {
    const node = collection.getItem(key);
    if (node && node.type === "item" && !manager.isDisabled(key)) {
      next = key;
      break;
    }
  }
  if (next == null) {
    for (let key = previous.getKeyBefore(focusedKey); key != null; key = previous.getKeyBefore(key)) {
      const node = collection.getItem(key);
      if (node && node.type === "item" && !manager.isDisabled(key)) {
        next = key;
        break;
      }
    }
  }
  manager.setFocusedKey(next);
}

/** Filters a list state's collection (react-stately `UNSTABLE_useFilteredListState`). */
export function filteredListCollection<T>(
  state: ListState<T>,
  filterFn: ((nodeValue: string, node: Node<T>) => boolean) | null | undefined,
): Collection<Node<T>> {
  const collection = listCollection(state);
  return filterFn && collection.filter ? collection.filter(filterFn) : collection;
}

// --- Single selection --------------------------------------------------------------------------

export interface SingleSelectListProps<T> extends Omit<
  ListProps<T>,
  | "selectionMode"
  | "selectedKeys"
  | "defaultSelectedKeys"
  | "onSelectionChange"
  | "disallowEmptySelection"
  | "selectedKey"
  | "selectedKeyControlled"
  | "onSelectedKeyChange"
> {
  /** The selected key: a signal (two-way) or a plain value (controlled). */
  selectedKey?: Signal<Key | null> | Key | null | undefined;
  /** The initial selected key (uncontrolled). */
  defaultSelectedKey?: Key | null | undefined;
  /** Handler that is called when the selection changes (always, even for the same key). */
  onSelectionChange?: ((key: Key | null) => void) | undefined;
}

export interface SingleSelectListState<T = any> extends ListState<T> {
  /** The key for the currently selected item. */
  readonly selectedKey: Signal<Key | null>;
}

const isKeySignal = (value: unknown): value is Signal<Key | null> => typeof value === "function" && typeof (value as Signal<Key>).set === "function";

/**
 * Provides state management for list-like components with single selection (react-stately
 * `useSingleSelectListState`): the selection is backed by `selectedKey`; disallowEmptySelection,
 * and onSelectionChange fires even when the same key is chosen again.
 */
export function createSingleSelectListState<T = Item>(options: SingleSelectListProps<T>): SingleSelectListState<T> {
  const prop = options.selectedKey;
  const controlled = prop !== undefined && !isKeySignal(prop);
  const selectedKey: Signal<Key | null> = isKeySignal(prop) ? prop : signal(controlled ? (prop as Key | null) : (options.defaultSelectedKey ?? null));
  const { onSelectionChange, ...rest } = options;
  const state = createListState<T>({
    ...(rest as ListProps<T>),
    selectionMode: "single",
    disallowEmptySelection: true,
    allowDuplicateSelectionEvents: true,
    selectedKey,
    selectedKeyControlled: controlled,
    onSelectedKeyChange: onSelectionChange,
  });
  return { ...state, selectedKey };
}

/** The selected item node (react-stately `state.selectedItem`). Reads the selection. */
export function selectedItem<T>(state: SingleSelectListState<T>, collection?: Collection<Node<T>>): Node<T> | null {
  const key = state.selectedKey();
  return key != null ? (collection ?? listCollection(state)).getItem(key) : null;
}

/** Sets the selected key (react-stately `state.setSelectedKey`). */
export function setSelectedKey<T>(state: SingleSelectListState<T>, key: Key | null): void {
  // react-stately: the controlled-state setter (onSelectionChange when the key changes).
  const { selectionState } = state;
  if (untrack(state.selectedKey) === key) return;
  if (!selectionState.selectedKeyControlled) state.selectedKey.set(key);
  selectionState.onSelectedKeyChange?.(key);
}
