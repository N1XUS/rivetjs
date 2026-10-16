// Ported from @react-stately/collections (getChildNodes.ts, getItemCount.ts), Apache-2.0, © Adobe.
// Node traversal helpers shared by collections, selection managers and keyboard delegates.
import type { Collection, Node } from "./types.ts";

export function getChildNodes<T>(node: Node<T>, collection: Collection<Node<T>>): Iterable<Node<T>> {
  // New API: call collection.getChildren with the node key.
  if (typeof collection.getChildren === "function") return collection.getChildren(node.key);
  // Old API: access childNodes directly.
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
  let lastItem: T | undefined = undefined;
  for (const value of iterable) lastItem = value;
  return lastItem;
}

/** Document order of two nodes (negative: `a` first). */
export function compareNodeOrder<T>(collection: Collection<Node<T>>, a: Node<T>, b: Node<T>): number {
  // If the two nodes have the same parent, compare their indices.
  if (a.parentKey === b.parentKey) return a.index - b.index;

  // Otherwise, collect all of the ancestors from each node, and find the first one that doesn't match
  // starting from the root. Include the base nodes in case we are comparing nodes of different levels.
  // Rivet: same algorithm without the spread / slice copies and the `findIndex` closures (sort comparator).
  const aAncestors = getAncestors(collection, a);
  aAncestors.push(a);
  const bAncestors = getAncestors(collection, b);
  bAncestors.push(b);
  const shared = Math.min(aAncestors.length, bAncestors.length);
  for (let i = 0; i < shared; i++)
    if (aAncestors[i] !== bAncestors[i]) {
      // Compare the indices of two children within the common ancestor.
      return aAncestors[i]!.index - bAncestors[i]!.index;
    }

  // One of the nodes is the ancestor of the other.
  if (aAncestors.includes(b)) return 1;
  else if (bAncestors.includes(a)) return -1;
  return -1;
}

function getAncestors<T>(collection: Collection<Node<T>>, node: Node<T>): Node<T>[] {
  const parents: Node<T>[] = [];
  let currNode: Node<T> | null = node;
  while (currNode?.parentKey != null) {
    currNode = collection.getItem(currNode.parentKey);
    if (currNode) parents.push(currNode);
  }
  return parents.reverse(); // Rivet: push + reverse (upstream `unshift` per level)
}

const countCache = new WeakMap<object, number>();

/** Number of `item` nodes, descending into sections (cached per collection). */
export function getItemCount<T>(collection: Collection<Node<T>>): number {
  const cached = countCache.get(collection);
  if (cached != null) return cached;
  let counter = 0;
  const countItems = (items: Iterable<Node<T>>) => {
    for (const item of items) {
      if (item.type === "section") countItems(getChildNodes(item, collection));
      else if (item.type === "item") counter++;
    }
  };
  countItems(collection);
  countCache.set(collection, counter);
  return counter;
}
