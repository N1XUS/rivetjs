// Minimal collection adapter for the virtualizer layouts: `Node` / `Collection` shapes of @react-types/shared,
// `ListCollection` ported from React Spectrum (react-stately/src/list/ListCollection.ts) and the child helpers of
// react-stately/src/collections/getChildNodes.ts, Apache-2.0, © Adobe.
// Rivet: nodes are built from plain item arrays (`createCollection`); no JSX collection builder. Deliberately
// minimal (layouts only read `key` / `type` / `childNodes`); `Key` comes from `@rivetjs/cdk/collections`.
import type { Key } from "../collections/index.ts";

export interface Node<T> {
  /** The type of item this node represents (`item`, `section`, `header`, `loader`, `separator`, …). */
  type: string;
  /** A unique key for the node. */
  key: Key;
  /** The object value the node was created from. */
  value: T | null;
  /** The level of depth this node is at in the hierarchy. */
  level: number;
  /** Whether this item has children, even if not loaded yet. */
  hasChildNodes: boolean;
  /** The loaded children of this node (prefer `collection.getChildren(node.key)`). */
  childNodes: Iterable<Node<T>>;
  /** Rendered contents marker; layouts only test it for truthiness (headers). */
  rendered: unknown;
  /** A string value for this node, used for features like typeahead. */
  textValue: string;
  /** An accessibility label for this node. */
  "aria-label"?: string;
  /** The index of this node within its parent. */
  index: number;
  /** The key of the parent node. */
  parentKey?: Key | null;
  /** The key of the node before this node. */
  prevKey?: Key | null;
  /** The key of the node after this node. */
  nextKey?: Key | null;
  /** The first child key of this node. */
  firstChildKey?: Key | null;
  /** The last child key of this node. */
  lastChildKey?: Key | null;
  /** Additional properties specific to a particular node type (loaders: `isLoading`; columns: widths). */
  props?: any;
}

/** A readonly sequential collection of unique keyed items (iterates the top-level nodes). */
export interface Collection<T> extends Iterable<T> {
  /** The number of items (and sections) in the collection. */
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
}

/** Collection over nodes: sections are flattened into the key map, `size` counts items and sections. */
export class ListCollection<T> implements Collection<Node<T>> {
  private keyMap: Map<Key, Node<T>> = new Map();
  private iterable: Iterable<Node<T>>;
  private firstKey: Key | null = null;
  private lastKey: Key | null;
  private _size: number;

  constructor(nodes: Iterable<Node<T>>) {
    this.iterable = nodes;
    const visit = (node: Node<T>) => {
      this.keyMap.set(node.key, node);
      if (node.childNodes && node.type === "section") for (const child of node.childNodes) visit(child);
    };
    for (const node of nodes) visit(node);

    let last: Node<T> | null = null;
    let index = 0;
    let size = 0;
    for (const [key, node] of this.keyMap) {
      if (last) {
        last.nextKey = key;
        node.prevKey = last.key;
      } else {
        this.firstKey = key;
        node.prevKey = undefined;
      }
      if (node.type === "item") node.index = index++;
      // Only sections and items count, so loaders and separators don't influence the empty state.
      if (node.type === "section" || node.type === "item") size++;
      last = node;
      last.nextKey = undefined;
    }
    this._size = size;
    this.lastKey = last?.key ?? null;
  }

  *[Symbol.iterator](): IterableIterator<Node<T>> {
    yield* this.iterable;
  }

  get size(): number {
    return this._size;
  }

  getKeys(): IterableIterator<Key> {
    return this.keyMap.keys();
  }

  getKeyBefore(key: Key): Key | null {
    return this.keyMap.get(key)?.prevKey ?? null;
  }

  getKeyAfter(key: Key): Key | null {
    return this.keyMap.get(key)?.nextKey ?? null;
  }

  getFirstKey(): Key | null {
    return this.firstKey;
  }

  getLastKey(): Key | null {
    return this.lastKey;
  }

  getItem(key: Key): Node<T> | null {
    return this.keyMap.get(key) ?? null;
  }

  at(idx: number): Node<T> | null {
    const keys = [...this.getKeys()];
    return keys[idx] === undefined ? null : this.getItem(keys[idx]!);
  }

  getChildren(key: Key): Iterable<Node<T>> {
    return this.keyMap.get(key)?.childNodes || [];
  }

  getTextValue(key: Key): string {
    return this.keyMap.get(key)?.textValue ?? "";
  }
}

export interface CollectionOptions<T> {
  /** Item key (default: `item.key ?? item.id`, or the item itself for strings / numbers). */
  getKey?: (item: T, index: number) => Key;
  /** Node type (default: `item.type ?? "item"`). Sections (`"section"`) hold `getChildren(item)` nodes. */
  getType?: (item: T) => string;
  /** Children of a section (default `item.children`). */
  getChildren?: (item: T) => Iterable<T> | null | undefined;
  /** Typeahead text (default `item.textValue ?? item.label ?? String(item)`). */
  getTextValue?: (item: T) => string;
  /** Extra node props (default `item.props ?? {}`; columns read `width` / `minWidth` / `maxWidth` there). */
  getProps?: (item: T) => any;
}

const field = (item: unknown, name: string): any => (item != null && typeof item === "object" ? (item as Record<string, unknown>)[name] : undefined);

/** Default key of an item: `key`, else `id`, else the primitive itself. */
export function itemKey(item: unknown, index: number): Key {
  if (item == null || typeof item !== "object") return typeof item === "number" || typeof item === "string" ? item : index;
  return field(item, "key") ?? field(item, "id") ?? index;
}

/** Nodes of `items` (sections recurse into their children; `level` / `parentKey` / `index` set). */
export function buildNodes<T>(items: Iterable<T>, options: CollectionOptions<T> = {}, parentKey: Key | null = null, level = 0): Node<T>[] {
  const nodes: Node<T>[] = [];
  let index = 0;
  for (const item of items) {
    const key = options.getKey ? options.getKey(item, index) : itemKey(item, index);
    const type = options.getType?.(item) ?? field(item, "type") ?? "item";
    const children = type === "section" ? (options.getChildren?.(item) ?? field(item, "children")) : null;
    const childNodes = children ? buildNodes<T>(children, options, key, level + 1) : [];
    const text = options.getTextValue?.(item) ?? field(item, "textValue") ?? field(item, "label") ?? (typeof item === "object" ? "" : String(item));
    nodes.push({
      type,
      key,
      value: item,
      level,
      hasChildNodes: childNodes.length > 0,
      childNodes,
      rendered: true,
      textValue: String(text),
      index: index++,
      parentKey,
      firstChildKey: childNodes[0]?.key ?? null,
      lastChildKey: childNodes.at(-1)?.key ?? null,
      props: options.getProps?.(item) ?? field(item, "props") ?? {},
    });
  }
  return nodes;
}

/** A loader sentinel node ("load more"), rendered after the items; `isLoading` reserves the loader size. */
export function loaderNode<T>(key: Key, isLoading: boolean, parentKey: Key | null = null): Node<T> {
  return {
    type: "loader",
    key,
    value: null,
    level: 0,
    hasChildNodes: false,
    childNodes: [],
    rendered: true,
    textValue: "",
    index: 0,
    parentKey,
    props: { isLoading },
  };
}

/** A collection from plain items (see `CollectionOptions`); `extra` nodes (e.g. a loader) are appended. */
export function createCollection<T>(items: Iterable<T>, options: CollectionOptions<T> = {}, extra: Node<T>[] = []): ListCollection<T> {
  return new ListCollection<T>([...buildNodes(items, options), ...extra]);
}

/** Children of `node` (`collection.getChildren` when available, else `node.childNodes`). */
export function getChildNodes<T>(node: Node<T>, collection: Collection<Node<T>>): Iterable<Node<T>> {
  if (typeof collection.getChildren === "function") return collection.getChildren(node.key);
  return node.childNodes;
}

export function getFirstItem<T>(iterable: Iterable<T>): T | undefined {
  return getNthItem(iterable, 0);
}

export function getNthItem<T>(iterable: Iterable<T>, index: number): T | undefined {
  if (index < 0) return undefined;
  let i = 0;
  for (const item of iterable) {
    if (i === index) return item;
    i++;
  }
}

export function getLastItem<T>(iterable: Iterable<T>): T | undefined {
  let lastItem: T | undefined = undefined;
  for (const value of iterable) lastItem = value;
  return lastItem;
}
