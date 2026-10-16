// Ported from @react-aria/collections (BaseCollection.ts; the commit logic of Document.ts and
// CollectionBuilder.tsx), Apache-2.0, © Adobe.
//
// The collection model react-aria-components uses: immutable linked nodes (prev/next/parent/
// first/last child keys) in a key map, filterable, cloneable. React builds it by rendering the JSX
// into a fake DOM through a portal; Rivet builds it from a node tree (`buildCollection`) or from
// the server-rendered DOM (`./dom` `domCollection`). See the parity spec for the deviation.
import type { Collection as ICollection, Key, Node, Rendered } from "./types.ts";

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

type FilterFn<T> = (textValue: string, node: Node<T>) => boolean;

/** An immutable object representing a Node in a Collection. */
export class CollectionNode<T> implements Node<T> {
  static readonly type: string;
  readonly type: string;
  readonly key: Key;
  readonly value: T | null = null;
  readonly level: number = 0;
  readonly hasChildNodes: boolean = false;
  readonly rendered: Rendered = null;
  readonly textValue: string = "";
  readonly "aria-label"?: string | undefined = undefined;
  readonly index: number = 0;
  readonly parentKey: Key | null = null;
  readonly prevKey: Key | null = null;
  readonly nextKey: Key | null = null;
  readonly firstChildKey: Key | null = null;
  readonly lastChildKey: Key | null = null;
  readonly props: any = {};
  readonly render?: ((node: Node<any>) => Rendered) | undefined;
  readonly colSpan: number | null = null;
  readonly colIndex: number | null = null;

  constructor(key: Key) {
    this.type = (this.constructor as typeof CollectionNode).type;
    this.key = key;
  }

  get childNodes(): Iterable<Node<T>> {
    throw new Error("childNodes is not supported");
  }

  clone(): this {
    const node: Mutable<this> = new (this.constructor as any)(this.key);
    node.value = this.value;
    node.level = this.level;
    node.hasChildNodes = this.hasChildNodes;
    node.rendered = this.rendered;
    node.textValue = this.textValue;
    node["aria-label"] = this["aria-label"];
    node.index = this.index;
    node.parentKey = this.parentKey;
    node.prevKey = this.prevKey;
    node.nextKey = this.nextKey;
    node.firstChildKey = this.firstChildKey;
    node.lastChildKey = this.lastChildKey;
    node.props = this.props;
    node.render = this.render;
    node.colSpan = this.colSpan;
    node.colIndex = this.colIndex;
    return node;
  }

  filter(collection: BaseCollection<T>, newCollection: BaseCollection<T>, _filterFn: FilterFn<T>): CollectionNode<T> | null {
    const clone = this.clone();
    newCollection.addDescendants(clone, collection);
    return clone;
  }
}

export class FilterableNode<T> extends CollectionNode<T> {
  override filter(collection: BaseCollection<T>, newCollection: BaseCollection<T>, filterFn: FilterFn<T>): CollectionNode<T> | null {
    const [firstKey, lastKey] = filterChildren(collection, newCollection, this.firstChildKey, filterFn);
    const newNode: Mutable<CollectionNode<T>> = this.clone();
    newNode.firstChildKey = firstKey;
    newNode.lastChildKey = lastKey;
    return newNode;
  }
}

export class HeaderNode extends CollectionNode<unknown> {
  static override readonly type = "header";
}

export class LoaderNode extends CollectionNode<unknown> {
  static override readonly type = "loader";
}

export class ItemNode<T> extends FilterableNode<T> {
  static override readonly type = "item";

  override filter(collection: BaseCollection<T>, newCollection: BaseCollection<T>, filterFn: FilterFn<T>): ItemNode<T> | null {
    if (filterFn(this.textValue, this)) {
      const clone = this.clone();
      newCollection.addDescendants(clone, collection);
      return clone;
    }
    return null;
  }
}

export class SectionNode<T> extends FilterableNode<T> {
  static override readonly type = "section";

  override filter(collection: BaseCollection<T>, newCollection: BaseCollection<T>, filterFn: FilterFn<T>): SectionNode<T> | null {
    const filteredSection = super.filter(collection, newCollection, filterFn);
    if (filteredSection && filteredSection.lastChildKey !== null) {
      const lastChild = collection.getItem(filteredSection.lastChildKey);
      if (lastChild && lastChild.type !== "header") return filteredSection as SectionNode<T>;
    }
    return null;
  }
}

/**
 * An immutable Collection implementation. Updates are only allowed when it is not marked as frozen.
 * This can be subclassed to implement custom collection behaviors.
 */
export class BaseCollection<T> implements ICollection<Node<T>> {
  protected keyMap: Map<Key, CollectionNode<T>> = new Map();
  protected firstKey: Key | null = null;
  protected lastKey: Key | null = null;
  protected frozen = false;
  protected itemCount: number = 0;

  get size(): number {
    return this.itemCount;
  }

  /** Whether the collection is committed (no further mutation). */
  get isFrozen(): boolean {
    return this.frozen;
  }

  getKeys(): IterableIterator<Key> {
    return this.keyMap.keys();
  }

  *[Symbol.iterator](): IterableIterator<Node<T>> {
    let node: Node<T> | undefined = this.firstKey != null ? this.keyMap.get(this.firstKey) : undefined;
    while (node) {
      yield node;
      node = node.nextKey != null ? this.keyMap.get(node.nextKey) : undefined;
    }
  }

  getChildren(key: Key): Iterable<Node<T>> {
    const keyMap = this.keyMap;
    return {
      *[Symbol.iterator]() {
        const parent = keyMap.get(key);
        let node = parent?.firstChildKey != null ? keyMap.get(parent.firstChildKey) : null;
        while (node) {
          yield node as Node<T>;
          node = node.nextKey != null ? keyMap.get(node.nextKey) : undefined;
        }
      },
    };
  }

  getKeyBefore(key: Key): Key | null {
    let node = this.keyMap.get(key);
    if (!node) return null;
    if (node.prevKey != null) {
      node = this.keyMap.get(node.prevKey);
      while (node && node.type !== "item" && node.lastChildKey != null) node = this.keyMap.get(node.lastChildKey);
      return node?.key ?? null;
    }
    return node.parentKey;
  }

  getKeyAfter(key: Key): Key | null {
    let node = this.keyMap.get(key);
    if (!node) return null;
    if (node.type !== "item" && node.firstChildKey != null) return node.firstChildKey;
    while (node) {
      if (node.nextKey != null) return node.nextKey;
      if (node.parentKey != null) node = this.keyMap.get(node.parentKey);
      else return null;
    }
    return null;
  }

  getFirstKey(): Key | null {
    return this.firstKey;
  }

  getLastKey(): Key | null {
    let node = this.lastKey != null ? this.keyMap.get(this.lastKey) : null;
    while (node?.lastChildKey != null) node = this.keyMap.get(node.lastChildKey);
    return node?.key ?? null;
  }

  getItem(key: Key): Node<T> | null {
    return this.keyMap.get(key) ?? null;
  }

  at(): Node<T> {
    throw new Error("Not implemented");
  }

  clone(): this {
    const Constructor: any = this.constructor;
    const collection: this = new Constructor();
    collection.keyMap = new Map(this.keyMap);
    collection.firstKey = this.firstKey;
    collection.lastKey = this.lastKey;
    collection.itemCount = this.itemCount;
    return collection;
  }

  addNode(node: CollectionNode<T>): void {
    if (this.frozen) throw new Error("Cannot add a node to a frozen collection");
    if (node.type === "item" && this.keyMap.get(node.key) == null) this.itemCount++;
    this.keyMap.set(node.key, node);
  }

  /** Deeply add a node and its children from another collection (filtering). */
  addDescendants(node: CollectionNode<T>, oldCollection: BaseCollection<T>): void {
    this.addNode(node);
    for (const child of oldCollection.getChildren(node.key)) this.addDescendants(child as CollectionNode<T>, oldCollection);
  }

  removeNode(key: Key): void {
    if (this.frozen) throw new Error("Cannot remove a node to a frozen collection");
    const node = this.keyMap.get(key);
    if (node != null && node.type === "item") this.itemCount--;
    this.keyMap.delete(key);
  }

  commit(firstKey: Key | null, lastKey: Key | null, isSSR = false): void {
    if (this.frozen) throw new Error("Cannot commit a frozen collection");
    this.firstKey = firstKey;
    this.lastKey = lastKey;
    this.frozen = !isSSR;
  }

  filter(filterFn: FilterFn<T>): this {
    const newCollection = new (this.constructor as any)();
    const [firstKey, lastKey] = filterChildren(this, newCollection, this.firstKey, filterFn);
    newCollection?.commit(firstKey, lastKey);
    return newCollection;
  }
}

function filterChildren<T>(
  collection: BaseCollection<T>,
  newCollection: BaseCollection<T>,
  firstChildKey: Key | null,
  filterFn: FilterFn<T>,
): [Key | null, Key | null] {
  // Loop over the siblings of firstChildKey, create new nodes with node.filter, update prev/next keys.
  if (firstChildKey == null) return [null, null];
  let firstNode: Node<T> | null = null;
  let lastNode: Mutable<CollectionNode<T>> | null = null;
  let currentNode = collection.getItem(firstChildKey);
  while (currentNode != null) {
    const newNode: Mutable<CollectionNode<T>> | null = (currentNode as CollectionNode<T>).filter(collection, newCollection, filterFn);
    if (newNode != null) {
      newNode.nextKey = null;
      if (lastNode) {
        newNode.prevKey = lastNode.key;
        lastNode.nextKey = newNode.key;
      }
      if (firstNode == null) firstNode = newNode;
      newCollection.addNode(newNode);
      lastNode = newNode;
    }
    currentNode = currentNode.nextKey != null ? collection.getItem(currentNode.nextKey) : null;
  }
  // A trailing separator is dropped once the rest of the contents are filtered.
  if (lastNode && lastNode.type === "separator") {
    const prevKey = lastNode.prevKey;
    newCollection.removeNode(lastNode.key);
    if (prevKey != null) {
      lastNode = newCollection.getItem(prevKey) as Mutable<CollectionNode<T>>;
      lastNode.nextKey = null;
    } else lastNode = null;
  }
  return [firstNode?.key ?? null, lastNode?.key ?? null];
}

// --- Building ----------------------------------------------------------------------------------

export type CollectionNodeClass<T> = {
  new (key: Key): CollectionNode<T>;
  readonly type: string;
  /**
   * Rivet: props (and `value` fields) the part reads live from the collection by key (e.g. a column's widths):
   * a rebuild that changes only these keeps the rendered part (`sameRender`).
   */
  readonly liveProps?: readonly string[] | undefined;
};

const nodeClasses = new Map<string, CollectionNodeClass<any>>();

/** Node class for a string type (RAC accepts strings in createLeafComponent / createBranchComponent). */
export function collectionNodeClass(type: string | CollectionNodeClass<any>): CollectionNodeClass<any> {
  if (typeof type !== "string") return type;
  if (type === "item") return ItemNode;
  if (type === "section") return SectionNode;
  if (type === "header") return HeaderNode;
  if (type === "loader") return LoaderNode;
  let NodeClass = nodeClasses.get(type);
  if (!NodeClass) {
    NodeClass = class extends CollectionNode<any> {
      static override readonly type = type as string;
    };
    nodeClasses.set(type, NodeClass);
  }
  return NodeClass;
}

/** One node of a collection tree (what a RAC leaf / branch component registers). */
export interface CollectionNodeSpec<T = unknown> {
  /** Node class or type string (default "item"). */
  type?: CollectionNodeClass<T> | string | undefined;
  /** Key (RAC `id`); generated (`rivet-<n>`) when missing. */
  id?: Key | undefined;
  value?: T | undefined;
  textValue?: string | undefined;
  "aria-label"?: string | undefined;
  rendered?: Rendered;
  render?: ((node: Node<any>) => Rendered) | undefined;
  /** Remaining props (`node.props`): isDisabled, href, colSpan, … */
  props?: Record<string, any> | undefined;
  /** `props` is a fresh object owned by the spec (collection parts): used as `node.props` without a copy. */
  ownProps?: boolean | undefined;
  /** Hidden nodes stay out of the collection (RAC `display: none` / `<Hidden>`). */
  hidden?: boolean | undefined;
  children?: readonly CollectionNodeSpec<T>[] | undefined;
}

/**
 * Build and commit a collection from a node tree, with the bookkeeping of RAC's fake document:
 * index / level / parent / sibling / first+last visible child keys, colIndex after colSpans, item
 * count, duplicate-key detection. Returns a frozen collection.
 */
export function buildCollection<T, C extends BaseCollection<T> = BaseCollection<T>>(nodes: readonly CollectionNodeSpec<T>[], createCollection?: () => C): C {
  const collection = createCollection ? createCollection() : (new BaseCollection<T>() as C);
  const owners = new Set<Key>();
  let nodeId = 0;

  const create = (spec: CollectionNodeSpec<T>): Mutable<CollectionNode<T>> => {
    const NodeClass = collectionNodeClass(spec.type ?? "item");
    const node: Mutable<CollectionNode<T>> = new NodeClass(spec.id ?? `rivet-${++nodeId}`);
    // `ownProps`: a fresh object of the part (live props: getters stay unread; a spread would read every live prop in
    // the tracked build pass and re-render the rows).
    const props = spec.ownProps ? (spec.props ?? {}) : { ...(spec.props ?? {}) };
    node.props = props;
    node.rendered = spec.rendered;
    node.render = spec.render;
    node.value = spec.value ?? null;
    if (spec["aria-label"]) node["aria-label"] = spec["aria-label"];
    node.textValue = spec.textValue || (typeof spec.rendered === "string" ? spec.rendered : "") || spec["aria-label"] || "";
    if (props.colSpan != null) node.colSpan = props.colSpan;
    return node;
  };

  // Post-order: children get their ids before their parent (RAC registers leaves first, so the
  // auto ids of a section's items precede the section's).
  const childrenOf = new Map<Key, Mutable<CollectionNode<T>>[]>();
  const build = (specs: readonly CollectionNodeSpec<T>[]): Mutable<CollectionNode<T>>[] => {
    const out: Mutable<CollectionNode<T>>[] = [];
    for (const spec of specs) {
      if (spec.hidden) continue;
      const children = build(spec.children ?? []);
      const node = create(spec);
      node.hasChildNodes = (spec.children ?? []).length > 0;
      node.firstChildKey = children[0]?.key ?? null;
      node.lastChildKey = children[children.length - 1]?.key ?? null;
      childrenOf.set(node.key, children);
      out.push(node);
    }
    return out;
  };
  const link = (siblings: Mutable<CollectionNode<T>>[], parent: Mutable<CollectionNode<T>> | null): void => {
    const level = parent ? parent.level + (parent.type === "item" ? 1 : 0) : 0;
    let colIndex: number | null = null;
    siblings.forEach((node, index) => {
      node.index = index;
      node.level = level;
      node.parentKey = parent ? parent.key : null;
      node.prevKey = siblings[index - 1]?.key ?? null;
      node.nextKey = siblings[index + 1]?.key ?? null;
      // Update the colIndex of sibling nodes after a colSpan.
      if (colIndex != null) node.colIndex = colIndex;
      if (node.colSpan != null || node.colIndex != null) colIndex = (node.colIndex ?? node.index) + (node.colSpan ?? 1);
      if (owners.has(node.key)) throw new Error(`Duplicate key "${String(node.key)}" found in collection. Every item in a collection must have a unique key.`);
      owners.add(node.key);
      collection.addNode(node);
      link(childrenOf.get(node.key) ?? [], node);
    });
  };

  const top = build(nodes);
  link(top, null);
  collection.commit(top[0]?.key ?? null, top[top.length - 1]?.key ?? null);
  return collection;
}
