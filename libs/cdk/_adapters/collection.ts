// Collection model: `Node` / `Collection` (@react-types/shared), node helpers (getChildNodes,
// compareNodeOrder), `ListCollection` / `TreeCollection` (react-stately), and a data builder that
// turns plain items into nodes. Ported from react-spectrum (Apache-2.0, © Adobe):
// packages/react-stately/src/collections/getChildNodes.ts, list/ListCollection.ts, tree/TreeCollection.ts.
//
// LOCAL ADAPTER (aria-grid-tree): stands in for the cdk-collections branch until its API is
// published; then these imports move to `@rivetjs/cdk/collections` and this file goes away.
// Server and tests build collections from data (`buildNodes`); browser handlers build them from the
// rendered DOM (`./dom-collection.ts`) — the DOM is the collection, nothing is serialized.

import type { RouterOptions } from "../utils/links.tsx";

// Shared types: ONE definition in `../collections/types.ts` (@react-types/shared); `SelectionValue` is its `Selection`.
import type {
  Direction,
  DisabledBehavior,
  FocusStrategy,
  Key,
  Orientation,
  Selection as SelectionValue,
  SelectionBehavior,
  SelectionMode,
} from "../collections/types.ts";

export type { Direction, DisabledBehavior, FocusStrategy, Key, Orientation, SelectionBehavior, SelectionMode, SelectionValue };

/** Item props a collection node may carry (react-aria reads these through `node.props`). */
export interface NodeProps {
  isDisabled?: boolean;
  /** Item-level override: `"selection"` keeps a disabled item focusable / actionable. */
  disabledBehavior?: DisabledBehavior;
  href?: string;
  target?: string;
  rel?: string;
  download?: boolean | string;
  ping?: string;
  referrerPolicy?: string;
  routerOptions?: RouterOptions;
  [key: string]: unknown;
}

export interface Node<T = unknown> {
  type: string;
  key: Key;
  value: T | null;
  level: number;
  hasChildNodes: boolean;
  childNodes: Iterable<Node<T>>;
  textValue: string;
  "aria-label"?: string;
  index: number;
  parentKey?: Key | null;
  prevKey?: Key | null;
  nextKey?: Key | null;
  firstChildKey?: Key | null;
  lastChildKey?: Key | null;
  props?: NodeProps;
  /** Grid cells: span and column index (GridCollection). */
  colSpan?: number | null;
  colIndex?: number | null;
  /** The element the node was read from (DOM collections only). */
  element?: Element;
}

export interface Collection<T = Node> extends Iterable<T> {
  readonly size: number;
  getKeys(): Iterable<Key>;
  getItem(key: Key): T | null;
  at(idx: number): T | null;
  getKeyBefore(key: Key): Key | null;
  getKeyAfter(key: Key): Key | null;
  getFirstKey(): Key | null;
  getLastKey(): Key | null;
  getChildren?(key: Key): Iterable<T>;
  getTextValue?(key: Key): string;
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

export interface LayoutDelegate {
  getItemRect(key: Key): Rect | null;
  getVisibleRect(): Rect;
  getContentSize(): Size;
  getKeyRange?(from: Key, to: Key): Key[];
  getKeyRightOf?(key: Key): Key | null;
  getKeyLeftOf?(key: Key): Key | null;
}

export interface KeyboardDelegate {
  getKeyBelow?(key: Key, options?: { includeDisabled?: boolean }): Key | null;
  getKeyAbove?(key: Key, options?: { includeDisabled?: boolean }): Key | null;
  getKeyLeftOf?(key: Key, options?: { includeDisabled?: boolean }): Key | null;
  getKeyRightOf?(key: Key, options?: { includeDisabled?: boolean }): Key | null;
  getKeyPageBelow?(key: Key): Key | null;
  getKeyPageAbove?(key: Key): Key | null;
  getFirstKey?(key?: Key | null, global?: boolean): Key | null;
  getLastKey?(key?: Key | null, global?: boolean): Key | null;
  getKeyForSearch?(search: string, fromKey?: Key | null): Key | null;
}

export interface SortDescriptor {
  column: Key;
  direction: SortDirection;
}
export type SortDirection = "ascending" | "descending";

// --- getChildNodes.ts -------------------------------------------------------------------------

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
  return undefined;
}

export function getLastItem<T>(iterable: Iterable<T>): T | undefined {
  let last: T | undefined;
  for (const value of iterable) last = value;
  return last;
}

export function compareNodeOrder<T>(collection: Collection<Node<T>>, a: Node<T>, b: Node<T>): number {
  if (a.parentKey === b.parentKey) return a.index - b.index;
  const aAncestors = [...getAncestors(collection, a), a];
  const bAncestors = [...getAncestors(collection, b), b];
  const first = aAncestors.slice(0, bAncestors.length).findIndex((node, i) => node !== bAncestors[i]);
  if (first !== -1) return aAncestors[first]!.index - bAncestors[first]!.index;
  if (aAncestors.indexOf(b) >= 0) return 1;
  if (bAncestors.indexOf(a) >= 0) return -1;
  return -1;
}

function getAncestors<T>(collection: Collection<Node<T>>, node: Node<T>): Node<T>[] {
  const parents: Node<T>[] = [];
  let current: Node<T> | null = node;
  while (current?.parentKey != null) {
    current = collection.getItem(current.parentKey);
    if (current) parents.unshift(current);
  }
  return parents;
}

/** Number of item children (react-stately getItemCount). */
export function getItemCount<T>(collection: Iterable<Node<T>>): number {
  let count = 0;
  for (const node of collection) {
    if (node.type === "section") count += getItemCount(node.childNodes);
    else count++;
  }
  return count;
}

// --- ListCollection.ts / TreeCollection.ts -------------------------------------------------------

/** Flat list (+ sections) collection. */
export class ListCollection<T> implements Collection<Node<T>> {
  private keyMap = new Map<Key, Node<T>>();
  private iterable: Iterable<Node<T>>;
  private firstKey: Key | null = null;
  private lastKey: Key | null = null;
  private _size: number;

  constructor(nodes: Iterable<Node<T>>) {
    this.iterable = nodes;
    const visit = (node: Node<T>) => {
      this.keyMap.set(node.key, node);
      if (node.childNodes && node.type === "section") for (const child of node.childNodes) visit(child);
    };
    for (const node of nodes) visit(node);
    let last: Node<T> | null = null,
      index = 0,
      size = 0;
    for (const [key, node] of this.keyMap) {
      if (last) {
        last.nextKey = key;
        node.prevKey = last.key;
      } else {
        this.firstKey = key;
        node.prevKey = undefined;
      }
      if (node.type === "item") node.index = index++;
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
    return this.getItem(keys[idx]!);
  }
  getChildren(key: Key): Iterable<Node<T>> {
    return this.keyMap.get(key)?.childNodes || [];
  }
}

/** Tree collection: only children of expanded nodes (and sections) are part of the key order. */
export class TreeCollection<T> implements Collection<Node<T>> {
  private keyMap = new Map<Key, Node<T>>();
  private iterable: Iterable<Node<T>>;
  private firstKey: Key | null = null;
  private lastKey: Key | null = null;

  constructor(nodes: Iterable<Node<T>>, { expandedKeys }: { expandedKeys?: Set<Key> } = {}) {
    this.iterable = nodes;
    const expanded = expandedKeys || new Set<Key>();
    const visit = (node: Node<T>) => {
      this.keyMap.set(node.key, node);
      if (node.childNodes && (node.type === "section" || expanded.has(node.key))) for (const child of node.childNodes) visit(child);
    };
    for (const node of nodes) visit(node);
    let last: Node<T> | null = null,
      index = 0;
    for (const [key, node] of this.keyMap) {
      if (last) {
        last.nextKey = key;
        node.prevKey = last.key;
      } else {
        this.firstKey = key;
        node.prevKey = undefined;
      }
      if (node.type === "item") node.index = index++;
      last = node;
      last.nextKey = undefined;
    }
    this.lastKey = last?.key ?? null;
  }

  *[Symbol.iterator](): IterableIterator<Node<T>> {
    yield* this.iterable;
  }
  get size(): number {
    return this.keyMap.size;
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
    return this.getItem(keys[idx]!);
  }
}

// --- data → nodes (CollectionBuilder equivalent for data-driven collections) ---------------------

/** A data item of a collection component. */
export interface CollectionItem {
  readonly key: Key;
  /** Text for typeahead and the default render. */
  readonly textValue?: string;
  readonly label?: string;
  readonly isDisabled?: boolean;
  readonly href?: string;
  readonly target?: string;
  readonly rel?: string;
  readonly download?: boolean | string;
  /** Nested items (tree children, section items). */
  readonly children?: readonly CollectionItem[];
  /** `"section"` makes a section (group) of `children`. */
  readonly type?: string;
  readonly [prop: string]: unknown;
}

/** Build nodes from data (react-stately CollectionBuilder for `items`): levels, indices, parent keys. */
export function buildNodes<T extends CollectionItem>(items: readonly T[], options: { parentKey?: Key | null; level?: number } = {}): Node<T>[] {
  const level = options.level ?? 0;
  const nodes: Node<T>[] = [];
  let index = 0;
  for (const item of items) {
    const type = item.type ?? "item";
    const node: Node<T> = {
      type,
      key: item.key,
      value: item,
      level,
      index: index++,
      hasChildNodes: !!item.children?.length,
      childNodes: [],
      textValue: item.textValue ?? item.label ?? "",
      parentKey: options.parentKey ?? null,
      props: {
        ...(item.isDisabled ? { isDisabled: true } : {}),
        ...(item.href != null ? { href: item.href, target: item.target, rel: item.rel, download: item.download } : {}),
      },
    };
    if (item.children?.length) {
      const children = buildNodes(item.children as readonly T[], { parentKey: item.key, level: type === "section" ? level : level + 1 });
      node.childNodes = children;
      node.firstChildKey = children[0]?.key ?? null;
      node.lastChildKey = children[children.length - 1]?.key ?? null;
    }
    nodes.push(node);
  }
  return nodes;
}
