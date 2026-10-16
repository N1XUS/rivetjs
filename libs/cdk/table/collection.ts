// Ported from react-aria-components (src/Table.tsx: TableCollection, TableHeaderNode, TableColumnNode,
// TableBodyNode, TableFooterNode, TableRowNode, TableCellNode), Apache-2.0, © Adobe.
//
// The collection RAC's `<Table>` builds from its JSX parts (`../collections/base.ts` BaseCollection
// subclass): header rows from nested columns (`buildHeaderRows`), the leaf columns, the row header
// column keys, the body / footer rows (nested rows flattened through `expandedKeys`).
// Rivet: built by `../collections/components.tsx` `collectionOf(content, () => new TableCollection())`
// (BUILD mode). `getRows` is named `getRowNodes` (TS: `rows` field and a private `getRows` would
// read alike); same behaviour.
import { BaseCollection, CollectionNode, FilterableNode, type Mutable } from "../collections/base.ts";
import { buildHeaderRows, type ITableCollection } from "../collections/table.ts";
import type { GridNode } from "../collections/grid.ts";
import type { Key, Node } from "../collections/types.ts";

export class TableHeaderNode<T> extends CollectionNode<T> {
  static override readonly type = "tableheader";
}

export class TableColumnNode extends CollectionNode<unknown> {
  static override readonly type = "column";
  /** Read live by the column resize state / Column part: a width change keeps the rendered header (resizer drag). */
  static readonly liveProps = ["width", "defaultWidth", "minWidth", "maxWidth"];
}

export class TableBodyNode<T> extends FilterableNode<T> {
  static override readonly type = "tablebody";
}

export class TableFooterNode<T> extends FilterableNode<T> {
  static override readonly type = "tablefooter";
}

export class TableRowNode<T> extends CollectionNode<T> {
  static override readonly type = "item";

  override filter(
    collection: BaseCollection<T>,
    newCollection: BaseCollection<T>,
    filterFn: (textValue: string, node: Node<T>) => boolean,
  ): TableRowNode<T> | null {
    const cells = collection.getChildren(this.key);
    for (const cell of cells) {
      if (filterFn(cell.textValue, cell)) {
        const clone = this.clone();
        newCollection.addDescendants(clone, collection);
        return clone;
      }
    }
    return null;
  }
}

export class TableCellNode extends CollectionNode<unknown> {
  static override readonly type = "cell";
}

export class TableCollection<T> extends BaseCollection<T> implements ITableCollection<T> {
  headerRows: GridNode<T>[] = [];
  columns: GridNode<T>[] = [];
  rows: GridNode<T>[] = [];
  rowHeaderColumnKeys: Set<Key> = new Set();
  head: CollectionNode<T> = new TableHeaderNode<T>(-1);
  columnsDirty = true;
  expandedKeys: Set<Key> = new Set();

  withExpandedKeys(expandedKeys: Set<Key>): this {
    const collection = this.clone();
    collection.expandedKeys = expandedKeys;
    collection.frozen = this.frozen;
    collection.rows = Array.from(collection.getRowNodes());
    return collection;
  }

  override addNode(node: CollectionNode<T>): void {
    super.addNode(node);
    this.columnsDirty ||= node.type === "column";
    if (node.type === "tableheader") this.head = node;
  }

  private getRowNodes(): GridNode<T>[] {
    const rows: GridNode<T>[] = [];
    for (const child of this) {
      if (child.type === "tablebody" || child.type === "tablefooter") rows.push(...(this.getChildren(child.key) as Iterable<GridNode<T>>));
    }
    return rows;
  }

  get body(): GridNode<T> {
    for (const child of this) if (child.type === "tablebody") return child as GridNode<T>;
    return new TableBodyNode<T>(-2) as GridNode<T>;
  }

  override commit(firstKey: Key | null, lastKey: Key | null, isSSR = false): void {
    this.updateColumns(isSSR);

    this.firstKey = firstKey;
    this.lastKey = lastKey;
    this.rows = [];
    for (const row of this.getRowNodes()) {
      const lastChildKey = (row as CollectionNode<T>).lastChildKey;
      if (lastChildKey != null) {
        let lastCell = this.getItem(lastChildKey) as GridNode<T> | null;
        while (lastCell && lastCell.type !== "cell") lastCell = lastCell.prevKey != null ? (this.getItem(lastCell.prevKey) as GridNode<T> | null) : null;
        if (lastCell) {
          const numberOfCellsInRow = (lastCell.colIndex ?? lastCell.index) + (lastCell.colSpan ?? 1);
          if (numberOfCellsInRow !== this.columns.length && !isSSR) {
            throw new Error(`Cell count must match column count. Found ${numberOfCellsInRow} cells and ${this.columns.length} columns.`);
          }
        }
      }
      this.rows.push(row);
    }

    super.commit(firstKey, lastKey, isSSR);
  }

  private updateColumns(isSSR: boolean): void {
    if (!this.columnsDirty) return;

    this.rowHeaderColumnKeys = new Set();
    this.columns = [];

    const columnKeyMap = new Map<Key, GridNode<T>>();
    const visit = (node: Node<T>) => {
      switch (node.type) {
        case "column":
          columnKeyMap.set(node.key, node as GridNode<T>);
          if (!node.hasChildNodes) {
            (node as Mutable<Node<T>>).index = this.columns.length;
            this.columns.push(node as GridNode<T>);
            if (node.props.isRowHeader) this.rowHeaderColumnKeys.add(node.key);
          }
          break;
      }
      for (const child of this.getChildren(node.key)) visit(child);
    };

    for (const node of this.getChildren(this.head.key)) visit(node);

    this.headerRows = buildHeaderRows(columnKeyMap, this.columns);
    this.columnsDirty = false;
    if (this.rowHeaderColumnKeys.size === 0 && this.columns.length > 0 && !isSSR) {
      throw new Error("A table must have at least one Column with the isRowHeader prop set to true");
    }
  }

  get columnCount(): number {
    return this.columns.length;
  }

  override *[Symbol.iterator](): IterableIterator<Node<T>> {
    let key = this.firstKey;
    while (key != null) {
      const node = this.getItem(key);
      if (node) yield node;
      key = node?.nextKey ?? null;
    }
  }

  override getFirstKey(): Key | null {
    for (const child of this) if (child.type === "tablebody") return (child as CollectionNode<T>).firstChildKey ?? null;
    return null;
  }

  override getLastKey(): Key | null {
    const key = this.lastKey;
    if (key == null) return null;
    let node = this.getItem(key) as CollectionNode<T>;
    while (node?.lastChildKey != null && (node.type !== "item" || this.expandedKeys.has(node.key))) node = this.getItem(node.lastChildKey) as CollectionNode<T>;
    return node?.key ?? null;
  }

  override getKeyAfter(key: Key): Key | null {
    const node = this.getItem(key) as CollectionNode<T>;
    if (node?.type === "column") return node.nextKey ?? null;
    if (!node) return null;

    if (node.type === "item" && node.firstChildKey != null && this.expandedKeys.has(node.key)) {
      let child = this.getItem(node.firstChildKey) as CollectionNode<T> | null;
      while (child) {
        if (child.type === "item") return child.key;
        child = child.nextKey != null ? (this.getItem(child.nextKey) as CollectionNode<T>) : null;
      }
    }

    return super.getKeyAfter(key);
  }

  override getKeyBefore(key: Key): Key | null {
    let node = this.getItem(key) as CollectionNode<T>;
    if (node?.type === "column") return node.prevKey ?? null;
    if (!node) return null;

    let k: Key | null = null;
    if (node.prevKey != null) {
      node = this.getItem(node.prevKey) as CollectionNode<T>;
      // Traverse to the deepest expanded child.
      while (node && (node.type !== "item" || this.expandedKeys.has(node.key)) && node.lastChildKey != null)
        node = this.getItem(node.lastChildKey) as CollectionNode<T>;
      k = node?.key ?? null;
    }

    if (k == null) k = node.parentKey;
    if (k != null && this.getItem(k)?.type === "tableheader") return null;
    return k;
  }

  override getChildren(key: Key): Iterable<Node<T>> {
    const item = this.getItem(key);
    if (!item) {
      for (const row of this.headerRows) if (row.key === key) return row.childNodes;
    }

    // Flatten all rows into the body.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    if (item?.type === "tablebody" || item?.type === "tablefooter") {
      return {
        *[Symbol.iterator]() {
          const firstKey = (item as CollectionNode<T>).firstChildKey;
          let node: Node<T> | null = firstKey != null ? self.getItem(firstKey) : null;
          while (node) {
            yield node as Node<T>;
            const key = self.getKeyAfter(node.key);
            node = key != null ? self.getItem(key) : null;
            if (node && node.parentKey === item.parentKey) break;
          }
        },
      };
    }

    return {
      *[Symbol.iterator]() {
        const parent = self.getItem(key) as CollectionNode<T> | null;
        let node = parent?.firstChildKey != null ? (self.getItem(parent.firstChildKey) as CollectionNode<T> | null) : null;
        while (node) {
          yield node as Node<T>;
          node = node.nextKey != null ? (self.getItem(node.nextKey) as CollectionNode<T> | null) : null;
          // Return only cells as children of rows (nested rows are flattened into the body).
          if (parent?.type === "item" && node?.type !== "cell") break;
        }
      },
    };
  }

  override clone(): this {
    const collection = super.clone();
    collection.headerRows = this.headerRows;
    collection.columns = this.columns;
    collection.rows = this.rows;
    collection.rowHeaderColumnKeys = this.rowHeaderColumnKeys;
    collection.head = this.head;
    return collection;
  }

  getTextValue(key: Key): string {
    const row = this.getItem(key);
    if (!row) return "";
    // If the row has a textValue, use that.
    if (row.textValue) return row.textValue;
    // Otherwise combine the text of each of the row header columns.
    const rowHeaderColumnKeys = this.rowHeaderColumnKeys;
    const text: string[] = [];
    for (const cell of this.getChildren(key)) {
      const column = this.columns[cell.index!]!;
      if (rowHeaderColumnKeys.has(column.key) && cell.textValue) text.push(cell.textValue);
      if (text.length === rowHeaderColumnKeys.size) break;
    }
    return text.join(" ");
  }
}
