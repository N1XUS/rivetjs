// Ported from @react-stately/grid (GridCollection.ts), Apache-2.0, © Adobe.
import type { Collection, Key, Node } from "./types.ts";

export interface IGridCollection<T> extends Collection<GridNode<T>> {
  /** The number of columns in the grid. */
  columnCount: number;
  /** A list of rows in the grid. */
  rows: GridNode<T>[];
}

export interface GridRow<T> extends Partial<GridNode<T>> {
  key?: Key;
  type: string;
  childNodes: Iterable<Node<T>>;
}

export interface GridNode<T> extends Node<T> {
  column?: GridNode<T> | undefined;
  /** @deprecated Use `colSpan` instead. */
  colspan?: number | undefined;
  /** The number of columns spanned by this cell. */
  colSpan?: number | null | undefined;
  /** The column index of this cell, accounting for any colSpans. */
  colIndex?: number | null | undefined;
  /** The index of this node within its parent, ignoring sibling nodes that aren't of the same type. */
  indexOfType?: number | undefined;
}

export interface GridCollectionOptions<T> {
  columnCount: number;
  items: GridRow<T>[];
  visitNode?: (cell: GridNode<T>) => GridNode<T>;
}

/** Rows of cells with colSpan / colIndex bookkeeping. */
export class GridCollection<T> implements IGridCollection<T> {
  keyMap: Map<Key, GridNode<T>> = new Map();
  columnCount: number;
  rows: GridNode<T>[];

  constructor(opts: GridCollectionOptions<T>) {
    this.keyMap = new Map();
    this.columnCount = opts?.columnCount;
    this.rows = [];

    const visit = (node: GridNode<T>) => {
      // If the node is the same object as the previous node for the same key, we can skip this node
      // and its children. We always visit columns though, because we depend on order to build the
      // columns array.
      const prevNode = this.keyMap.get(node.key);
      if (opts.visitNode) node = opts.visitNode(node);
      this.keyMap.set(node.key, node);

      const childKeys = new Set<Key>();
      let last: GridNode<T> | null = null;
      let rowHasCellWithColSpan = false;
      if (node.type === "item") {
        for (const child of node.childNodes) {
          if (child.props?.colSpan !== undefined) {
            rowHasCellWithColSpan = true;
            break;
          }
        }
      }

      for (const child of node.childNodes as Iterable<GridNode<T>>) {
        if (child.type === "cell" && rowHasCellWithColSpan) {
          child.colspan = child.props?.colSpan;
          child.colSpan = child.props?.colSpan;
          child.colIndex = !last ? child.index : (last.colIndex ?? last.index) + (last.colSpan ?? 1);
        }
        // If child is a cell and its parent key isn't already established by the collection, match
        // child node to parent row.
        if (child.type === "cell" && child.parentKey == null) child.parentKey = node.key;
        childKeys.add(child.key);
        if (last) {
          last.nextKey = child.key;
          child.prevKey = last.key;
        } else child.prevKey = null;
        visit(child);
        last = child;
      }
      if (last) last.nextKey = null;

      // Remove deleted nodes and their children from the key map.
      if (prevNode) for (const child of prevNode.childNodes) if (!childKeys.has(child.key)) remove(child);
    };

    const remove = (node: GridNode<T>) => {
      this.keyMap.delete(node.key);
      for (const child of node.childNodes) if (this.keyMap.get(child.key) === child) remove(child);
    };

    let last: GridNode<T> | null = null;
    for (const [i, node] of opts.items.entries()) {
      const rowNode: GridNode<T> = {
        ...node,
        level: node.level ?? 0,
        key: node.key ?? "row-" + i,
        type: node.type ?? "row",
        value: node.value ?? null,
        hasChildNodes: true,
        childNodes: [...node.childNodes],
        rendered: node.rendered,
        textValue: node.textValue ?? "",
        index: node.index ?? i,
      };
      if (last) {
        last.nextKey = rowNode.key;
        rowNode.prevKey = last.key;
      } else rowNode.prevKey = null;
      this.rows.push(rowNode);
      visit(rowNode);
      last = rowNode;
    }
    if (last) last.nextKey = null;
  }

  *[Symbol.iterator](): IterableIterator<GridNode<T>> {
    yield* [...this.rows];
  }

  get size(): number {
    return [...this.rows].length;
  }

  getKeys(): IterableIterator<Key> {
    return this.keyMap.keys();
  }

  getKeyBefore(key: Key): Key | null {
    const node = this.keyMap.get(key);
    return node ? (node.prevKey ?? null) : null;
  }

  getKeyAfter(key: Key): Key | null {
    const node = this.keyMap.get(key);
    return node ? (node.nextKey ?? null) : null;
  }

  getFirstKey(): Key | null {
    return [...this.rows][0]?.key ?? null;
  }

  getLastKey(): Key | null {
    const rows = [...this.rows];
    return rows[rows.length - 1]?.key ?? null;
  }

  getItem(key: Key): GridNode<T> | null {
    return this.keyMap.get(key) ?? null;
  }

  at(idx: number): GridNode<T> | null {
    const keys = [...this.getKeys()];
    return this.getItem(keys[idx]!);
  }

  getChildren(key: Key): Iterable<GridNode<T>> {
    const node = this.keyMap.get(key);
    return (node?.childNodes as Iterable<GridNode<T>>) || [];
  }
}
