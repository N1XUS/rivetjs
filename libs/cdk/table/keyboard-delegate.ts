// Ported from @react-aria/table (TableKeyboardDelegate.ts), Apache-2.0, © Adobe.
//
// Rivet: construct per event from the table collection + the table element (class instance: never
// captured in a resumable closure).
// Deviation: typeahead falls back to the cell element's text when a cell has no build-time `textValue`
// (dynamic JSX children are lazy compiler slots, never evaluated at build time: B5 rule); RAC reads the
// rendered string children.
import { getChildNodes, getFirstItem } from "../collections/nodes.ts";
import { domKey, domTextValue } from "../collections/dom.ts";
import { GridKeyboardDelegate, type GridKeyboardDelegateOptions } from "../grid/keyboard-delegate.ts";
import { refElement, type RefLike } from "../selection/utils.ts";
import type { ITableCollection } from "../collections/table.ts";
import type { Key, Node } from "../collections/types.ts";

export class TableKeyboardDelegate<T> extends GridKeyboardDelegate<T, ITableCollection<T>> {
  private ref: RefLike;

  constructor(options: GridKeyboardDelegateOptions<ITableCollection<T>>) {
    super(options);
    this.ref = options.ref;
  }

  /** `node.textValue`, else the rendered text of the cell element with the node's key (see header). */
  private textOf(node: Node<T>): string {
    if (node.textValue) return node.textValue;
    const root = refElement(this.ref);
    if (!root) return "";
    for (const el of root.querySelectorAll("[data-key]")) {
      if (domKey(el) === node.key && (el.getAttribute("role") === "rowheader" || el.getAttribute("role") === "gridcell")) return domTextValue(el);
    }
    return "";
  }

  protected override isCell(node: Node<T>): boolean {
    return node.type === "cell" || node.type === "rowheader" || node.type === "column";
  }

  override getKeyBelow(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    const startItem = this.collection.getItem(key);
    if (!startItem) return null;

    // If focus was on a column, then focus the first child column if any,
    // or find the corresponding cell in the first row.
    if (startItem.type === "column") {
      const child = getFirstItem(getChildNodes(startItem, this.collection));
      if (child) return child.key;
      const firstKey = this.getFirstKey();
      if (firstKey == null) return null;
      const firstItem = this.collection.getItem(firstKey);
      if (!firstItem) return null;
      return super.getKeyForItemInRowByIndex(firstKey, startItem.index);
    }

    return super.getKeyBelow(key, options);
  }

  override getKeyAbove(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    const startItem = this.collection.getItem(key);
    if (!startItem) return null;

    // If focus was on a column, focus the parent column if any
    if (startItem.type === "column") {
      const parent = startItem.parentKey != null ? this.collection.getItem(startItem.parentKey) : null;
      if (parent && parent.type === "column") return parent.key;
      return null;
    }

    // only return above row key if not header row
    const superKey = super.getKeyAbove(key, options);
    const superItem = superKey != null ? this.collection.getItem(superKey) : null;
    if (superItem && superItem.type !== "headerrow") return superKey;

    // If no item was found, and focus was on a cell, then focus the
    // corresponding column header.
    if (this.isCell(startItem)) return this.collection.columns[startItem.index]!.key;

    // If focus was on a row, then focus the first column header.
    return this.collection.columns[0]!.key;
  }

  private findNextColumnKey(column: Node<T>): Key | null {
    // Search following columns
    const key = this.findNextKey(column.key, (item) => item.type === "column");
    if (key != null) return key;

    // Wrap around to the first column
    const row = this.collection.headerRows[column.level]!;
    for (const item of getChildNodes(row, this.collection)) {
      if (item.type === "column") return item.key;
    }
    return null;
  }

  private findPreviousColumnKey(column: Node<T>): Key | null {
    // Search previous columns
    const key = this.findPreviousKey(column.key, (item) => item.type === "column");
    if (key != null) return key;

    // Wrap around to the last column
    const row = this.collection.headerRows[column.level]!;
    const childNodes = [...getChildNodes(row, this.collection)];
    for (let i = childNodes.length - 1; i >= 0; i--) {
      const item = childNodes[i]!;
      if (item.type === "column") return item.key;
    }
    return null;
  }

  override getKeyRightOf(key: Key): Key | null {
    const item = this.collection.getItem(key);
    if (!item) return null;
    // If focus was on a column, then focus the next column
    if (item.type === "column") return this.direction === "rtl" ? this.findPreviousColumnKey(item) : this.findNextColumnKey(item);
    return super.getKeyRightOf(key);
  }

  override getKeyLeftOf(key: Key): Key | null {
    const item = this.collection.getItem(key);
    if (!item) return null;
    // If focus was on a column, then focus the previous column
    if (item.type === "column") return this.direction === "rtl" ? this.findNextColumnKey(item) : this.findPreviousColumnKey(item);
    return super.getKeyLeftOf(key);
  }

  override getKeyForSearch(search: string, fromKey?: Key | null): Key | null {
    if (!this.collator) return null;

    const collection = this.collection;
    let key = fromKey ?? this.getFirstKey();
    if (key == null) return null;

    // If the starting key is a cell, search from its parent row.
    const startItem = collection.getItem(key);
    if (startItem?.type === "cell") key = startItem.parentKey ?? null;

    let hasWrapped = false;
    while (key != null) {
      const item = collection.getItem(key);
      if (!item) return null;

      if (item.textValue) {
        const substring = item.textValue.slice(0, search.length);
        if (this.collator.compare(substring, search) === 0) return item.key;
      }

      // Check each of the row header cells in this row for a match
      for (const cell of getChildNodes(item, this.collection)) {
        const column = collection.columns[cell.index]!;
        const cellText = collection.rowHeaderColumnKeys.has(column.key) ? this.textOf(cell) : "";
        if (cellText) {
          const substring = cellText.slice(0, search.length);
          if (this.collator.compare(substring, search) === 0) {
            // If we started on a cell, end on the matching cell. Otherwise, end on the row.
            const fromItem = fromKey != null ? collection.getItem(fromKey) : startItem;
            return fromItem?.type === "cell" ? cell.key : item.key;
          }
        }
      }

      key = this.getKeyBelow(key);

      // Wrap around when reaching the end of the collection
      if (key == null && !hasWrapped) {
        key = this.getFirstKey();
        hasWrapped = true;
      }
    }
    return null;
  }
}
