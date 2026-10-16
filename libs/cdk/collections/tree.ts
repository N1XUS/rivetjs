// Ported from @react-stately/tree (TreeCollection.ts), Apache-2.0, © Adobe.
import type { Collection, Key, Node } from "./types.ts";

/** A tree flattened in display order: children of sections and of expanded items are visited. */
export class TreeCollection<T> implements Collection<Node<T>> {
  private keyMap: Map<Key, Node<T>> = new Map();
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

    let last: Node<T> | null = null;
    let index = 0;
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
}
