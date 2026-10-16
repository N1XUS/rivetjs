// Ported from @react-aria/table (useTable.ts, useTableColumnHeader.ts, useTableRow.ts,
// useTableHeaderRow.ts, useTableCell.ts, useTableSelectionCheckbox.ts, useTableRowGroup.ts,
// utils.ts), Apache-2.0, © Adobe.
//
// Rivet (cdk hook naming convention): `useX` → `xProps(props, state)` returning react-aria's bag(s)
// with values computed from the `TableState` view passed in (`../state/table.ts` `tableState(data,
// collection)`: call inside a binding / accessor for reactivity); react-aria's handlers → free
// functions `x<Event>(event, props, state)` called from inline arrows (resumable). The bags hold no
// closures (react-aria's `expandButtonProps.onPress` → `tableRowExpandPress`, `checkboxProps.onChange`
// → `tableSelectionCheckboxChange` / `tableSelectAllCheckboxChange`).
// - react-aria `gridIds` (WeakMap keyed by the state) → `state.gridId` on the view (views are rebuilt
//   per use); `gridIds` stays as the fallback for long-lived state objects. Same for `gridMap`
//   (`../grid/behaviour.ts` `state.grid`).
// - `useDescription` (sort / sortable descriptions): the props take the description element ids
//   (`sortDescriptionId`, `descriptionId`) — the component renders the hidden elements
//   (`tableSortDescription`, `tableColumnSortableDescription` give the texts), so server HTML carries
//   them.
// - The sort announcement (react-aria: update effect on the sort description) runs at the end of
//   `tableColumnHeaderPress` when the sort descriptor changed.
// - useTableColumnResize (closures: press / move / keyboard machines) lives in `./column-resize.tsx`.
import { untrack } from "@rivetjs/reactivity";
import { announce } from "../announcer/live-announcer.ts";
import { formatMessage } from "../_adapters/intl.ts";
import { isAndroid } from "../platform/index.ts";
import type { Collection, Key, KeyboardDelegate, LayoutDelegate, Node } from "../collections/types.ts";
import type { GridNode } from "../collections/grid.ts";
import type { TableState } from "../state/table.ts";
import {
  gridCellProps,
  gridKeyboardDelegate,
  gridProps,
  gridRowProps,
  gridRowGroupProps,
  gridSelectionCheckboxProps,
  type GridAria,
  type GridCellProps,
  type GridProps,
  type GridRowAria,
  type GridRowGroupAria,
  type GridRowProps,
  type GridSelectionCheckboxProps,
  type GridShared,
} from "../grid/behaviour.ts";
import { direction as elementDirection } from "../bidi/index.ts";
import { syntheticLinkAttrs, type LinkDOMProps, type Router } from "../utils/links.tsx";
import { searchCollator } from "../selection/list-keyboard-delegate.ts";
import { TableKeyboardDelegate } from "./keyboard-delegate.ts";
import { strings } from "./intl.ts";

export { gridRowGroupProps as tableRowGroupProps };
export type { GridRowGroupAria as TableRowGroupAria };

/** A react-stately `TableState` view as the table hooks read it (grid shared data + grid id ride on it). */
export type TableStateLike<T = unknown> = TableState<T> & {
  /** `../grid/behaviour.ts` `gridShared(props)` (react-aria `gridMap`). */
  grid?: GridShared | undefined;
  /** The table's id (react-aria `gridIds`). */
  gridId?: string | undefined;
};

const format = (locale: string | undefined, key: string, args?: Record<string, unknown>) => formatMessage(strings, locale, key, args);

// --- utils.ts ------------------------------------------------------------------------------------

/** react-aria `gridIds`: the table id per (long-lived) state object (fallback of `state.gridId`). */
export const gridIds: WeakMap<object, string> = new WeakMap();

function gridIdOf(state: TableStateLike<any>): string {
  const gridId = state.gridId ?? gridIds.get(state);
  if (!gridId) throw new Error("Unknown grid");
  return gridId;
}

/** Strips whitespace from string keys (ids must not contain spaces). */
export function normalizeKey(key: Key): string {
  if (typeof key === "string") return key.replace(/\s*/g, "");
  return "" + key;
}

/** The id of a column header (`<grid id>-<column key>`). */
export function getColumnHeaderId(state: TableStateLike<any>, columnKey: Key): string {
  return `${gridIdOf(state)}-${normalizeKey(columnKey)}`;
}

/** The id of a cell (`<grid id>-<row key>-<column key>`). */
export function getCellId(state: TableStateLike<any>, rowKey: Key, columnKey: Key): string {
  return `${gridIdOf(state)}-${normalizeKey(rowKey)}-${normalizeKey(columnKey)}`;
}

/** A row is labelled by its row header cells. */
export function getRowLabelledBy(state: TableStateLike<any>, rowKey: Key): string {
  return [...state.collection.rowHeaderColumnKeys].map((columnKey) => getCellId(state, rowKey, columnKey)).join(" ");
}

// --- useTable ------------------------------------------------------------------------------------

export interface AriaTableProps extends GridProps {
  /** The layout object for the table (keyboard delegate page navigation). */
  layoutDelegate?: LayoutDelegate | undefined;
  /** Rivet: id of the hidden sort description element (react-aria `useDescription`). */
  sortDescriptionId?: string | undefined;
}

/**
 * The keyboard delegate `useTable` builds (react-aria memoizes it; Rivet builds it per event):
 * `props.keyboardDelegate`, else a `TableKeyboardDelegate` over the table element's DOM layout.
 */
export function tableKeyboardDelegate<T>(props: AriaTableProps, state: TableStateLike<T>, element: HTMLElement | null): KeyboardDelegate {
  if (props.keyboardDelegate) return props.keyboardDelegate;
  return new TableKeyboardDelegate<T>({
    collection: state.collection,
    disabledKeys: state.disabledKeys,
    disabledBehavior: state.selectionManager.disabledBehavior,
    ref: element,
    direction: props.direction ?? (element ? elementDirection(element) : "ltr"),
    collator: searchCollator(props.locale),
    layoutDelegate: props.layoutDelegate,
  });
}

/** The sort description of the table (`"sorted by column X in ascending order"`), or undefined. */
export function tableSortDescription(props: { locale?: string | undefined }, state: TableStateLike<any>): string | undefined {
  const { column, direction: sortDirection } = state.sortDescriptor || ({} as Partial<NonNullable<TableState<unknown>["sortDescriptor"]>>);
  const columnName = state.collection.columns.find((c) => c.key === column)?.textValue ?? "";
  return sortDirection && column != null ? format(props.locale, `${sortDirection}Sort`, { columnName }) : undefined;
}

/**
 * Provides the behavior and accessibility implementation for a table component (react-aria
 * `useTable` → `tableProps`): `gridProps` of `../grid/behaviour.ts` + treegrid role, virtualized row
 * count including header rows, the sort description. Reads state: bind as accessors. Wire the grid
 * handlers (`gridKeyDown` …) with `keyboardDelegate: tableKeyboardDelegate(…)` — `table<Event>` below.
 */
export function tableProps<T>(props: AriaTableProps, state: TableStateLike<T>, hasTabbableChild = false): GridAria {
  const { gridProps: attrs } = gridProps({ ...props, id: props.id ?? state.gridId }, state, hasTabbableChild);
  // Override to include header rows
  if (props.isVirtualized) attrs["aria-rowcount"] = state.collection.size + state.collection.headerRows.length;
  if (state.treeColumn != null) attrs.role = "treegrid";
  const sortDescription = tableSortDescription(props, state);
  // merge sort description with long press information
  const describedBy = [sortDescription ? props.sortDescriptionId : undefined, attrs["aria-describedby"] as string | undefined].filter(Boolean).join(" ");
  attrs["aria-describedby"] = describedBy || undefined;
  return { gridProps: attrs };
}

/** The grid handler props of `tableProps`: `props` with the table keyboard delegate for the element. */
export function tableGridProps<T>(props: AriaTableProps, state: TableStateLike<T>, element: HTMLElement | null): GridProps {
  return { ...props, keyboardDelegate: tableKeyboardDelegate(props, state, element) };
}

// --- useTableColumnHeader ------------------------------------------------------------------------

export interface AriaTableColumnHeaderProps<T> {
  /** An object representing the column header. */
  node: GridNode<T>;
  /** Whether the column header is contained in a virtual scroller. */
  isVirtualized?: boolean | undefined;
  /** Whether the column header or its first focusable child is focused. Default "child". */
  focusMode?: "child" | "cell" | undefined;
  /** Whether the column header supports arrow key navigation with tab keyboard navigation. */
  allowsArrowNavigation?: boolean | undefined;
  /** Rivet: id of the hidden "sortable column" description element (react-aria `useDescription`). */
  descriptionId?: string | undefined;
  /** Rivet: locale of the strings. */
  locale?: string | undefined;
}

export interface TableColumnHeaderAria {
  /** Props for the column header element. */
  columnHeaderProps: Record<string, unknown>;
  /** Whether the column is currently in a pressed state. */
  isPressed: boolean;
}

/** The "sortable column" description of a column header (Android adds the sort order), or undefined. */
export function tableColumnSortableDescription<T>(props: AriaTableColumnHeaderProps<T>, state: TableStateLike<T>): string | undefined {
  const { node } = props;
  if (!node.props?.allowsSorting) return undefined;
  let sortDescription = `${format(props.locale, "sortable")}`;
  const isSortedColumn = state.sortDescriptor?.column === node.key;
  const sortDirection = state.sortDescriptor?.direction;
  // Android Talkback doesn't support aria-sort so we add sort order details to the aria-described by here
  if (isSortedColumn && sortDirection && isAndroid()) sortDescription = `${sortDescription}, ${format(props.locale, sortDirection)}`;
  return sortDescription;
}

/** Whether the column header press sorts (react-aria `usePress({ isDisabled })`). */
export function tableColumnHeaderPressable<T>(props: AriaTableColumnHeaderProps<T>, state: TableStateLike<T>): boolean {
  const { node } = props;
  const isSelectionCellDisabled = node.props?.isSelectionCell && state.selectionManager.selectionMode === "single";
  return !!node.props?.allowsSorting && !isSelectionCellDisabled;
}

/**
 * Provides the behavior and accessibility implementation for a column header in a table (react-aria
 * `useTableColumnHeader` → `tableColumnHeaderProps`). Reads state: bind as accessors. Wire the
 * `gridCell<Event>` handlers (focusMode "child") and a press (`../interactions/press.tsx`) calling
 * `tableColumnHeaderPress` when `tableColumnHeaderPressable`.
 */
export function tableColumnHeaderProps<T>(props: AriaTableColumnHeaderProps<T>, state: TableStateLike<T>): TableColumnHeaderAria {
  const { node } = props;
  const { gridCellProps: cellAttrs } = gridCellProps({ focusMode: "child", ...props } as GridCellProps, state);
  let ariaSort: "ascending" | "descending" | "none" | undefined;
  const isSortedColumn = state.sortDescriptor?.column === node.key;
  const sortDirection = state.sortDescriptor?.direction;
  // aria-sort not supported in Android Talkback
  if (node.props?.allowsSorting && !isAndroid()) ariaSort = isSortedColumn ? sortDirection : "none";
  const description = tableColumnSortableDescription(props, state);
  const shouldDisableFocus = state.collection.size === 0;
  return {
    columnHeaderProps: {
      ...cellAttrs,
      "aria-describedby": description ? props.descriptionId : undefined,
      // If the table is empty, make all column headers untabbable
      ...(shouldDisableFocus ? { tabIndex: -1 } : null),
      role: "columnheader",
      id: getColumnHeaderId(state, node.key),
      "aria-colspan": node.colSpan && node.colSpan > 1 ? node.colSpan : undefined,
      "aria-sort": ariaSort,
    },
    isPressed: false,
  };
}

/**
 * The column header press: `state.sort(column)`, then the sort announcement (react-aria announces
 * the changed sort description, assertive, 500 ms).
 */
export function tableColumnHeaderPress<T>(props: AriaTableColumnHeaderProps<T>, state: TableStateLike<T>, sort: (key: Key) => void, read: () => TableStateLike<T>): void {
  if (!tableColumnHeaderPressable(props, state)) return;
  const before = tableSortDescription(props, state);
  sort(props.node.key);
  const after = untrack(() => tableSortDescription(props, read()));
  if (after && after !== before) announce(after, "assertive", 500);
}

/**
 * react-aria's effect: an empty table drops a focused column header key. Call at the end of
 * handlers that may empty the collection (and on render: no-op unless focused).
 */
export function tableColumnHeaderResetFocus<T>(props: AriaTableColumnHeaderProps<T>, state: TableStateLike<T>): void {
  if (state.collection.size === 0 && untrack(() => state.selectionManager.focusedKey) === props.node.key) state.selectionManager.setFocusedKey(null);
}

// --- useTableRow ---------------------------------------------------------------------------------

const EXPANSION_KEYS = {
  expand: { ltr: "ArrowRight", rtl: "ArrowLeft" },
  collapse: { ltr: "ArrowLeft", rtl: "ArrowRight" },
} as const;

/** RAC Button props of the treegrid expand button (`Button slot="chevron"`; `onPress` → `tableRowExpandPress`). */
export interface TableExpandButtonProps {
  isDisabled?: boolean | undefined;
  excludeFromTabOrder?: boolean | undefined;
  preventFocusOnPress?: boolean | undefined;
  "data-react-aria-prevent-focus"?: boolean | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  id?: string | undefined;
}

export interface TableRowAria extends Omit<GridRowAria, "rowProps"> {
  /** Props for the table row element. */
  rowProps: Record<string, unknown>;
  /** Props for the treegrid expand button (empty unless the table has a tree column). */
  expandButtonProps: TableExpandButtonProps;
}

export interface TableRowProps<T> extends GridRowProps<T> {
  /** Rivet: id of the expand button (react-aria `useLabels` generates one when labelled by others). */
  expandButtonId?: string | undefined;
  /** Rivet: the router of the synthetic link attributes (react-aria `useSyntheticLinkProps` reads it from context). */
  router?: Router | undefined;
}

function getLastChild<T>(collection: Collection<Node<T>>, node: Node<T>): Node<T> | null | undefined {
  if ("lastChildKey" in node) return node.lastChildKey != null ? collection.getItem(node.lastChildKey) : null;
  return Array.from(node.childNodes).findLast((item) => item.parentKey === node.key);
}

interface TreeRow {
  hasChildRows: boolean;
  attrs: Record<string, unknown>;
}

function treeGridRow<T>(props: TableRowProps<T>, state: TableStateLike<T>): TreeRow | null {
  const { node } = props;
  if (state.treeColumn == null) return null;
  const treeNode = state.collection.getItem(node.key);
  if (treeNode == null) return null;
  const lastChild = getLastChild(state.collection, node);
  const hasChildRows = !!(treeNode.props?.hasChildRows || treeNode.props?.UNSTABLE_childItems || lastChild?.type !== "cell");
  const parent = state.collection.getItem(node.parentKey!)!;
  const isParentBody = parent.type === "tablebody" || parent.type === "body";
  let lastSibling = getLastChild(state.collection, parent)!;
  while (lastSibling && lastSibling.type !== "item" && lastSibling.prevKey != null) lastSibling = state.collection.getItem(lastSibling.prevKey)!;
  return {
    hasChildRows,
    attrs: {
      "aria-expanded": hasChildRows ? (state.expandedKeys as Set<Key> | "all") === "all" || state.expandedKeys.has(node.key) : undefined,
      "aria-level": treeNode.level + 1,
      "aria-posinset": treeNode.index - (isParentBody ? 0 : state.collection.columnCount) + 1,
      "aria-setsize": lastSibling.index - (isParentBody ? 0 : state.collection.columnCount) + 1,
    },
  };
}

/**
 * Provides the behavior and accessibility implementation for a row in a table (react-aria
 * `useTableRow` → `tableRowProps`): `gridRowProps` + virtualized aria-rowindex, treegrid
 * expansion attributes, synthetic link attributes, aria-labelledby (row header cells), the expand
 * button props. Reads state: bind as accessors. Wire the `gridRow<Event>` handlers and
 * `tableRowKeyDown` (treegrid expansion keys) on the row.
 */
export function tableRowProps<T>(props: TableRowProps<T>, state: TableStateLike<T>, locale?: string): TableRowAria {
  const { node, isVirtualized } = props;
  const { rowProps, ...states } = gridRowProps(props, state);
  if (isVirtualized && state.treeColumn == null) rowProps["aria-rowindex"] = node.index + 1 + state.collection.headerRows.length; // aria-rowindex is 1 based
  else delete rowProps["aria-rowindex"];

  const isExpanded = state.treeColumn != null && ((state.expandedKeys as Set<Key> | "all") === "all" || state.expandedKeys.has(node.key));
  let expandButtonProps: TableExpandButtonProps = {};
  const tree = treeGridRow(props, state);
  if (tree) {
    // useLabels: aria-label + aria-labelledby → labelled by itself + the row headers.
    const labelledBy = getRowLabelledBy(state, node.key);
    expandButtonProps = {
      isDisabled: states.isDisabled,
      excludeFromTabOrder: true,
      preventFocusOnPress: true,
      "data-react-aria-prevent-focus": true,
      "aria-label": format(locale, isExpanded ? "collapse" : "expand"),
      "aria-labelledby": labelledBy ? [props.expandButtonId, labelledBy].filter(Boolean).join(" ") : undefined,
      id: props.expandButtonId,
    };
  }
  const linkProps = states.hasAction ? syntheticLinkAttrs((node.props ?? {}) as LinkDOMProps, props.router) : {};
  return {
    rowProps: { ...rowProps, ...(tree?.attrs ?? {}), ...linkProps, "aria-labelledby": getRowLabelledBy(state, node.key) },
    expandButtonProps,
    ...states,
  };
}

/** keydown on a treegrid row: expand / collapse (RTL aware), collapse on a leaf moves to the parent. */
export function tableRowKeyDown<T>(e: KeyboardEvent, props: TableRowProps<T>, state: TableStateLike<T>): void {
  const tree = treeGridRow(props, state);
  if (!tree) return;
  const treeNode = state.collection.getItem(props.node.key)!;
  const direction = elementDirection(e.currentTarget as Element);
  const focusedKey = untrack(() => state.selectionManager.focusedKey);
  const expandedKeys = state.expandedKeys as Set<Key> | "all";
  if (e.key === EXPANSION_KEYS.expand[direction] && focusedKey === treeNode.key && tree.hasChildRows && expandedKeys !== "all" && !expandedKeys.has(treeNode.key)) {
    state.toggleKey(treeNode.key);
    e.stopPropagation();
  } else if (e.key === EXPANSION_KEYS.collapse[direction] && focusedKey === treeNode.key) {
    if (expandedKeys !== "all") {
      if (tree.hasChildRows && expandedKeys.has(treeNode.key)) {
        state.toggleKey(treeNode.key);
        e.stopPropagation();
      } else if (!expandedKeys.has(treeNode.key) && treeNode.parentKey != null && treeNode.level > 0) {
        // Item is a leaf or already collapsed, move focus to parent
        state.selectionManager.setFocusedKey(treeNode.parentKey);
        e.stopPropagation();
      }
    } else {
      state.toggleKey(treeNode.key);
      e.stopPropagation();
    }
  }
}

/** The expand button's `onPress` (react-aria `expandButtonProps.onPress`). */
export function tableRowExpandPress<T>(props: TableRowProps<T>, state: TableStateLike<T>): void {
  const isDisabled = state.selectionManager.isDisabled(props.node.key) || state.collection.size === 0;
  if (!isDisabled) {
    state.toggleKey(props.node.key);
    state.selectionManager.setFocused(true);
    state.selectionManager.setFocusedKey(props.node.key);
  }
}

// --- useTableHeaderRow ---------------------------------------------------------------------------

export interface TableHeaderRowAria {
  /** Props for the grid row element. */
  rowProps: Record<string, unknown>;
}

/** Provides the behavior and accessibility implementation for a header row in a table (react-aria `useTableHeaderRow`). */
export function tableHeaderRowProps<T>(props: { node: GridNode<T>; isVirtualized?: boolean | undefined }, state: TableStateLike<T>): TableHeaderRowAria {
  const rowProps: Record<string, unknown> = { role: "row" };
  if (props.isVirtualized && state.treeColumn == null) rowProps["aria-rowindex"] = props.node.index + 1; // aria-rowindex is 1 based
  return { rowProps };
}

// --- useTableCell --------------------------------------------------------------------------------

export interface AriaTableCellProps extends GridCellProps {}

export interface TableCellAria {
  /** Props for the table cell element. */
  gridCellProps: Record<string, unknown>;
  /** Whether the cell is currently in a pressed state. */
  isPressed: boolean;
}

/**
 * Provides the behavior and accessibility implementation for a cell in a table (react-aria
 * `useTableCell` → `tableCellProps`): `gridCellProps`, row header cells get role rowheader + the id
 * rows are labelled by. Reads state. Wire the `gridCell<Event>` handlers.
 */
export function tableCellProps<T>(props: AriaTableCellProps, state: TableStateLike<T>): TableCellAria {
  const { gridCellProps: attrs, isPressed } = gridCellProps(props, state);
  const columnKey = props.node.column?.key;
  if (columnKey != null && state.collection.rowHeaderColumnKeys.has(columnKey)) {
    attrs.role = "rowheader";
    attrs.id = getCellId(state, props.node.parentKey!, columnKey);
  }
  return { gridCellProps: attrs, isPressed };
}

// --- useTableSelectionCheckbox -------------------------------------------------------------------

export interface AriaTableSelectionCheckboxProps {
  /** A unique key for the checkbox. */
  key: Key;
  /** Rivet: checkbox id (react-aria generates one). */
  id?: string | undefined;
  /** Rivet: locale of the strings. */
  locale?: string | undefined;
}

export interface TableSelectionCheckboxAria {
  /** Props for the row selection checkbox element (`onChange` → `tableSelectionCheckboxChange`). */
  checkboxProps: GridSelectionCheckboxProps & { "aria-labelledby": string };
}

/** Provides the behavior and accessibility implementation for a row selection checkbox in a table (react-aria `useTableSelectionCheckbox`). */
export function tableSelectionCheckboxProps<T>(props: AriaTableSelectionCheckboxProps, state: TableStateLike<T>): TableSelectionCheckboxAria {
  const { checkboxProps } = { checkboxProps: gridSelectionCheckboxProps(props, state) };
  return { checkboxProps: { ...checkboxProps, "aria-labelledby": `${checkboxProps.id} ${getRowLabelledBy(state, props.key)}` } };
}

/** The row selection checkbox's `onChange`: toggles the row's selection. */
export function tableSelectionCheckboxChange<T>(_isSelected: boolean, props: { key: Key }, state: TableStateLike<T>): void {
  state.selectionManager.toggleSelection(props.key);
}

export interface TableSelectAllCheckboxAria {
  /** Props for the select all checkbox element (`onChange` → `tableSelectAllCheckboxChange`). */
  checkboxProps: { "aria-label": string; isSelected: boolean; isDisabled: boolean; isIndeterminate: boolean };
}

/** Provides the behavior and accessibility implementation for the select all checkbox in a table (react-aria `useTableSelectAllCheckbox`). */
export function tableSelectAllCheckboxProps<T>(state: TableStateLike<T>, locale?: string): TableSelectAllCheckboxAria {
  const { isEmpty, isSelectAll, selectionMode } = state.selectionManager;
  return {
    checkboxProps: {
      "aria-label": format(locale, selectionMode === "single" ? "select" : "selectAll"),
      isSelected: isSelectAll,
      isDisabled:
        selectionMode !== "multiple" || state.collection.size === 0 || (state.collection.rows.length === 1 && state.collection.rows[0]!.type === "loader"),
      isIndeterminate: !isEmpty && !isSelectAll,
    },
  };
}

/** The select all checkbox's `onChange`. */
export function tableSelectAllCheckboxChange<T>(state: TableStateLike<T>): void {
  state.selectionManager.toggleSelectAll();
}

export type { GridRowGroupAria };
export { gridKeyboardDelegate };
