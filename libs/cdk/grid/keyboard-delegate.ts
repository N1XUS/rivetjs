// Ported from @react-aria/grid (GridKeyboardDelegate.ts), Apache-2.0, © Adobe.
//
// Rivet: `ref` is a `RefLike` (element, `ref()` or `{ current }`); construct per event from the
// collection + the grid element (class instance: never captured in a resumable closure).
import { DOMLayoutDelegate } from "../selection/list-keyboard-delegate.ts";
import type { RefLike } from "../selection/utils.ts";
import { getChildNodes, getFirstItem, getLastItem, getNthItem } from "../collections/nodes.ts";
import type { GridNode, IGridCollection } from "../collections/grid.ts";
import type { Direction, DisabledBehavior, Key, KeyboardDelegate, LayoutDelegate, Node, Rect, Size } from "../collections/types.ts";

export interface GridKeyboardDelegateOptions<C> {
  collection: C;
  disabledKeys: Set<Key>;
  disabledBehavior?: DisabledBehavior | undefined;
  ref?: RefLike;
  direction: Direction;
  collator?: Intl.Collator | undefined;
  layoutDelegate?: LayoutDelegate | undefined;
  /** @deprecated - Use layoutDelegate instead. */
  layout?: DeprecatedLayout | undefined;
  focusMode?: "row" | "cell" | undefined;
}

export class GridKeyboardDelegate<T, C extends IGridCollection<T>> implements KeyboardDelegate {
  collection: C;
  protected disabledKeys: Set<Key>;
  protected disabledBehavior: DisabledBehavior;
  protected direction: Direction;
  protected collator: Intl.Collator | undefined;
  protected layoutDelegate: LayoutDelegate;
  protected focusMode: "row" | "cell";

  constructor(options: GridKeyboardDelegateOptions<C>) {
    this.collection = options.collection;
    this.disabledKeys = options.disabledKeys;
    this.disabledBehavior = options.disabledBehavior || "all";
    this.direction = options.direction;
    this.collator = options.collator;
    if (!options.layout && !options.ref) throw new Error("Either a layout or a ref must be specified.");
    this.layoutDelegate = options.layoutDelegate || (options.layout ? new DeprecatedLayoutDelegate(options.layout) : new DOMLayoutDelegate(options.ref!));
    this.focusMode = options.focusMode ?? "row";
  }

  protected isCell(node: Node<T>): boolean {
    return node.type === "cell";
  }

  protected isRow(node: Node<T>): boolean {
    return node.type === "row" || node.type === "item";
  }

  private isDisabled(item: Node<unknown>): boolean {
    return this.disabledBehavior === "all" && (item.props?.isDisabled || this.disabledKeys.has(item.key)) && item.props?.disabledBehavior !== "selection";
  }

  protected findPreviousKey(fromKey?: Key, pred?: (item: Node<T>) => boolean, includeDisabled = false): Key | null {
    let key = fromKey != null ? this.collection.getKeyBefore(fromKey) : this.collection.getLastKey();
    while (key != null) {
      const item = this.collection.getItem(key);
      if (!item) return null;
      if ((includeDisabled || !this.isDisabled(item)) && (!pred || pred(item))) return key;
      key = this.collection.getKeyBefore(key);
    }
    return null;
  }

  protected findNextKey(fromKey?: Key, pred?: (item: Node<T>) => boolean, includeDisabled = false): Key | null {
    let key = fromKey != null ? this.collection.getKeyAfter(fromKey) : this.collection.getFirstKey();
    while (key != null) {
      const item = this.collection.getItem(key);
      if (!item) return null;
      if ((includeDisabled || !this.isDisabled(item)) && (!pred || pred(item))) return key;
      key = this.collection.getKeyAfter(key);
      if (key == null) return null;
    }
    return null;
  }

  protected getKeyForItemInRowByIndex(key: Key, index: number = 0): Key | null {
    if (index < 0) return null;
    const item = this.collection.getItem(key);
    if (!item) return null;
    let i = 0;
    for (const child of getChildNodes(item, this.collection) as Iterable<GridNode<T>>) {
      if (child.colSpan && child.colSpan + i > index) return child.key ?? null;
      if (child.colSpan) i = i + child.colSpan - 1;
      if (i === index) return child.key ?? null;
      i++;
    }
    return null;
  }

  getKeyBelow(fromKey: Key, options?: { includeDisabled?: boolean }): Key | null {
    let key: Key | null = fromKey;
    const startItem = this.collection.getItem(key) as GridNode<T> | null;
    if (!startItem) return null;
    // If focus was on a cell, start searching from the parent row
    if (this.isCell(startItem)) key = startItem.parentKey ?? null;
    if (key == null) return null;
    // Find the next item
    key = this.findNextKey(key, (item) => item.type === "item", options?.includeDisabled);
    if (key != null) {
      // If focus was on a cell, focus the cell with the same index in the next row.
      if (this.isCell(startItem)) {
        const startIndex = startItem.colIndex ? startItem.colIndex : startItem.index;
        return this.getKeyForItemInRowByIndex(key, startIndex);
      }
      // Otherwise, focus the next row
      if (this.focusMode === "row") return key;
    }
    return null;
  }

  getKeyAbove(fromKey: Key, options?: { includeDisabled?: boolean }): Key | null {
    let key: Key | null = fromKey;
    const startItem = this.collection.getItem(key) as GridNode<T> | null;
    if (!startItem) return null;
    // If focus is on a cell, start searching from the parent row
    if (this.isCell(startItem)) key = startItem.parentKey ?? null;
    if (key == null) return null;
    // Find the previous item
    key = this.findPreviousKey(key, (item) => item.type === "item", options?.includeDisabled);
    if (key != null) {
      // If focus was on a cell, focus the cell with the same index in the previous row.
      if (this.isCell(startItem)) {
        const startIndex = startItem.colIndex ? startItem.colIndex : startItem.index;
        return this.getKeyForItemInRowByIndex(key, startIndex);
      }
      // Otherwise, focus the previous row
      if (this.focusMode === "row") return key;
    }
    return null;
  }

  getKeyRightOf(key: Key): Key | null {
    const item = this.collection.getItem(key);
    if (!item) return null;
    // If focus is on a row, focus the first child cell.
    if (this.isRow(item)) {
      const children = getChildNodes(item, this.collection);
      return (this.direction === "rtl" ? getLastItem(children)?.key : getFirstItem(children)?.key) ?? null;
    }
    // If focus is on a cell, focus the next cell if any, otherwise focus the parent row.
    if (this.isCell(item) && item.parentKey != null) {
      const parent = this.collection.getItem(item.parentKey);
      if (!parent) return null;
      const children = getChildNodes(parent, this.collection);
      const next = (this.direction === "rtl" ? getNthItem(children, item.index - 1) : getNthItem(children, item.index + 1)) ?? null;
      if (next) return next.key ?? null;
      // focus row only if focusMode is set to row
      if (this.focusMode === "row") return item.parentKey ?? null;
      return (this.direction === "rtl" ? this.getFirstKey(key) : this.getLastKey(key)) ?? null;
    }
    return null;
  }

  getKeyLeftOf(key: Key): Key | null {
    const item = this.collection.getItem(key);
    if (!item) return null;
    // If focus is on a row, focus the last child cell.
    if (this.isRow(item)) {
      const children = getChildNodes(item, this.collection);
      return (this.direction === "rtl" ? getFirstItem(children)?.key : getLastItem(children)?.key) ?? null;
    }
    // If focus is on a cell, focus the previous cell if any, otherwise focus the parent row.
    if (this.isCell(item) && item.parentKey != null) {
      const parent = this.collection.getItem(item.parentKey);
      if (!parent) return null;
      const children = getChildNodes(parent, this.collection);
      const prev = (this.direction === "rtl" ? getNthItem(children, item.index + 1) : getNthItem(children, item.index - 1)) ?? null;
      if (prev) return prev.key ?? null;
      // focus row only if focusMode is set to row
      if (this.focusMode === "row") return item.parentKey ?? null;
      return (this.direction === "rtl" ? this.getLastKey(key) : this.getFirstKey(key)) ?? null;
    }
    return null;
  }

  getFirstKey(fromKey?: Key | null, global?: boolean): Key | null {
    let key: Key | null = fromKey ?? null;
    let item: Node<T> | undefined | null;
    if (key != null) {
      item = this.collection.getItem(key);
      if (!item) return null;
      // If global flag is not set, and a cell is currently focused, move focus to the first cell in the parent row.
      if (this.isCell(item) && !global && item.parentKey != null) {
        const parent = this.collection.getItem(item.parentKey);
        if (!parent) return null;
        return getFirstItem(getChildNodes(parent, this.collection))?.key ?? null;
      }
    }
    // Find the first row
    key = this.findNextKey(undefined, (item) => item.type === "item");
    // If global flag is set (or if focus mode is cell), focus the first cell in the first row.
    if (key != null && ((item && this.isCell(item) && global) || this.focusMode === "cell")) {
      const item = this.collection.getItem(key);
      if (!item) return null;
      key = getFirstItem(getChildNodes(item, this.collection))?.key ?? null;
    }
    // Otherwise, focus the row itself.
    return key;
  }

  getLastKey(fromKey?: Key | null, global?: boolean): Key | null {
    let key: Key | null = fromKey ?? null;
    let item: Node<T> | undefined | null;
    if (key != null) {
      item = this.collection.getItem(key);
      if (!item) return null;
      // If global flag is not set, and a cell is currently focused, move focus to the last cell in the parent row.
      if (this.isCell(item) && !global && item.parentKey != null) {
        const parent = this.collection.getItem(item.parentKey);
        if (!parent) return null;
        const children = getChildNodes(parent, this.collection);
        return getLastItem(children)?.key ?? null;
      }
    }
    // Find the last row
    key = this.findPreviousKey(undefined, (item) => item.type === "item");
    // If global flag is set (or if focus mode is cell), focus the last cell in the last row.
    if (key != null && ((item && this.isCell(item) && global) || this.focusMode === "cell")) {
      const item = this.collection.getItem(key);
      if (!item) return null;
      const children = getChildNodes(item, this.collection);
      key = getLastItem(children)?.key ?? null;
    }
    // Otherwise, focus the row itself.
    return key;
  }

  getKeyPageAbove(fromKey: Key): Key | null {
    let key: Key | null = fromKey;
    let itemRect = this.layoutDelegate.getItemRect(key);
    if (!itemRect) return null;
    const pageY = Math.max(0, itemRect.y + itemRect.height - this.layoutDelegate.getVisibleRect().height);
    while (itemRect && itemRect.y > pageY && key != null) {
      key = this.getKeyAbove(key) ?? null;
      if (key == null) break;
      itemRect = this.layoutDelegate.getItemRect(key);
    }
    return key;
  }

  getKeyPageBelow(fromKey: Key): Key | null {
    let key: Key | null = fromKey;
    let itemRect = this.layoutDelegate.getItemRect(key);
    if (!itemRect) return null;
    const pageHeight = this.layoutDelegate.getVisibleRect().height;
    const pageY = Math.min(this.layoutDelegate.getContentSize().height, itemRect.y + pageHeight);
    while (itemRect && itemRect.y + itemRect.height < pageY) {
      const nextKey = this.getKeyBelow(key);
      // If nextKey is undefined, we've reached the last row already
      if (nextKey == null) break;
      itemRect = this.layoutDelegate.getItemRect(nextKey);
      key = nextKey;
    }
    return key;
  }

  getKeyForSearch(search: string, fromKey?: Key | null): Key | null {
    let key: Key | null = fromKey ?? null;
    if (!this.collator) return null;
    const collection = this.collection;
    key = fromKey ?? this.getFirstKey();
    if (key == null) return null;
    // If the starting key is a cell, search from its parent row.
    const startItem = collection.getItem(key);
    if (!startItem) return null;
    if (startItem.type === "cell") key = startItem.parentKey ?? null;
    let hasWrapped = false;
    while (key != null) {
      const item = collection.getItem(key);
      if (!item) return null;
      // check row text value for match
      if (item.textValue) {
        const substring = item.textValue.slice(0, search.length);
        if (this.collator.compare(substring, search) === 0) {
          if (this.isRow(item) && this.focusMode === "cell") return getFirstItem(getChildNodes(item, this.collection))?.key ?? null;
          return item.key;
        }
      }
      key = this.findNextKey(key, (item) => item.type === "item");
      // Wrap around when reaching the end of the collection
      if (key == null && !hasWrapped) {
        key = this.getFirstKey();
        hasWrapped = true;
      }
    }
    return null;
  }
}

/* Backward compatibility for old Virtualizer Layout interface. */
export interface DeprecatedLayout {
  getLayoutInfo(key: Key): DeprecatedLayoutInfo;
  getContentSize(): Size;
  virtualizer: DeprecatedVirtualizer;
}

interface DeprecatedLayoutInfo {
  rect: Rect;
}

interface DeprecatedVirtualizer {
  visibleRect: Rect;
}

class DeprecatedLayoutDelegate implements LayoutDelegate {
  layout: DeprecatedLayout;

  constructor(layout: DeprecatedLayout) {
    this.layout = layout;
  }

  getContentSize(): Size {
    return this.layout.getContentSize();
  }

  getItemRect(key: Key): Rect | null {
    return this.layout.getLayoutInfo(key)?.rect || null;
  }

  getVisibleRect(): Rect {
    return this.layout.virtualizer.visibleRect;
  }
}
