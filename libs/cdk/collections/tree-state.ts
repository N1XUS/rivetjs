// Ported from @react-stately/tree (useTreeState.ts), Apache-2.0, © Adobe.
//
// Tree state: a TreeCollection built from `items` / `children` (only expanded rows are visible to
// keyboard navigation) plus expanded keys and multiple-selection + focus state.
//
// Rivet: the state is serializable (signals + plain data); the collection and SelectionManager are
// derived on demand by `treeCollection(state)` / `treeSelectionManager(state)` (cached per state,
// items array and expanded-keys set), as in `@rivetjs/cdk/state/list`.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { CollectionBuilder, createCollection } from "./builder.ts";
import { TreeCollection } from "./tree.ts";
import type { Collection, CollectionChildren, Key, Node } from "./types.ts";
import { SelectionManager } from "../selection/manager.ts";
import { createMultipleSelectionState, type MultipleSelectionState, type MultipleSelectionStateProps } from "../selection/state.ts";

export interface TreeProps<T> extends MultipleSelectionStateProps {
  /** Item objects (array or accessor of one), rendered by `children`. */
  items?: Iterable<T> | (() => Iterable<T>) | undefined;
  /** Static `Item(…)` / `Section(…)` elements, or a renderer for `items`. */
  children?: CollectionChildren<NoInfer<T>> | undefined;
  /**
   * A pre-built collection (RAC `Tree` passes its flattened, expanded-aware collection) or an
   * accessor of one (`collectionOf`); used as is instead of building from `items` / `children`.
   */
  collection?: Collection<Node<T>> | (() => Collection<Node<T>>) | undefined;
  /** Expanded keys: a signal (two-way), a plain value or an accessor returning a Set (controlled). */
  expandedKeys?: Signal<Set<Key>> | (() => Set<Key>) | Iterable<Key> | undefined;
  /** Initially expanded keys (uncontrolled). */
  defaultExpandedKeys?: Iterable<Key> | undefined;
  /** Handler that is called when items are expanded or collapsed. */
  onExpandedChange?: ((keys: Set<Key>) => void) | undefined;
}

export interface TreeState<T = any> {
  /** Selection + focus state. */
  readonly selectionState: MultipleSelectionState;
  /** A set of keys for items that are disabled. */
  readonly disabledKeys: Set<Key>;
  /** A set of keys for items that are expanded. */
  readonly expandedKeys: Signal<Set<Key>>;
  readonly expandedKeysControlled: boolean;
  readonly onExpandedChange?: ((keys: Set<Key>) => void) | undefined;
  readonly items?: Iterable<T> | (() => Iterable<T>) | undefined;
  readonly children?: CollectionChildren<T> | undefined;
  readonly collection?: Collection<Node<T>> | (() => Collection<Node<T>>) | undefined;
}

const isSignal = (value: unknown): value is Signal<Set<Key>> => typeof value === "function" && typeof (value as Signal<unknown>).set === "function";

/** useTreeState: expanded keys + selection state for tree-like components. */
export function createTreeState<T>(props: TreeProps<T>): TreeState<T> {
  const prop = props.expandedKeys;
  const controlled = prop !== undefined && !isSignal(prop);
  // A Signal is two-way; an accessor (live prop, `liveKeys`: a Set) is controlled, read live, never written.
  const expandedKeys =
    typeof prop === "function" ? (prop as Signal<Set<Key>>) : signal(new Set<Key>(controlled ? (prop as Iterable<Key>) : (props.defaultExpandedKeys ?? [])));
  const disabledKeys = new Set<Key>(props.disabledKeys ?? []);
  return {
    selectionState: createMultipleSelectionState({ ...props, disabledKeys }),
    disabledKeys,
    expandedKeys,
    expandedKeysControlled: controlled,
    onExpandedChange: props.onExpandedChange,
    items: props.items,
    children: props.children as CollectionChildren<T> | undefined,
    collection: props.collection,
  };
}

const trees = new WeakMap<object, { items: unknown; expanded: Set<Key>; collection: TreeCollection<any>; builder: CollectionBuilder<any> }>();

/** The tree collection (react-stately `state.collection`); tracks `expandedKeys` and `items`. */
export function treeCollection<T>(state: TreeState<T>): TreeCollection<T> {
  const provided = state.collection;
  if (provided) return (typeof provided === "function" ? provided() : provided) as TreeCollection<T>;
  const items = typeof state.items === "function" ? state.items() : state.items;
  const expanded = state.expandedKeys();
  const cached = trees.get(state);
  if (cached && cached.items === items && cached.expanded === expanded) return cached.collection;
  const builder = cached?.builder ?? new CollectionBuilder<any>();
  const collection = createCollection<T, TreeCollection<T>>(
    { children: state.children ?? null, items: items as Iterable<T> | undefined },
    (nodes) => new TreeCollection(nodes, { expandedKeys: expanded }),
    null,
    builder,
  );
  trees.set(state, { items, expanded, collection, builder });
  return collection;
}

/** The selection manager (react-stately `state.selectionManager`). */
export function treeSelectionManager<T>(state: TreeState<T>, collection: Collection<Node<T>> = treeCollection(state)): SelectionManager {
  return new SelectionManager(collection as Collection<Node<unknown>>, state.selectionState);
}

/** Replaces the set of expanded keys. */
export function setExpandedKeys<T>(state: TreeState<T>, keys: Set<Key>): void {
  if (!state.expandedKeysControlled) state.expandedKeys.set(keys);
  state.onExpandedChange?.(keys);
}

/** Toggles the expanded state for an item by its key. */
export function toggleTreeKey<T>(state: TreeState<T>, key: Key): void {
  const res = new Set(untrack(state.expandedKeys));
  if (res.has(key)) res.delete(key);
  else res.add(key);
  setExpandedKeys(state, res);
}

/** Reset the focused key if that item was deleted from the collection (useTreeState's effect). */
export function resetTreeFocusedKey<T>(state: TreeState<T>, collection: Collection<Node<T>> = treeCollection(state)): void {
  const focusedKey = untrack(state.selectionState.focusedKey);
  if (focusedKey != null && !collection.getItem(focusedKey)) state.selectionState.focusedKey.set(null);
}
