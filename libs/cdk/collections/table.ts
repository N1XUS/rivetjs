// Ported from @react-stately/table (TableCollection.ts, TableHeader.ts, TableBody.ts, Column.ts, Row.ts,
// Cell.ts, useTableState.ts sort logic), Apache-2.0, © Adobe.
//
// Data level only: the table collection (header rows incl. nested columns + placeholders, body rows,
// cells, row-header columns, selection / drag columns), builder components and sort descriptors.
import { countChildren, defineCollectionComponent, forEachChild } from "./builder.ts";
import { getFirstItem, getLastItem } from "./nodes.ts";
import { GridCollection, type GridNode, type IGridCollection } from "./grid.ts";
import type { CollectionElement, Key, LinkDOMProps, LoadingState, Node, PartialNode, Rendered, SelectionMode, SortDescriptor, SortDirection } from "./types.ts";
import { isSlot } from "@rivetjs/runtime/slot";

export interface ITableCollection<T> extends IGridCollection<T> {
  /** A list of header row nodes in the table (one per tier of nested columns). */
  headerRows: GridNode<T>[];
  /** A list of (leaf) column nodes in the table. */
  columns: GridNode<T>[];
  /** Column keys that serve as the row header. */
  rowHeaderColumnKeys: Set<Key>;
  /** The node that makes up the header of the table. */
  head?: GridNode<T>;
  /** The node that makes up the body of the table. */
  body: GridNode<T>;
}

export interface TableCollectionOptions {
  showSelectionCheckboxes?: boolean | undefined;
  showDragButtons?: boolean | undefined;
}

// Deviation: react-stately randomises these keys at import time; Rivet keys must match between the
// server render and the resumed client, so they are fixed strings.
export const ROW_HEADER_COLUMN_KEY = "row-header-column-$selection";
export const ROW_HEADER_COLUMN_KEY_DRAG = "row-header-column-$drag";

/** @private Build the header rows from (leaf) columns and their ancestors. */
export function buildHeaderRows<T>(keyMap: Map<Key, GridNode<T>>, columnNodes: GridNode<T>[]): GridNode<T>[] {
  if (columnNodes.length === 0) return [];

  const columns: (GridNode<T> | null)[][] = [];
  const seen = new Map<GridNode<T>, { column: (GridNode<T> | null)[]; index: number }>();
  for (const column of columnNodes) {
    let parentKey = column.parentKey;
    const col: (GridNode<T> | null)[] = [column];

    while (parentKey != null) {
      const parent = keyMap.get(parentKey);
      if (!parent) break;
      // If we've already seen this parent, then it is shared with a previous column. If the current
      // column is taller than the previous column, then we need to shift the parent in the previous
      // column so it's level with the current column.
      if (seen.has(parent)) {
        parent.colSpan ??= 0;
        parent.colSpan++;
        parent.colspan = parent.colSpan;
        const { column: prevColumn, index } = seen.get(parent)!;
        if (index > col.length) break;
        for (let i = index; i < col.length; i++) prevColumn.splice(i, 0, null);
        // Adjust shifted indices.
        for (let i = col.length; i < prevColumn.length; i++) {
          const c = prevColumn[i];
          if (c && seen.has(c)) seen.get(c)!.index = i;
        }
      } else {
        parent.colSpan = 1;
        parent.colspan = 1;
        col.push(parent);
        seen.set(parent, { column: col, index: col.length - 1 });
      }
      parentKey = parent.parentKey;
    }

    columns.push(col);
    column.index = columns.length - 1;
  }

  const maxLength = Math.max(...columns.map((c) => c.length));
  const headerRows: GridNode<T>[][] = Array(maxLength)
    .fill(0)
    .map(() => []);

  // Convert columns into rows.
  let colIndex = 0;
  for (const column of columns) {
    let i = maxLength - 1;
    for (const item of column) {
      if (item) {
        // Fill the space up until the current column with a placeholder.
        const row = headerRows[i]!;
        const rowLength = row.reduce((p, c) => p + (c.colSpan ?? 1), 0);
        if (rowLength < colIndex) {
          const placeholder: GridNode<T> = {
            type: "placeholder",
            key: "placeholder-" + item.key,
            colspan: colIndex - rowLength,
            colSpan: colIndex - rowLength,
            index: rowLength,
            value: null,
            rendered: null,
            level: i,
            hasChildNodes: false,
            childNodes: [],
            textValue: "",
          };
          if (row.length > 0) {
            row[row.length - 1]!.nextKey = placeholder.key;
            placeholder.prevKey = row[row.length - 1]!.key;
          }
          row.push(placeholder);
        }
        if (row.length > 0) {
          row[row.length - 1]!.nextKey = item.key;
          item.prevKey = row[row.length - 1]!.key;
        }
        item.level = i;
        item.colIndex = colIndex;
        row.push(item);
      }
      i--;
    }
    colIndex++;
  }

  // Add placeholders at the end of each row that is shorter than the maximum.
  let i = 0;
  for (const row of headerRows) {
    const rowLength = row.reduce((p, c) => p + (c.colSpan ?? 1), 0);
    if (rowLength < columnNodes.length) {
      const placeholder: GridNode<T> = {
        type: "placeholder",
        key: "placeholder-" + row[row.length - 1]!.key,
        colSpan: columnNodes.length - rowLength,
        colspan: columnNodes.length - rowLength,
        index: rowLength,
        value: null,
        rendered: null,
        level: i,
        hasChildNodes: false,
        childNodes: [],
        textValue: "",
        prevKey: row[row.length - 1]!.key,
      };
      row.push(placeholder);
    }
    i++;
  }

  return headerRows.map((childNodes, index) => ({
    type: "headerrow",
    key: "headerrow-" + index,
    index,
    value: null,
    rendered: null,
    level: 0,
    hasChildNodes: true,
    childNodes,
    textValue: "",
  }));
}

export class TableCollection<T> extends GridCollection<T> implements ITableCollection<T> {
  headerRows: GridNode<T>[];
  columns: GridNode<T>[];
  rowHeaderColumnKeys: Set<Key>;
  body: GridNode<T>;
  _size = 0;

  constructor(nodes: Iterable<GridNode<T>>, _prev?: ITableCollection<T> | null, opts?: TableCollectionOptions) {
    const rowHeaderColumnKeys = new Set<Key>();
    let body: GridNode<T> | null = null;
    const columns: GridNode<T>[] = [];
    // Add cell for selection checkboxes if needed.
    if (opts?.showSelectionCheckboxes) {
      columns.unshift({
        type: "column",
        key: ROW_HEADER_COLUMN_KEY,
        value: null,
        textValue: "",
        level: 0,
        index: opts?.showDragButtons ? 1 : 0,
        hasChildNodes: false,
        rendered: null,
        childNodes: [],
        props: { isSelectionCell: true },
      });
    }
    // Add cell for drag buttons if needed.
    if (opts?.showDragButtons) {
      columns.unshift({
        type: "column",
        key: ROW_HEADER_COLUMN_KEY_DRAG,
        value: null,
        textValue: "",
        level: 0,
        index: 0,
        hasChildNodes: false,
        rendered: null,
        childNodes: [],
        props: { isDragButtonCell: true },
      });
    }

    const rows: GridNode<T>[] = [];
    const columnKeyMap = new Map<Key, GridNode<T>>();
    const visit = (node: GridNode<T>) => {
      switch (node.type) {
        case "body":
          body = node;
          break;
        case "column":
          columnKeyMap.set(node.key, node);
          if (!node.hasChildNodes) {
            columns.push(node);
            if (node.props.isRowHeader) rowHeaderColumnKeys.add(node.key);
          }
          break;
        case "item":
          rows.push(node);
          return; // do not go into childNodes
      }
      for (const child of node.childNodes) visit(child);
    };
    for (const node of nodes) visit(node);

    const headerRows = buildHeaderRows(columnKeyMap, columns);
    rows.unshift(...headerRows); // upstream: headerRows.forEach((row, i) => rows.splice(i, 0, row)) — same order, one move

    super({
      columnCount: columns.length,
      items: rows,
      visitNode: (node) => {
        node.column = columns[node.index];
        return node;
      },
    });
    this.columns = columns;
    this.rowHeaderColumnKeys = rowHeaderColumnKeys;
    this.body = body!;
    this.headerRows = headerRows;
    this._size = [...(body! as GridNode<T>).childNodes].length;

    // Default row header column to the first one.
    if (this.rowHeaderColumnKeys.size === 0) {
      const col = this.columns.find((column) => !column.props?.isDragButtonCell && !column.props?.isSelectionCell);
      if (col) this.rowHeaderColumnKeys.add(col.key);
    }
  }

  override *[Symbol.iterator](): IterableIterator<GridNode<T>> {
    yield* this.body.childNodes as Iterable<GridNode<T>>;
  }

  override get size(): number {
    return this._size;
  }

  override getKeys(): IterableIterator<Key> {
    return this.keyMap.keys();
  }

  override getKeyBefore(key: Key): Key | null {
    return this.keyMap.get(key)?.prevKey ?? null;
  }

  override getKeyAfter(key: Key): Key | null {
    return this.keyMap.get(key)?.nextKey ?? null;
  }

  override getFirstKey(): Key | null {
    return getFirstItem(this.body.childNodes)?.key ?? null;
  }

  override getLastKey(): Key | null {
    return getLastItem(this.body.childNodes)?.key ?? null;
  }

  override getItem(key: Key): GridNode<T> | null {
    if (key === this.body.key) return this.body;
    return this.keyMap.get(key) ?? null;
  }

  override at(idx: number): GridNode<T> | null {
    const keys = [...this.getKeys()];
    return this.getItem(keys[idx]!);
  }

  override getChildren(key: Key): Iterable<GridNode<T>> {
    if (key === this.body.key) return this.body.childNodes as Iterable<GridNode<T>>;
    const node = this.getItem(key);
    if (node?.type === "item") return [...(node.childNodes as Iterable<GridNode<T>>)].filter((n) => n.type === "cell");
    return super.getChildren(key);
  }

  getTextValue(key: Key): string {
    const row = this.getItem(key);
    if (!row) return "";
    // If the row has a textValue, use that.
    if (row.textValue) return row.textValue;
    // Otherwise combine the text of each of the row header columns.
    const rowHeaderColumnKeys = this.rowHeaderColumnKeys;
    if (rowHeaderColumnKeys) {
      const text: string[] = [];
      for (const cell of row.childNodes) {
        const column = this.columns[cell.index];
        if (column && rowHeaderColumnKeys.has(column.key) && cell.textValue) text.push(cell.textValue);
        if (text.length === rowHeaderColumnKeys.size) break;
      }
      return text.join(" ");
    }
    return "";
  }
}

// --- Builder components ------------------------------------------------------------------------

/** Builder context shared by TableHeader / Column / Row (react-stately `CollectionBuilderContext`). */
export interface TableBuilderContext<T> {
  showSelectionCheckboxes: boolean;
  showDragButtons: boolean;
  selectionMode: SelectionMode;
  columns: Node<T>[];
}

/** Context for building a table collection (`useTableState`'s memoized context). */
export function tableBuilderContext<T>(
  options: { showSelectionCheckboxes?: boolean; showDragButtons?: boolean; selectionMode?: SelectionMode } = {},
): TableBuilderContext<T> {
  const selectionMode = options.selectionMode ?? "none";
  return {
    showSelectionCheckboxes: !!options.showSelectionCheckboxes && selectionMode !== "none",
    showDragButtons: !!options.showDragButtons,
    selectionMode,
    columns: [],
  };
}

export type ColumnStaticSize = number | `${number}` | `${number}%`;
export type ColumnDynamicSize = `${number}fr`;
export type ColumnSize = ColumnStaticSize | ColumnDynamicSize;

export interface ColumnProps<T> {
  key?: Key | undefined;
  title?: Rendered;
  children?: Rendered | CollectionElement<T> | CollectionElement<T>[];
  childColumns?: T[] | undefined;
  width?: ColumnSize | null | undefined;
  minWidth?: ColumnStaticSize | null | undefined;
  maxWidth?: ColumnStaticSize | null | undefined;
  defaultWidth?: ColumnSize | null | undefined;
  allowsResizing?: boolean | undefined;
  allowsSorting?: boolean | undefined;
  isRowHeader?: boolean | undefined;
  textValue?: string | undefined;
  "aria-label"?: string | undefined;
  [prop: string]: unknown;
}

export interface TableHeaderProps<T> {
  key?: Key | undefined;
  columns?: readonly T[] | undefined;
  children: CollectionElement<T> | CollectionElement<T>[] | ((item: T) => CollectionElement<T>);
}

export interface TableBodyProps<T> {
  key?: Key | undefined;
  children: CollectionElement<T> | CollectionElement<T>[] | ((item: T) => CollectionElement<T>);
  items?: Iterable<T> | undefined;
  loadingState?: LoadingState | undefined;
  onLoadMore?: (() => unknown) | undefined;
}

export interface RowProps<T> extends LinkDOMProps {
  key?: Key | undefined;
  UNSTABLE_childItems?: Iterable<T> | undefined;
  children: CollectionElement<T> | CollectionElement<T>[] | ((columnKey: Key) => CollectionElement<T>);
  textValue?: string | undefined;
  "aria-label"?: string | undefined;
  [prop: string]: unknown;
}

export interface CellProps {
  key?: Key | undefined;
  children?: Rendered;
  textValue?: string | undefined;
  colSpan?: number | undefined;
  "aria-label"?: string | undefined;
  [prop: string]: unknown;
}

export const TableHeader = /* @__PURE__ */ defineCollectionComponent(function* getCollectionNode<T>(
  props: TableHeaderProps<T>,
  context: TableBuilderContext<T>,
): Generator<PartialNode<T>, void, Node<T>[]> {
  const { children, columns } = props;
  // Clear columns so they aren't double added.
  context.columns = [];
  if (typeof children === "function" && !isSlot(children)) {
    if (!columns) throw new Error("props.children was a function but props.columns is missing");
    for (const column of columns) yield { type: "column", value: column, renderer: children };
  } else {
    const list: PartialNode<T>[] = [];
    forEachChild(children, (column) => list.push({ type: "column", element: column }));
    yield* list;
  }
}) as <T>(props: TableHeaderProps<T>) => CollectionElement<T, TableHeaderProps<T>>;

export const TableBody = /* @__PURE__ */ defineCollectionComponent(function* getCollectionNode<T>(
  props: TableBodyProps<T>,
): Generator<PartialNode<T>, void, Node<T>[]> {
  const { children, items } = props;
  yield {
    type: "body",
    hasChildNodes: true,
    props,
    *childNodes() {
      if (typeof children === "function" && !isSlot(children)) {
        if (!items) throw new Error("props.children was a function but props.items is missing");
        for (const item of items) yield { type: "item", value: item, renderer: children };
      } else {
        const list: PartialNode<T>[] = [];
        forEachChild(children, (item) => list.push({ type: "item", element: item }));
        yield* list;
      }
    },
  };
}) as <T>(props: TableBodyProps<T>) => CollectionElement<T, TableBodyProps<T>>;

export const Column = /* @__PURE__ */ defineCollectionComponent(function* getCollectionNode<T>(
  props: ColumnProps<T>,
  context: TableBuilderContext<T>,
): Generator<PartialNode<T>, void, Node<T>[]> {
  const { title, children, childColumns } = props;
  const rendered = title || children;
  const textValue = props.textValue || (typeof rendered === "string" ? rendered : "") || props["aria-label"];
  const fullNodes: Node<T>[] = yield {
    type: "column",
    hasChildNodes: !!childColumns || (!!title && countChildren(children) > 0),
    rendered,
    textValue,
    props,
    *childNodes() {
      if (childColumns) {
        for (const child of childColumns) yield { type: "column", value: child };
      } else if (title) {
        const list: PartialNode<T>[] = [];
        forEachChild(children, (child) => list.push({ type: "column", element: child }));
        yield* list;
      }
    },
    shouldInvalidate(newContext: TableBuilderContext<T>) {
      // If this is called, a cached version of this node is available, but the list of columns in
      // the new context must stay up to date.
      updateContext(newContext);
      return false;
    },
  };
  const updateContext = (ctx: TableBuilderContext<T>) => {
    // Register leaf columns on the context so that Row can access them.
    for (const node of fullNodes) if (!node.hasChildNodes) ctx.columns.push(node);
  };
  updateContext(context);
}) as <T>(props: ColumnProps<T>) => CollectionElement<T, ColumnProps<T>>;

export const Row = /* @__PURE__ */ defineCollectionComponent(function* getCollectionNode<T>(
  props: RowProps<T>,
  context: TableBuilderContext<T>,
): Generator<PartialNode<T>, void, Node<T>[]> {
  const { children, textValue, UNSTABLE_childItems } = props;
  yield {
    type: "item",
    props,
    textValue,
    "aria-label": props["aria-label"],
    hasChildNodes: true,
    *childNodes() {
      // Process cells first.
      if (context.showDragButtons) yield { type: "cell", key: "header-drag", props: { isDragButtonCell: true } };
      if (context.showSelectionCheckboxes && context.selectionMode !== "none") yield { type: "cell", key: "header", props: { isSelectionCell: true } };
      if (typeof children === "function" && !isSlot(children)) {
        for (const column of context.columns) yield { type: "cell", element: children(column.key), key: column.key };
        if (UNSTABLE_childItems) for (const child of UNSTABLE_childItems) yield { type: "item", value: child };
      } else {
        const cells: PartialNode<T>[] = [];
        const childRows: PartialNode<T>[] = [];
        let columnCount = 0;
        forEachChild(children, (node: CollectionElement<T>) => {
          if ((node.type as unknown) === Row) {
            if (cells.length < context.columns.length) throw new Error("All of a Row's child Cells must be positioned before any child Rows.");
            childRows.push({ type: "item", element: node });
          } else {
            cells.push({ type: "cell", element: node });
            columnCount += (node.props as CellProps).colSpan ?? 1;
          }
        });
        if (columnCount !== context.columns.length) {
          throw new Error(`Cell count must match column count. Found ${columnCount} cells and ${context.columns.length} columns.`);
        }
        yield* cells;
        yield* childRows;
      }
    },
    shouldInvalidate(newContext: TableBuilderContext<T>) {
      // Invalidate all rows if the columns changed.
      return (
        newContext.columns.length !== context.columns.length ||
        newContext.columns.some((c, i) => c.key !== context.columns[i]!.key) ||
        newContext.showSelectionCheckboxes !== context.showSelectionCheckboxes ||
        newContext.showDragButtons !== context.showDragButtons ||
        newContext.selectionMode !== context.selectionMode
      );
    },
  };
}) as <T>(props: RowProps<T>) => CollectionElement<T, RowProps<T>>;

export const Cell = /* @__PURE__ */ defineCollectionComponent(function* getCollectionNode<T>(props: CellProps): Generator<PartialNode<T>, void, Node<T>[]> {
  const { children } = props;
  const textValue = props.textValue || (typeof children === "string" ? children : "") || props["aria-label"] || "";
  yield { type: "cell", props, rendered: children, textValue, "aria-label": props["aria-label"], hasChildNodes: false };
}) as (props: CellProps) => CollectionElement<unknown, CellProps>;

// --- Sorting -----------------------------------------------------------------------------------

export const OPPOSITE_SORT_DIRECTION: Readonly<Record<SortDirection, SortDirection>> = { ascending: "descending", descending: "ascending" };

/**
 * The descriptor `useTableState().sort(columnKey, direction?)` passes to `onSortChange`: the given
 * direction, else the opposite of the current one for the same column, else ascending.
 */
export function nextSortDescriptor(current: SortDescriptor | null | undefined, column: Key, direction?: SortDirection): SortDescriptor {
  return { column, direction: direction ?? (current?.column === column ? OPPOSITE_SORT_DIRECTION[current.direction] : "ascending") };
}

/** `aria-sort` value of a column under `descriptor` ("none" for sortable, unsorted columns). */
export function ariaSort(descriptor: SortDescriptor | null | undefined, column: Key, allowsSorting = true): "ascending" | "descending" | "none" | undefined {
  if (descriptor?.column === column) return descriptor.direction;
  return allowsSorting ? "none" : undefined;
}
