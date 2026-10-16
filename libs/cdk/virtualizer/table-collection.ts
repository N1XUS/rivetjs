// Minimal table collection for TableLayout: the `ITableCollection` / `GridNode` shapes of React Spectrum
// (react-stately/src/table/TableCollection.ts, react-stately/src/grid/GridCollection.ts), Apache-2.0, © Adobe.
// Rivet: built from plain column / row arrays (one header row, no nested columns); replace with the
// cdk-collections / aria table collection once it lands.
import type { Key } from "../collections/index.ts";
import { type Collection, itemKey, loaderNode, type Node } from "./collection.ts";

export interface GridNode<T> extends Node<T> {
  column?: GridNode<T>;
  /** The number of columns spanned by this cell. */
  colSpan?: number | null;
  /** The column index of this cell, accounting for any colSpans. */
  colIndex?: number | null;
  /** The index of this node within its parent, ignoring sibling nodes that aren't of the same type. */
  indexOfType?: number;
}

export interface TableCollection<T> extends Collection<GridNode<T>> {
  /** The header row nodes (one per tier of nested columns). */
  headerRows: GridNode<T>[];
  /** The column nodes. */
  columns: GridNode<T>[];
  /** Column keys that serve as row headers. */
  rowHeaderColumnKeys: Set<Key>;
  /** The node that makes up the header of the table. */
  head?: GridNode<T>;
  /** The node that makes up the body of the table. */
  body: GridNode<T>;
}

export interface TableColumn {
  key: Key;
  /** Header text. */
  label?: string;
  width?: number | string;
  defaultWidth?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  isRowHeader?: boolean;
}

export interface TableCollectionOptions<R> {
  /** Row key (default: `row.key ?? row.id`). */
  getKey?: (row: R, index: number) => Key;
  /** Cell value of `row` in `column` (default `row[column.key]`). */
  getCell?: (row: R, column: TableColumn) => unknown;
  /** Footer rows (`tablefooter` row group). */
  footer?: readonly R[];
  /** Append a "load more" loader row to the body; `true` reserves its height. */
  loader?: boolean;
}

const node = <T>(
  type: string,
  key: Key,
  value: T | null,
  index: number,
  level: number,
  parentKey: Key | null,
  childNodes: GridNode<T>[],
  props: any = {},
): GridNode<T> => ({
  type,
  key,
  value,
  level,
  hasChildNodes: childNodes.length > 0,
  childNodes,
  rendered: true,
  textValue: typeof value === "string" ? value : "",
  index,
  parentKey,
  firstChildKey: childNodes[0]?.key ?? null,
  lastChildKey: childNodes.at(-1)?.key ?? null,
  props,
});

/** A table collection: `tableheader` (one `headerrow` of `column`s), `tablebody` rows of `cell`s, optional footer. */
export function createTableCollection<R>(columns: readonly TableColumn[], rows: readonly R[], options: TableCollectionOptions<R> = {}): TableCollection<R> {
  const keyMap = new Map<Key, GridNode<R>>();
  const columnNodes: GridNode<R>[] = columns.map((column, i) => {
    const { key, label, ...props } = column;
    const n = node<R>("column", key, (label ?? String(key)) as unknown as R, i, 1, "headerrow", [], props);
    n.colIndex = i;
    return n;
  });
  const headerRow = node<R>("headerrow", "headerrow", null, 0, 0, "header", columnNodes);
  const head = node<R>("tableheader", "header", null, 0, 0, null, [headerRow]);
  const rowNodes = (list: readonly R[], parentKey: Key, offset: number): GridNode<R>[] =>
    list.map((row, i) => {
      const key = options.getKey ? options.getKey(row, i) : itemKey(row, i);
      const cells = columns.map((column, c) => {
        const value = options.getCell ? options.getCell(row, column) : (row as Record<string, unknown>)?.[column.key as string];
        const cell = node<R>("cell", `${key}:${column.key}`, value as R, c, 2, key, []);
        cell.colIndex = c;
        cell.column = columnNodes[c];
        return cell;
      });
      return node<R>("item", key, row, offset + i, 1, parentKey, cells);
    });
  const bodyRows: GridNode<R>[] = rowNodes(rows, "body", 0);
  if (options.loader !== undefined) bodyRows.push(loaderNode<R>("loader", options.loader, "body"));
  const body = node<R>("tablebody", "body", null, 1, 0, null, bodyRows);
  const top = [head, body];
  if (options.footer) top.push(node<R>("tablefooter", "footer", null, 2, 0, null, rowNodes(options.footer, "footer", rows.length)));

  const visit = (n: GridNode<R>) => {
    keyMap.set(n.key, n);
    for (const child of n.childNodes as GridNode<R>[]) visit(child);
  };
  for (const n of top) visit(n);
  const keys = [...keyMap.keys()];
  const rowKeys = [...keyMap.values()].filter((n) => n.type === "item").map((n) => n.key);

  return {
    headerRows: [headerRow],
    columns: columnNodes,
    rowHeaderColumnKeys: new Set(
      columns
        .filter((c) => c.isRowHeader)
        .map((c) => c.key)
        .concat(columns.some((c) => c.isRowHeader) ? [] : columns[0] ? [columns[0].key] : []),
    ),
    head,
    body,
    size: rows.length,
    [Symbol.iterator]: () => top[Symbol.iterator](),
    getKeys: () => keyMap.keys(),
    getItem: (key) => keyMap.get(key) ?? null,
    at: (idx) => (keys[idx] === undefined ? null : keyMap.get(keys[idx]!)!),
    // Row navigation order (like the grid collection's row keys).
    getKeyBefore: (key) => rowKeys[rowKeys.indexOf(key) - 1] ?? null,
    getKeyAfter: (key) => {
      const i = rowKeys.indexOf(key);
      return i < 0 ? null : (rowKeys[i + 1] ?? null);
    },
    getFirstKey: () => rowKeys[0] ?? null,
    getLastKey: () => rowKeys.at(-1) ?? null,
    getChildren: (key) => keyMap.get(key)?.childNodes ?? [],
    getTextValue: (key) => keyMap.get(key)?.textValue ?? "",
  };
}
