// Ported from @react-stately/table (useTableColumnResizeState.ts), Apache-2.0, © Adobe. The column
// width math (TableColumnLayout.ts + TableUtils.ts) is the shared port in
// `../virtualizer/table-column-layout.ts`.
//
// Rivet:
// - `createTableColumnResizeState(props)` returns the serializable part (signals: table width, the
//   resizing column, the uncontrolled widths `Map` + the column keys they belong to);
//   `tableColumnResizeState(data, state)` derives react-stately's `TableColumnResizeState` view over a
//   `TableState` view (`./table.ts`): widths are rebuilt per use from the collection's columns
//   (`TableColumnLayout.buildColumnWidths`, O(columns)).
// - Upstream resets the uncontrolled widths when the columns change (by key, during render); here the
//   stored widths are used only while the column keys match, else the initial widths apply (no write
//   during a read); the next `updateResizedColumns` stores widths for the new columns.
// - `getDefaultWidth` / `getDefaultMinWidth` must be resumable functions (inline arrows / local consts).
import { batch, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { TableColumnLayout, type ColumnSize } from "../virtualizer/table-column-layout.ts";
import type { GridNode } from "../collections/grid.ts";
import type { Key } from "../collections/types.ts";
import type { TableState } from "./table.ts";

export type { ColumnSize } from "../virtualizer/table-column-layout.ts";

export interface TableColumnResizeStateProps<T> {
  /** Current width of the table or table viewport that the columns should be calculated against. */
  tableWidth: number | Signal<number> | (() => number);
  /** A function that is called to find the default width for a given column. */
  getDefaultWidth?: ((node: GridNode<T>) => ColumnSize | null | undefined) | undefined;
  /** A function that is called to find the default minWidth for a given column. */
  getDefaultMinWidth?: ((node: GridNode<T>) => ColumnSize | null | undefined) | undefined;
}

export interface TableColumnResizeState<T> {
  /** Called to update the state that a resize event has occurred. Returns the new widths for all columns based on the resized column. */
  updateResizedColumns: (key: Key, width: number) => Map<Key, ColumnSize>;
  /** Callback for when onColumnResize has started. */
  startResize: (key: Key) => void;
  /** Callback for when onColumnResize has ended. */
  endResize: () => void;
  /** Gets the current width for the specified column. */
  getColumnWidth: (key: Key) => number;
  /** Gets the current minWidth for the specified column. */
  getColumnMinWidth: (key: Key) => number;
  /** Gets the current maxWidth for the specified column. */
  getColumnMaxWidth: (key: Key) => number;
  /** Key of the currently resizing column. */
  resizingColumn: Key | null;
  /** A reference to the table state. */
  tableState: TableState<T>;
  /** A map of the current column widths. */
  columnWidths: Map<Key, number>;
}

/** The serializable part of a column resize state. */
export interface TableColumnResizeStateData<T = unknown> {
  readonly tableWidth: number | Signal<number> | (() => number);
  readonly getDefaultWidth: ((node: GridNode<T>) => ColumnSize | null | undefined) | undefined;
  readonly getDefaultMinWidth: ((node: GridNode<T>) => ColumnSize | null | undefined) | undefined;
  /** Key of the currently resizing column. */
  readonly resizingColumn: Signal<Key | null>;
  /** Uncontrolled column widths, and the column keys (joined) they were computed for. */
  readonly uncontrolled: Signal<{ columns: string; widths: Map<Key, ColumnSize> } | null>;
}

/** Column width state for a table with column resizing (react-stately `useTableColumnResizeState`). */
export function createTableColumnResizeState<T>(props: TableColumnResizeStateProps<T>): TableColumnResizeStateData<T> {
  return {
    tableWidth: props.tableWidth ?? 0,
    getDefaultWidth: props.getDefaultWidth,
    getDefaultMinWidth: props.getDefaultMinWidth,
    resizingColumn: signal<Key | null>(null),
    uncontrolled: signal<{ columns: string; widths: Map<Key, ColumnSize> } | null>(null),
  };
}

const readWidth = (w: TableColumnResizeStateData["tableWidth"]): number => (typeof w === "function" ? w() : w) ?? 0;
const columnsId = (columns: readonly GridNode<unknown>[]): string => columns.map((c) => typeof c.key + ":" + String(c.key)).join("\u0000");

/** The uncontrolled widths in effect for `columns` (stored ones while the column keys match, else initial). */
function uncontrolledWidths<T>(data: TableColumnResizeStateData<T>, layout: TableColumnLayout<T>, columns: GridNode<T>[]): Map<Key, ColumnSize> {
  const [, uncontrolledColumns] = layout.splitColumnsIntoControlledAndUncontrolled(columns as never);
  const stored = data.uncontrolled();
  if (stored && stored.columns === columnsId(columns as GridNode<unknown>[])) return stored.widths;
  return layout.getInitialUncontrolledWidths(uncontrolledColumns);
}

/** `startResize(key)`. */
export function startColumnResize(data: TableColumnResizeStateData<any>, key: Key): void {
  data.resizingColumn.set(key);
}

/** `endResize()`. */
export function endColumnResize(data: TableColumnResizeStateData<any>): void {
  data.resizingColumn.set(null);
}

/**
 * The react-stately `TableColumnResizeState` view over a `TableState` view: current column widths
 * for the table width, min / max widths, resizing column, and the update callbacks.
 */
export function tableColumnResizeState<T>(data: TableColumnResizeStateData<T>, state: TableState<T>): TableColumnResizeState<T> {
  const layout = new TableColumnLayout<T>({ getDefaultWidth: data.getDefaultWidth as never, getDefaultMinWidth: data.getDefaultMinWidth as never });
  const columns = state.collection.columns;
  const [controlledColumns, uncontrolledColumns] = layout.splitColumnsIntoControlledAndUncontrolled(columns as never);
  const widths = uncontrolledWidths(data, layout, columns);
  // combine columns back into one map that maintains same order as the columns
  const colWidths = layout.recombineColumns(columns as never, widths, uncontrolledColumns, controlledColumns);
  const columnWidths = layout.buildColumnWidths(readWidth(data.tableWidth), state.collection as never, colWidths);

  const updateResizedColumns = (key: Key, width: number): Map<Key, ColumnSize> => {
    const current = untrack(() => uncontrolledWidths(data, layout, columns));
    const newSizes = layout.resizeColumnWidth(state.collection as never, current, key, width);
    const map = new Map(Array.from(uncontrolledColumns).map(([key]) => [key, newSizes.get(key)!]));
    map.set(key, width);
    batch(() => data.uncontrolled.set({ columns: columnsId(columns as GridNode<unknown>[]), widths: map }));
    return newSizes;
  };

  return {
    resizingColumn: data.resizingColumn(),
    updateResizedColumns,
    startResize: (key) => startColumnResize(data, key),
    endResize: () => endColumnResize(data),
    getColumnWidth: (key) => layout.getColumnWidth(key),
    getColumnMinWidth: (key) => layout.getColumnMinWidth(key),
    getColumnMaxWidth: (key) => layout.getColumnMaxWidth(key),
    tableState: state,
    columnWidths,
  };
}
