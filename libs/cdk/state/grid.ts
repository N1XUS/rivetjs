// Ported from @react-stately/grid (useGridState.ts), Apache-2.0, © Adobe.
//
// Rivet:
// - The state is split like every cdk list state: `createGridState(props)` returns the serializable
//   part (selection + focus signals, disabled keys, focus mode); `gridState(data, collection)`
//   derives react-stately's `GridState` view (`{ collection, disabledKeys, selectionManager,
//   isKeyboardNavigationDisabled }`) per use — inside a handler or a binding — because the
//   collection and the `SelectionManager` are class instances (never captured in resumable
//   closures).
// - react-stately overrides `selectionState.setFocusedKey` for `focusMode: "cell"` (an item key
//   focuses its first / last cell); here `GridSelectionManager.setFocusedKey` does the same.
// - The "reset focused key when the focused item is deleted" effect is `resetGridFocusedKey(state,
//   previousCollection, collection)`: call it when the collection changes (component region
//   re-render / after a data update), with the previous collection.
import { untrack, type Signal } from "@rivetjs/reactivity";
import { getChildNodes, getFirstItem, getLastItem } from "../collections/nodes.ts";
import type { Collection, FocusStrategy, Key, Node } from "../collections/types.ts";
import type { GridNode, IGridCollection } from "../collections/grid.ts";
import { SelectionManager, type SelectionManagerOptions } from "../selection/manager.ts";
import {
  createMultipleSelectionState,
  setFocusedKey as setStateFocusedKey,
  type MultipleSelectionState,
  type MultipleSelectionStateProps,
} from "../selection/state.ts";

export type { GridNode, IGridCollection } from "../collections/grid.ts";

/** react-stately `GridState`: the derived view the grid hooks read. */
export interface GridState<T, C extends IGridCollection<T>> {
  collection: C;
  /** A set of keys for rows that are disabled. */
  disabledKeys: Set<Key>;
  /** A selection manager to read and update row selection state. */
  selectionManager: SelectionManager;
  /**
   * Whether keyboard navigation is disabled, such as when the arrow keys should be handled by a
   * component within a cell.
   */
  isKeyboardNavigationDisabled: boolean;
}

export interface GridStateOptions extends MultipleSelectionStateProps {
  disabledKeys?: Iterable<Key> | undefined;
  focusMode?: "row" | "cell" | undefined;
  /** @private - Do not use unless you know what you're doing. */
  UNSAFE_selectionState?: MultipleSelectionState | undefined;
}

/** The serializable part of a grid state (signals + plain data). */
export interface GridStateData {
  /** Selection + focus state. */
  readonly selectionState: MultipleSelectionState;
  /** A set of keys for rows that are disabled. */
  readonly disabledKeys: Set<Key>;
  readonly focusMode: "row" | "cell" | undefined;
  /** Table: arrow keys handled by a component inside a cell (resizer). Grid: always false. */
  readonly keyboardNavigationDisabled?: Signal<boolean> | undefined;
}

/**
 * Provides state management for a grid component (react-stately `useGridState`). Handles row
 * selection and focusing a grid cell's focusable child if applicable.
 */
export function createGridState(props: GridStateOptions = {}): GridStateData {
  const selectionState = props.UNSAFE_selectionState ?? createMultipleSelectionState(props);
  return {
    selectionState,
    disabledKeys: props.disabledKeys ? new Set(props.disabledKeys) : new Set<Key>(),
    focusMode: props.focusMode,
  };
}

/**
 * A `SelectionManager` whose `setFocusedKey` focuses a row's first / last cell when the grid's
 * focus mode is "cell" (react-stately overrides `selectionState.setFocusedKey`).
 */
export class GridSelectionManager extends SelectionManager {
  readonly focusMode: "row" | "cell" | undefined;
  private readonly gridCollection: Collection<Node<unknown>>;
  private readonly managerOptions: SelectionManagerOptions | undefined;

  constructor(
    collection: Collection<Node<unknown>>,
    state: MultipleSelectionState,
    focusMode: "row" | "cell" | undefined,
    options?: SelectionManagerOptions,
  ) {
    super(collection, state, options);
    this.focusMode = focusMode;
    this.gridCollection = collection;
    this.managerOptions = options;
  }

  override setFocusedKey(key: Key | null, childFocusStrategy?: FocusStrategy): void {
    if (key != null && !this.collection.getItem(key)) return;
    setStateFocusedKey(this.selectionState, gridFocusKey(this.gridCollection, this.focusMode, key, childFocusStrategy), childFocusStrategy);
  }

  override withCollection(collection: Collection<Node<unknown>>): SelectionManager {
    return new GridSelectionManager(collection, this.selectionState, this.focusMode, {
      ...this.managerOptions,
      fullCollection: this.managerOptions?.fullCollection ?? this.gridCollection,
    });
  }
}

/** The key `setFocusedKey(key, child)` really focuses: in "cell" focus mode an item key → its first / last cell. */
export function gridFocusKey(
  collection: Collection<Node<unknown>>,
  focusMode: "row" | "cell" | undefined,
  key: Key | null,
  child?: FocusStrategy | null,
): Key | null {
  // If focusMode is cell and an item is focused, focus a child cell instead.
  if (focusMode === "cell" && key != null) {
    const item = collection.getItem(key);
    if (item?.type === "item") {
      const children = getChildNodes(item, collection);
      if (child === "last") key = getLastItem(children)?.key ?? null;
      else key = getFirstItem(children)?.key ?? null;
    }
  }
  return key;
}

/** The react-stately `GridState` view of `data` over `collection` (build per handler / binding). */
export function gridState<T, C extends IGridCollection<T>>(data: GridStateData, collection: C, options?: SelectionManagerOptions): GridState<T, C> {
  return {
    collection,
    disabledKeys: data.disabledKeys,
    selectionManager: new GridSelectionManager(collection as unknown as Collection<Node<unknown>>, data.selectionState, data.focusMode, options),
    isKeyboardNavigationDisabled: false,
  };
}

/**
 * Reset the focused key if that item was deleted from the collection (react-stately's effect):
 * focus the nearest focusable row at or after the deleted position, else before it, keeping the
 * cell index when a cell was focused.
 */
export function resetGridFocusedKey<T>(data: GridStateData, cachedCollection: IGridCollection<T> | null | undefined, collection: IGridCollection<T>): void {
  const selectionState = data.selectionState;
  const focusedKey = untrack(selectionState.focusedKey);
  if (focusedKey == null || !cachedCollection || collection.getItem(focusedKey)) return;
  const manager = gridState<T, IGridCollection<T>>(data, collection).selectionManager;
  const set = (key: Key | null) => setStateFocusedKey(selectionState, gridFocusKey(collection as never, data.focusMode, key));
  const node = cachedCollection.getItem(focusedKey);
  const parentNode =
    node?.parentKey != null && (node.type === "cell" || node.type === "rowheader" || node.type === "column") ? cachedCollection.getItem(node.parentKey) : node;
  if (!parentNode) {
    set(null);
    return;
  }
  const cachedRows = cachedCollection.rows;
  const rows = collection.rows;
  const diff = cachedRows.length - rows.length;
  const index = Math.min(diff > 1 ? Math.max(parentNode.index - diff + 1, 0) : parentNode.index, rows.length - 1);
  let newRow: GridNode<T> | null = null;
  // Find the nearest focusable row at or after the deleted position...
  for (let i = Math.max(0, index); i < rows.length; i++) {
    if (!manager.isDisabled(rows[i]!.key) && rows[i]!.type !== "headerrow") {
      newRow = rows[i]!;
      break;
    }
  }
  // ...otherwise the nearest focusable row before it. (Mirrors useListState's getKeyAfter/getKeyBefore walk.)
  if (newRow === null) {
    for (let i = index - 1; i >= 0; i--) {
      if (!manager.isDisabled(rows[i]!.key) && rows[i]!.type !== "headerrow") {
        newRow = rows[i]!;
        break;
      }
    }
  }
  if (newRow) {
    const childNodes = newRow.hasChildNodes ? [...getChildNodes(newRow, collection as never)] : [];
    const keyToFocus = newRow.hasChildNodes && parentNode !== node && node && node.index < childNodes.length ? childNodes[node.index]!.key : newRow.key;
    set(keyToFocus);
  } else set(null);
}
