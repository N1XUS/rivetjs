// Ported from @react-stately/list (ListCollection.ts), Apache-2.0, © Adobe.
import type { Collection, Key, Node } from "./types.ts";

/** A flat (optionally sectioned) collection: sections and their items, in order. */
export class ListCollection<T> implements Collection<Node<T>> {
  private keyMap: Map<Key, Node<T>> = new Map();
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
      // Only count sections and items when determining size so that loaders and separators don't
      // influence the empty state determination.
      if (node.type === "section" || node.type === "item") size++;
      last = node;
      // Set nextKey as undefined since this might be the last node.
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
    const node = this.keyMap.get(key);
    return node ? (node.prevKey ?? null) : null;
  }

  getKeyAfter(key: Key): Key | null {
    const node = this.keyMap.get(key);
    return node ? (node.nextKey ?? null) : null;
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
    const node = this.keyMap.get(key);
    return node?.childNodes || [];
  }
}
