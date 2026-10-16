// Ported from @react-aria/selection (ListKeyboardDelegate.ts, DOMLayoutDelegate.ts), Apache-2.0, © Adobe.
import { getItemElement, refElement, type RefLike } from "./utils.ts";
import { isScrollable } from "./dom-utils.ts";
import type { Collection, Direction, DisabledBehavior, Key, KeyboardDelegate, LayoutDelegate, Node, Orientation, Rect, Size } from "../collections/types.ts";

/** Layout from the DOM: item rects relative to the scrolling collection element. */
export class DOMLayoutDelegate implements LayoutDelegate {
  private ref: RefLike;

  constructor(ref: RefLike) {
    this.ref = ref;
  }

  getItemRect(key: Key): Rect | null {
    const container = refElement(this.ref);
    if (!container) return null;
    const item = key != null ? getItemElement(container, key) : null;
    if (!item) return null;
    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    return {
      x: itemRect.left - containerRect.left - container.clientLeft + container.scrollLeft,
      y: itemRect.top - containerRect.top - container.clientTop + container.scrollTop,
      width: itemRect.width,
      height: itemRect.height,
    };
  }

  getContentSize(): Size {
    const container = refElement(this.ref);
    return { width: container?.scrollWidth ?? 0, height: container?.scrollHeight ?? 0 };
  }

  getVisibleRect(): Rect {
    const container = refElement(this.ref);
    return { x: container?.scrollLeft ?? 0, y: container?.scrollTop ?? 0, width: container?.clientWidth ?? 0, height: container?.clientHeight ?? 0 };
  }
}

export interface ListKeyboardDelegateOptions<T> {
  collection: Collection<Node<T>>;
  ref: RefLike;
  collator?: Intl.Collator | undefined;
  layout?: "stack" | "grid" | undefined;
  orientation?: Orientation | undefined;
  direction?: Direction | undefined;
  disabledKeys?: Set<Key> | undefined;
  disabledBehavior?: DisabledBehavior | undefined;
  layoutDelegate?: LayoutDelegate | undefined;
}

/** Keyboard navigation of lists (stack or grid layout, vertical or horizontal, RTL, paging, search). */
export class ListKeyboardDelegate<T> implements KeyboardDelegate {
  private collection: Collection<Node<T>>;
  private disabledKeys: Set<Key>;
  private disabledBehavior: DisabledBehavior;
  private ref: RefLike;
  private collator: Intl.Collator | undefined;
  private layout: "stack" | "grid";
  private orientation?: Orientation;
  private direction?: Direction | undefined;
  private layoutDelegate: LayoutDelegate;

  constructor(collection: Collection<Node<T>>, disabledKeys: Set<Key>, ref: RefLike, collator?: Intl.Collator, expandedKeys?: Set<Key>);
  constructor(options: ListKeyboardDelegateOptions<T>);
  constructor(...args: any[]) {
    if (args.length === 1) {
      const opts = args[0] as ListKeyboardDelegateOptions<T>;
      this.collection = opts.collection;
      this.ref = opts.ref;
      this.collator = opts.collator;
      this.disabledKeys = opts.disabledKeys || new Set();
      this.disabledBehavior = opts.disabledBehavior || "all";
      this.orientation = opts.orientation || "vertical";
      this.direction = opts.direction;
      this.layout = opts.layout || "stack";
      this.layoutDelegate = opts.layoutDelegate || new DOMLayoutDelegate(opts.ref);
    } else {
      this.collection = args[0];
      this.disabledKeys = args[1];
      this.ref = args[2];
      this.collator = args[3];
      this.layout = "stack";
      this.orientation = "vertical";
      this.disabledBehavior = "all";
      this.layoutDelegate = new DOMLayoutDelegate(this.ref);
    }
    // If this is a vertical stack, remove the left/right methods completely so they aren't called
    // by useDroppableCollection.
    if (this.layout === "stack" && this.orientation === "vertical") {
      this.getKeyLeftOf = undefined;
      this.getKeyRightOf = undefined;
    }
  }

  private isDisabled(item: Node<unknown>): boolean {
    return this.disabledBehavior === "all" && (item.props?.isDisabled || this.disabledKeys.has(item.key)) && item.props?.disabledBehavior !== "selection";
  }

  private findNextNonDisabled(key: Key | null, getNext: (key: Key) => Key | null, includeDisabled = false): Key | null {
    let nextKey = key;
    while (nextKey != null) {
      const item = this.collection.getItem(nextKey);
      if (item?.type === "item" && (includeDisabled || !this.isDisabled(item))) return nextKey;
      nextKey = getNext(nextKey);
    }
    return null;
  }

  getNextKey(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    const nextKey = this.collection.getKeyAfter(key);
    return this.findNextNonDisabled(nextKey, (k) => this.collection.getKeyAfter(k), options?.includeDisabled);
  }

  getPreviousKey(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    const nextKey = this.collection.getKeyBefore(key);
    return this.findNextNonDisabled(nextKey, (k) => this.collection.getKeyBefore(k), options?.includeDisabled);
  }

  private findKey(key: Key, nextKey: (key: Key) => Key | null, shouldSkip: (prevRect: Rect, itemRect: Rect) => boolean): Key | null {
    let tempKey: Key | null = key;
    let itemRect = this.layoutDelegate.getItemRect(tempKey);
    if (!itemRect || tempKey == null) return null;
    // Find the item above or below in the same column.
    const prevRect = itemRect;
    do {
      tempKey = nextKey(tempKey);
      if (tempKey == null) break;
      itemRect = this.layoutDelegate.getItemRect(tempKey);
    } while (itemRect && shouldSkip(prevRect, itemRect) && tempKey != null);
    return tempKey;
  }

  private isSameRow(prevRect: Rect, itemRect: Rect): boolean {
    return prevRect.y === itemRect.y || prevRect.x !== itemRect.x;
  }

  private isSameColumn(prevRect: Rect, itemRect: Rect): boolean {
    return prevRect.x === itemRect.x || prevRect.y !== itemRect.y;
  }

  // Whether the next/prev key is spatially above/below the current key (column-reverse layouts).
  private isReversed(key: Key): boolean {
    const container = refElement(this.ref);
    const nextKey = this.getNextKey(key);
    const currentEl = getItemElement(container, key);
    if (nextKey != null) {
      const nextEl = getItemElement(container, nextKey);
      if (!currentEl || !nextEl) return false;
      return currentEl.getBoundingClientRect().top > nextEl.getBoundingClientRect().top;
    }
    const prevKey = this.getPreviousKey(key);
    if (prevKey != null) {
      const prevEl = getItemElement(container, prevKey);
      if (!currentEl || !prevEl) return false;
      return prevEl.getBoundingClientRect().top > currentEl.getBoundingClientRect().top;
    }
    return false;
  }

  getKeyBelow(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    if (this.layout === "grid" && this.orientation === "vertical") return this.findKey(key, (k) => this.getNextKey(k, options), this.isSameRow);
    else if (this.orientation === "vertical") return this.isReversed(key) ? this.getPreviousKey(key, options) : this.getNextKey(key, options);
    return this.getNextKey(key, options);
  }

  getKeyAbove(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    if (this.layout === "grid" && this.orientation === "vertical") return this.findKey(key, (k) => this.getPreviousKey(k, options), this.isSameRow);
    else if (this.orientation === "vertical") return this.isReversed(key) ? this.getNextKey(key, options) : this.getPreviousKey(key, options);
    return this.getPreviousKey(key, options);
  }

  private getNextColumn(key: Key, right: boolean, options?: { includeDisabled?: boolean }): Key | null {
    return right ? this.getPreviousKey(key, options) : this.getNextKey(key, options);
  }

  getKeyRightOf?(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    const method = this.direction === "ltr" ? "getKeyRightOf" : "getKeyLeftOf";
    const spatial = this.layoutDelegate[method];
    if (spatial) {
      const k = spatial.call(this.layoutDelegate, key);
      return this.findNextNonDisabled(k, (x) => spatial.call(this.layoutDelegate, x), options?.includeDisabled);
    }
    if (this.layout === "grid") {
      if (this.orientation === "vertical") return this.getNextColumn(key, this.direction === "rtl", options);
      return this.findKey(key, (k) => this.getNextColumn(k, this.direction === "rtl", options), this.isSameColumn);
    } else if (this.orientation === "horizontal") return this.getNextColumn(key, this.direction === "rtl", options);
    return null;
  }

  getKeyLeftOf?(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    const method = this.direction === "ltr" ? "getKeyLeftOf" : "getKeyRightOf";
    const spatial = this.layoutDelegate[method];
    if (spatial) {
      const k = spatial.call(this.layoutDelegate, key);
      return this.findNextNonDisabled(k, (x) => spatial.call(this.layoutDelegate, x), options?.includeDisabled);
    }
    if (this.layout === "grid") {
      if (this.orientation === "vertical") return this.getNextColumn(key, this.direction === "ltr", options);
      return this.findKey(key, (k) => this.getNextColumn(k, this.direction === "ltr", options), this.isSameColumn);
    } else if (this.orientation === "horizontal") return this.getNextColumn(key, this.direction === "ltr", options);
    return null;
  }

  getFirstKey(): Key | null {
    const key = this.collection.getFirstKey();
    return this.findNextNonDisabled(key, (k) => this.collection.getKeyAfter(k));
  }

  getLastKey(): Key | null {
    const key = this.collection.getLastKey();
    return this.findNextNonDisabled(key, (k) => this.collection.getKeyBefore(k));
  }

  getKeyPageAbove(key: Key): Key | null {
    const menu = refElement(this.ref);
    let itemRect = this.layoutDelegate.getItemRect(key);
    if (!itemRect) return null;
    const reversed = this.isReversed(key);
    if (menu && !isScrollable(menu)) return this.getFirstKey();
    let nextKey: Key | null = key;
    if (this.orientation === "horizontal") {
      const pageX = Math.max(0, itemRect.x + itemRect.width - this.layoutDelegate.getVisibleRect().width);
      while (itemRect && itemRect.x > pageX && nextKey != null) {
        nextKey = this.getKeyAbove(nextKey);
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey);
      }
    } else {
      const visibleRect = this.layoutDelegate.getVisibleRect();
      // Column reverse makes y negative for items, so use current pos - height instead.
      const pageY = reversed ? itemRect.y - visibleRect.height : Math.max(0, itemRect.y + itemRect.height - visibleRect.height);
      while (itemRect && itemRect.y > pageY && nextKey != null) {
        nextKey = this.getKeyAbove(nextKey);
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey);
      }
    }
    return nextKey ?? (reversed ? this.getLastKey() : this.getFirstKey());
  }

  getKeyPageBelow(key: Key): Key | null {
    const menu = refElement(this.ref);
    let itemRect = this.layoutDelegate.getItemRect(key);
    if (!itemRect) return null;
    const reversed = this.isReversed(key);
    if (menu && !isScrollable(menu)) return this.getLastKey();
    let nextKey: Key | null = key;
    if (this.orientation === "horizontal") {
      const pageX = Math.min(this.layoutDelegate.getContentSize().width, itemRect.x - itemRect.width + this.layoutDelegate.getVisibleRect().width);
      while (itemRect && itemRect.x < pageX && nextKey != null) {
        nextKey = this.getKeyBelow(nextKey);
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey);
      }
    } else {
      const pageY = Math.min(this.layoutDelegate.getContentSize().height, itemRect.y - itemRect.height + this.layoutDelegate.getVisibleRect().height);
      while (itemRect && itemRect.y < pageY && nextKey != null) {
        nextKey = this.getKeyBelow(nextKey);
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey);
      }
    }
    return nextKey ?? (reversed ? this.getFirstKey() : this.getLastKey());
  }

  getKeyForSearch(search: string, fromKey?: Key | null): Key | null {
    if (!this.collator) return null;
    const collection = this.collection;
    let key = fromKey || this.getFirstKey();
    while (key != null) {
      const item = collection.getItem(key);
      if (!item) return null;
      const substring = item.textValue.slice(0, search.length);
      if (item.textValue && this.collator.compare(substring, search) === 0) return key;
      key = this.getNextKey(key);
    }
    return null;
  }
}

const collators = new Map<string, Intl.Collator>();

/** Search collator (react-aria `useCollator({ usage: "search", sensitivity: "base" })`), cached per locale. */
export function searchCollator(locale?: string): Intl.Collator {
  const lang = locale ?? (typeof document !== "undefined" ? document.documentElement.lang || undefined : undefined) ?? "en-US";
  let collator = collators.get(lang);
  if (!collator) {
    collator = new Intl.Collator(lang, { usage: "search", sensitivity: "base" });
    collators.set(lang, collator);
  }
  return collator;
}
