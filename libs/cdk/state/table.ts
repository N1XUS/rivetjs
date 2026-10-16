// Ported from @react-stately/table (useTableState.ts: useTableState, UNSTABLE_useFilteredTableState),
// Apache-2.0, © Adobe.
//
// Rivet:
// - Split like `./grid.ts`: `createTableState(props)` returns the serializable part (grid data +
//   sort / expansion controlled states + keyboard-navigation-disabled signal); `tableState(data,
//   collection)` derives react-stately's `TableState` view per use (collection + SelectionManager are
//   class instances). `sort`, `toggleKey`, `setKeyboardNavigationDisabled` on the view call the free
//   functions `sortTable`, `toggleTableKey`, `setTableKeyboardNavigationDisabled`.
// - `sortDescriptor` / `expandedKeys`: plain value (controlled: only `onSortChange` /
//   `onExpandedChange` are called) or Signal (two-way) — `../interactions/controllable.ts`.
//   Upstream `sortDescriptor` is controlled only (no `defaultSortDescriptor`); same here.
// - Collection: `props.collection`, or built from `children` with the react-stately builders of
//   `../collections/table.ts` (`TableHeader` / `Column` / `TableBody` / `Row` / `Cell`) —
//   `tableCollection(props)`.
// - `UNSTABLE_useTreeGridState` (feature-flagged Spectrum treegrid) is not ported: RAC tables expand
//   rows through `expandedKeys` on this state (RAC `TableInner`).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { CollectionBuilder } from "../collections/builder.ts";
import { TableCollection as StatelyTableCollection, tableBuilderContext, type ITableCollection } from "../collections/table.ts";
import type { CollectionChildren, Key, Node, SortDescriptor, SortDirection } from "../collections/types.ts";
import type { SelectionManagerOptions } from "../selection/manager.ts";
import { createGridState, gridState, type GridState, type GridStateData, type GridStateOptions } from "./grid.ts";

export type { ITableCollection } from "../collections/table.ts";

export interface TableState<T> extends GridState<T, ITableCollection<T>> {
  /** A collection of rows and columns in the table. */
  collection: ITableCollection<T>;
  /** Whether the row selection checkboxes should be displayed. */
  showSelectionCheckboxes: boolean;
  /** The current sorted column and direction. */
  sortDescriptor: SortDescriptor | null;
  /** Calls the provided onSortChange handler with the provided column key and sort direction. */
  sort(columnKey: Key, direction?: "ascending" | "descending"): void;
  /** Whether keyboard navigation is disabled, such as when the arrow keys should be handled by a component within a cell. */
  isKeyboardNavigationDisabled: boolean;
  /** Set whether keyboard navigation is disabled, such as when the arrow keys should be handled by a component within a cell. */
  setKeyboardNavigationDisabled: (val: boolean) => void;
  /** A set of keys for items that are expanded. */
  expandedKeys: Set<Key>;
  /** Toggles the expanded state for a row by its key. */
  toggleKey(key: Key): void;
  /** The id of the column that displays hierarchical data. */
  treeColumn: Key | null;
}

export interface TableStateProps<T> extends GridStateOptions {
  /** The elements that make up the table (react-stately builders: TableHeader, TableBody, Column, Row, Cell). */
  children?: CollectionChildren<T> | undefined;
  /** A pre-constructed collection to use instead of building one from children. */
  collection?: ITableCollection<T> | undefined;
  /** Whether the row selection checkboxes should be displayed. */
  showSelectionCheckboxes?: boolean | undefined;
  /** @private Whether the row drag button should be displayed. */
  showDragButtons?: boolean | undefined;
  /** The id of the column that displays hierarchical data. */
  treeColumn?: Key | undefined;
  /** The current sorted column and direction (plain: controlled; Signal: two-way). */
  sortDescriptor?: SortDescriptor | Signal<SortDescriptor | null> | null | undefined;
  /** Handler that is called when the sorted column or direction changes. */
  onSortChange?: ((descriptor: SortDescriptor) => any) | undefined;
  /** The currently expanded keys in the collection (controlled). */
  expandedKeys?: Iterable<Key> | Signal<Set<Key>> | undefined;
  /** The initial expanded keys in the collection (uncontrolled). */
  defaultExpandedKeys?: Iterable<Key> | undefined;
  /** Handler that is called when items are expanded or collapsed. */
  onExpandedChange?: ((keys: Set<Key>) => any) | undefined;
}

/** The serializable part of a table state. */
export interface TableStateData extends GridStateData {
  readonly showSelectionCheckboxes: boolean;
  readonly showDragButtons: boolean;
  readonly treeColumn: Key | null;
  readonly sortDescriptor: ControlledState<SortDescriptor | null, SortDescriptor>;
  readonly expandedKeys: ControlledState<Set<Key>>;
  readonly keyboardNavigationDisabled: Signal<boolean>;
}

const isSignal = (v: unknown): v is Signal<unknown> => typeof v === "function" && typeof (v as Signal<unknown>).set === "function";

/**
 * Provides state management for a table component (react-stately `useTableState`): row selection,
 * sort order changes, expanded rows, keyboard-navigation-disabled flag.
 */
export function createTableState<T>(props: TableStateProps<T> = {}): TableStateData {
  const grid = createGridState({ ...props, disabledBehavior: props.disabledBehavior || "selection" });
  const expanded = props.expandedKeys;
  return {
    ...grid,
    showSelectionCheckboxes: props.showSelectionCheckboxes || false,
    showDragButtons: !!props.showDragButtons,
    treeColumn: props.treeColumn ?? null,
    sortDescriptor: controllable<SortDescriptor | null, SortDescriptor>(props.sortDescriptor ?? null, null, props.onSortChange),
    expandedKeys: controllable<Set<Key>>(
      // A Signal is two-way; an accessor (live prop, `liveKeys`: a Set) is controlled, read live.
      expanded == null ? undefined : typeof expanded === "function" ? (expanded as Signal<Set<Key>>) : new Set(expanded as Iterable<Key>),
      props.defaultExpandedKeys ? new Set(props.defaultExpandedKeys) : new Set(),
      props.onExpandedChange,
    ),
    keyboardNavigationDisabled: signal(false),
  };
}

const OPPOSITE_SORT_DIRECTION: Record<SortDirection, SortDirection> = { ascending: "descending", descending: "ascending" };

/** `state.sort(columnKey, direction?)`: calls `onSortChange` (and writes a Signal `sortDescriptor`). */
export function sortTable(data: TableStateData, columnKey: Key, direction?: SortDirection): void {
  const current = untrack(() => controlledValue(data.sortDescriptor));
  setControlledValue(data.sortDescriptor, {
    column: columnKey,
    direction: direction ?? (current?.column === columnKey ? OPPOSITE_SORT_DIRECTION[current.direction] : "ascending"),
  });
}

/** `state.toggleKey(key)`: toggles the expanded state of a row. */
export function toggleTableKey(data: TableStateData, key: Key): void {
  setControlledValue(data.expandedKeys, (keys: Set<Key>) => {
    const newKeys = new Set(keys);
    if (newKeys.has(key)) newKeys.delete(key);
    else newKeys.add(key);
    return newKeys;
  });
}

/** `state.setKeyboardNavigationDisabled(val)`. */
export function setTableKeyboardNavigationDisabled(data: TableStateData, val: boolean): void {
  data.keyboardNavigationDisabled.set(val);
}

/** The react-stately `TableState` view over `collection` (build per handler / binding; reads signals). */
export function tableState<T>(data: TableStateData, collection: ITableCollection<T>, options?: SelectionManagerOptions): TableState<T> {
  const grid = gridState<T, ITableCollection<T>>(data, collection, options);
  return {
    ...grid,
    collection,
    showSelectionCheckboxes: data.showSelectionCheckboxes,
    sortDescriptor: data.sortDescriptor.value() ?? null,
    isKeyboardNavigationDisabled: collection.size === 0 || data.keyboardNavigationDisabled(),
    setKeyboardNavigationDisabled: (val) => setTableKeyboardNavigationDisabled(data, val),
    sort: (columnKey, direction) => sortTable(data, columnKey, direction),
    expandedKeys: data.expandedKeys.value(),
    toggleKey: (key) => toggleTableKey(data, key),
    treeColumn: data.treeColumn,
  };
}

const builders = new WeakMap<object, CollectionBuilder<any>>();

/**
 * Builds the table collection of `useTableState` from `children` (react-stately builders) unless a
 * `collection` is given. Pass the same `cache` object across calls to reuse cached nodes.
 */
export function tableCollection<T>(props: TableStateProps<T>, cache?: object): ITableCollection<T> {
  if (props.collection) return props.collection;
  const context = tableBuilderContext<T>({
    showSelectionCheckboxes: props.showSelectionCheckboxes,
    showDragButtons: props.showDragButtons,
    selectionMode: props.selectionMode,
  });
  let builder = cache ? builders.get(cache) : undefined;
  if (!builder) {
    builder = new CollectionBuilder<any>();
    if (cache) builders.set(cache, builder);
  }
  const nodes = builder.build({ children: (props.children ?? null) as never }, context);
  return new StatelyTableCollection<T>(nodes as Iterable<never>, null, context);
}

/**
 * Filters a collection using the provided filter function and returns a new TableState
 * (react-stately `UNSTABLE_useFilteredTableState`).
 */
export function filteredTableState<T>(state: TableState<T>, filterFn: ((nodeValue: string, node: Node<T>) => boolean) | null | undefined): TableState<T> {
  const collection = (filterFn ? (state.collection as any).filter?.(filterFn) ?? state.collection : state.collection) as ITableCollection<T>;
  const selectionManager = state.selectionManager.withCollection(collection as never) as TableState<T>["selectionManager"];
  // TODO (upstream): handle focus key reset? That logic is in useGridState
  return { ...state, collection, selectionManager };
}
