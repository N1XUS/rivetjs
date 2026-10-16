// Ported from react-aria-components (src/Tree.tsx: TreeCollection, areSetsEqual), Apache-2.0, © Adobe.
//
// The collection a RAC Tree renders: the BaseCollection built from `<TreeItem>` / `<TreeSection>`
// parts, flattened for display by the expanded keys — iteration, `getKeyAfter` / `getKeyBefore` /
// `getLastKey` only walk into expanded items (sections always), so keyboard navigation and the
// rendered row list skip collapsed subtrees.
// Rivet:
// - `withExpandedKeys` clones ancestor section nodes exactly as upstream (React re-render trigger;
//   harmless here, kept so virtualized sections see a new node object).
// Deviation: none.
import { BaseCollection, type CollectionNode } from "../collections/base.ts";
import type { Key, Node } from "../collections/types.ts";

export class TreeCollection<T> extends BaseCollection<T> {
  private expandedKeys: Set<Key> = new Set();

  withExpandedKeys(lastExpandedKeys: Set<Key>, expandedKeys: Set<Key>): TreeCollection<T> {
    const collection = this.clone();
    collection.expandedKeys = expandedKeys;

    // Clone ancestor section nodes so a re-render sees a new node object for the changed section.
    TreeCollection.cloneAncestorSections(expandedKeys, lastExpandedKeys, collection);
    TreeCollection.cloneAncestorSections(lastExpandedKeys, expandedKeys, collection);

    collection.frozen = this.frozen;
    return collection;
  }

  // Diff lastExpandedKeys and expandedKeys so only what changed is cloned.
  private static cloneAncestorSections<T>(keys: Iterable<Key>, excludeSet: Set<Key>, collection: TreeCollection<T>): void {
    for (const key of keys) {
      if (!excludeSet.has(key)) {
        let currentKey: Key | null = key;
        while (currentKey != null) {
          const item = collection.getItem(currentKey) as CollectionNode<T> | null;
          if (item?.type === "section") {
            collection.keyMap.set(currentKey, item.clone());
            break;
          } else {
            currentKey = item?.parentKey ?? null;
          }
        }
      }
    }
  }

  /** Whether `key` is expanded in this flattened view. */
  isExpanded(key: Key): boolean {
    return this.expandedKeys.has(key);
  }

  override *[Symbol.iterator](): IterableIterator<Node<T>> {
    const firstKey = this.getFirstKey();
    let node: Node<T> | null = firstKey != null ? this.getItem(firstKey) : null;

    while (node) {
      yield node;
      if (node.type === "section") {
        node = node.nextKey != null ? this.getItem(node.nextKey) : null;
      } else {
        // This includes both item and content nodes; renderers skip content nodes.
        const key = this.getKeyAfter(node.key);
        node = key != null ? this.getItem(key) : null;
      }
    }
  }

  override getLastKey(): Key | null {
    // Find the deepest expanded child: start from the last top-level key and walk down.
    const key = this.lastKey;
    if (key == null) return null;

    let node = this.getItem(key) as CollectionNode<T> | null;
    while (node?.lastChildKey != null && (node.type !== "item" || this.expandedKeys.has(node.key))) {
      node = this.getItem(node.lastChildKey) as CollectionNode<T> | null;
    }
    return node?.key ?? null;
  }

  override getKeyAfter(key: Key): Key | null {
    let node = this.getItem(key) as CollectionNode<T> | null;
    if (!node) return null;

    if ((this.expandedKeys.has(node.key) || node.type !== "item") && node.firstChildKey != null) {
      return node.firstChildKey;
    }

    while (node) {
      if (node.nextKey != null) return node.nextKey;
      if (node.parentKey != null) node = this.getItem(node.parentKey) as CollectionNode<T> | null;
      else return null;
    }
    return null;
  }

  override getKeyBefore(key: Key): Key | null {
    let node = this.getItem(key) as CollectionNode<T> | null;
    if (!node) return null;

    if (node.prevKey != null) {
      node = this.getItem(node.prevKey) as CollectionNode<T> | null;
      // If the previous sibling is expanded, descend to its last visible descendant.
      while (node && (node.type !== "item" || this.expandedKeys.has(node.key)) && node.lastChildKey != null) {
        node = this.getItem(node.lastChildKey) as CollectionNode<T> | null;
      }
      return node?.key ?? null;
    }
    return node.parentKey;
  }

  override getChildren(key: Key): Iterable<Node<T>> {
    const self = this;
    return {
      *[Symbol.iterator]() {
        const parent = self.getItem(key) as CollectionNode<T> | null;
        let node = parent?.firstChildKey != null ? (self.getItem(parent.firstChildKey) as CollectionNode<T> | null) : null;
        if (parent && parent.type === "section" && node) {
          // Stop once the node is null or the node is the parent's sibling.
          while (node && node.key !== parent.nextKey) {
            yield self.getItem(node.key)!;
            // This includes content nodes, which renderers skip.
            const next = self.getKeyAfter(node.key);
            node = next != null ? (self.getItem(next) as CollectionNode<T> | null) : null;
          }
        } else {
          while (node) {
            yield node;
            node = node.nextKey != null ? (self.getItem(node.nextKey) as CollectionNode<T> | null) : null;
          }
        }
      },
    };
  }

  getTextValue(key: Key): string {
    const item = this.getItem(key);
    return item ? item.textValue : "";
  }
}

export function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}
