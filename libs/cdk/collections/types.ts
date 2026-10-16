// Ported from @react-types/shared (collections.d.ts, selection.d.ts), Apache-2.0, © Adobe.
// Collection / node / selection types shared by every collection, selection manager and keyboard
// delegate. Pure types: zero bytes at runtime.

/** Item key: serializable, rendered as `data-key`. */
export type Key = string | number;

/** Rendered content of a node (Rivet content: string, node, accessor, …). */
export type Rendered = unknown;

export type SelectionMode = "none" | "single" | "multiple";
export type SelectionBehavior = "toggle" | "replace";
/** `"all"` (select all, including items not loaded yet) or a set of keys. */
export type Selection = "all" | Set<Key>;
export type FocusStrategy = "first" | "last";
export type DisabledBehavior = "selection" | "all";
export type Orientation = "horizontal" | "vertical";
export type Direction = "ltr" | "rtl";
export type LoadingState = "loading" | "sorting" | "loadingMore" | "error" | "idle" | "filtering";

export interface SortDescriptor {
  /** The key of the column to sort by. */
  column: Key;
  /** The direction to sort by. */
  direction: SortDirection;
}
export type SortDirection = "ascending" | "descending";

/** A generic interface to access a readonly sequential collection of unique keyed items. */
export interface Collection<T> extends Iterable<T> {
  /** The number of items in the collection. */
  readonly size: number;
  /** Iterate over all keys in the collection. */
  getKeys(): Iterable<Key>;
  /** Get an item by its key. */
  getItem(key: Key): T | null;
  /** Get an item by the index of its key. */
  at(idx: number): T | null;
  /** Get the key that comes before the given key in the collection. */
  getKeyBefore(key: Key): Key | null;
  /** Get the key that comes after the given key in the collection. */
  getKeyAfter(key: Key): Key | null;
  /** Get the first key in the collection. */
  getFirstKey(): Key | null;
  /** Get the last key in the collection. */
  getLastKey(): Key | null;
  /** Iterate over the child items of the given key. */
  getChildren?(key: Key): Iterable<T>;
  /** Returns a string representation of the item's contents. */
  getTextValue?(key: Key): string;
  /** Filters the collection using the given function. */
  filter?(filterFn: (nodeValue: string, node: T) => boolean): Collection<T>;
}

export interface Node<T> {
  /** The type of item this node represents. */
  type: string;
  /** A unique key for the node. */
  key: Key;
  /** The object value the node was created from. */
  value: T | null;
  /** The level of depth this node is at in the hierarchy. */
  level: number;
  /** Whether this item has children, even if not loaded yet. */
  hasChildNodes: boolean;
  /**
   * The loaded children of this node.
   * @deprecated Use `collection.getChildren(node.key)` instead.
   */
  childNodes: Iterable<Node<T>>;
  /** The rendered contents of this node. */
  rendered: Rendered;
  /** A string value for this node, used for features like typeahead. */
  textValue: string;
  /** An accessibility label for this node. */
  "aria-label"?: string | undefined;
  /** The index of this node within its parent. */
  index: number;
  /** A function that should be called to wrap the rendered node. */
  wrapper?: ((element: Rendered) => Rendered) | undefined;
  /** The key of the parent node. */
  parentKey?: Key | null | undefined;
  /** The key of the node before this node. */
  prevKey?: Key | null | undefined;
  /** The key of the node after this node. */
  nextKey?: Key | null | undefined;
  /** The first child key of this node. */
  firstChildKey?: Key | null | undefined;
  /** The last child key of this node. */
  lastChildKey?: Key | null | undefined;
  /** Additional properties specific to a particular node type. */
  props?: any;
  /** @private */
  shouldInvalidate?: ((context: any) => boolean) | undefined;
  /** A function that renders this node. */
  render?: ((node: Node<any>) => Rendered) | undefined;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A KeyboardDelegate returns collection item keys with respect to visual layout. */
export interface KeyboardDelegate {
  /** Returns the key visually below the given one, or `null` for none. */
  getKeyBelow?(key: Key, options?: { includeDisabled?: boolean }): Key | null;
  /** Returns the key visually above the given one, or `null` for none. */
  getKeyAbove?(key: Key, options?: { includeDisabled?: boolean }): Key | null;
  /** Returns the key visually to the left of the given one, or `null` for none. */
  getKeyLeftOf?(key: Key, options?: { includeDisabled?: boolean }): Key | null;
  /** Returns the key visually to the right of the given one, or `null` for none. */
  getKeyRightOf?(key: Key, options?: { includeDisabled?: boolean }): Key | null;
  /** Returns the key visually one page below the given one, or `null` for none. */
  getKeyPageBelow?(key: Key): Key | null;
  /** Returns the key visually one page above the given one, or `null` for none. */
  getKeyPageAbove?(key: Key): Key | null;
  /** Returns the first key, or `null` for none. */
  getFirstKey?(key?: Key | null, global?: boolean): Key | null;
  /** Returns the last key, or `null` for none. */
  getLastKey?(key?: Key | null, global?: boolean): Key | null;
  /** Returns the next key after `fromKey` that matches the given search string, or `null` for none. */
  getKeyForSearch?(search: string, fromKey?: Key | null): Key | null;
}

/** A LayoutDelegate provides layout information for collection items. */
export interface LayoutDelegate {
  /** Returns a rectangle for the item with the given key. */
  getItemRect(key: Key): Rect | null;
  /** Returns the visible rectangle of the collection. */
  getVisibleRect(): Rect;
  /** Returns the size of the scrollable content in the collection. */
  getContentSize(): Size;
  /** Returns a list of keys between `from` and `to`. */
  getKeyRange?(from: Key, to: Key): Key[];
  /** Optional spatial overrides (card / waterfall layouts). */
  getKeyRightOf?(key: Key): Key | null;
  getKeyLeftOf?(key: Key): Key | null;
}

// --- Builder props (react-stately `Item` / `Section`) -------------------------------------------

/** Link props of an item (`LinkDOMProps`). */
export interface LinkDOMProps {
  href?: string | undefined;
  hrefLang?: string | undefined;
  target?: string | undefined;
  rel?: string | undefined;
  download?: boolean | string | undefined;
  ping?: string | undefined;
  referrerPolicy?: string | undefined;
  routerOptions?: unknown;
}

export interface ItemProps<T> extends LinkDOMProps {
  /** Unique key (React's element `key`). */
  key?: Key | undefined;
  /** Rendered contents of the item or child items. */
  children?: Rendered | CollectionElement<T> | CollectionElement<T>[];
  /** Rendered contents of the item if `children` contains child items. */
  title?: Rendered;
  /** A string representation of the item's contents, used for features like typeahead. */
  textValue?: string | undefined;
  /** An accessibility label for this item. */
  "aria-label"?: string | undefined;
  /** A list of child item objects. Used for dynamic collections. */
  childItems?: Iterable<T> | undefined;
  /** Whether this item has children, even if not loaded yet. */
  hasChildItems?: boolean | undefined;
  /** Item-level disabled flag (react-aria-components). */
  isDisabled?: boolean | undefined;
  [prop: string]: unknown;
}

export interface SectionProps<T> {
  key?: Key | undefined;
  /** Rendered contents of the section, e.g. a header. */
  title?: Rendered;
  /** An accessibility label for the section. */
  "aria-label"?: string | undefined;
  /** Static child items or a function to render children. */
  children: CollectionElement<T> | CollectionElement<T>[] | ItemRenderer<T>;
  /** Item objects in the section. */
  items?: Iterable<T> | undefined;
  [prop: string]: unknown;
}

/**
 * A collection element: what `Item(…)` / `Section(…)` return (React's `<Item>` element). `type`
 * carries the `getCollectionNode` generator; `key` is the element key.
 */
export interface CollectionElement<T = unknown, P = any> {
  readonly $$collection: true;
  readonly type: CollectionComponent<T, P>;
  readonly key: Key | null;
  readonly props: P;
}

/** A component the builder understands (react-stately's static `getCollectionNode`). */
export interface CollectionComponent<T = unknown, P = any> {
  (props: P): CollectionElement<T, P>;
  getCollectionNode(props: P, context: any): Generator<PartialNode<T>, void, Node<T>[]>;
}

export type ItemRenderer<T> = (item: T) => CollectionElement<T> | null;
export type CollectionChildren<T> = CollectionElement<T> | null | (CollectionElement<T> | null)[] | ItemRenderer<T>;

export interface CollectionBase<T> {
  /** The contents of the collection. */
  children: CollectionChildren<T>;
  /** Item objects in the collection. */
  items?: Iterable<T> | undefined;
  /** The item keys that are disabled. These items cannot be selected, focused, or otherwise interacted with. */
  disabledKeys?: Iterable<Key> | undefined;
}

export interface CollectionStateBase<T, C extends Collection<Node<T>> = Collection<Node<T>>> extends Partial<CollectionBase<T>> {
  /** A pre-constructed collection to use instead of building one from items and children. */
  collection?: C | undefined;
}

/** A partial node yielded by `getCollectionNode` (react-stately `PartialNode`). */
export interface PartialNode<T> {
  type?: string | undefined;
  key?: Key | null | undefined;
  value?: T | undefined;
  element?: CollectionElement<T> | null | undefined;
  wrapper?: ((element: Rendered) => Rendered) | undefined;
  rendered?: Rendered;
  textValue?: string | undefined;
  "aria-label"?: string | undefined;
  index?: number | undefined;
  renderer?: ItemRenderer<T> | undefined;
  hasChildNodes?: boolean | undefined;
  childNodes?: (() => IterableIterator<PartialNode<T>>) | undefined;
  props?: any;
  shouldInvalidate?: ((context: any) => boolean) | undefined;
}
