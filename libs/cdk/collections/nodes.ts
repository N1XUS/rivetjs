// Ported from @react-stately/collections (getChildNodes.ts, getItemCount.ts), Apache-2.0, © Adobe.
// Node traversal helpers shared by collections, selection managers and keyboard delegates.
import type { Collection, Key, Node } from "./types.ts";

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

const positionCache = new WeakMap<object, Map<Key, readonly [number, number]>>();

/**
 * Rivet: `[aria-posinset, aria-setsize]` of the item `key` in a virtualized collection (only a window of its items is
 * in the DOM, so the browser cannot count them): its 1-based position among the items of its section and that
 * section's item count; top-level items count among the top-level items. Headers, separators and loaders are not
 * counted. RA useOption / useMenuItem use `node.index + 1` (a section's header counted) of `getItemCount` (every item
 * of every section): equal without sections, per section (role `group`) with them. Cached per committed collection.
 */
export function itemPosition<T>(collection: Collection<Node<T>>, key: Key): readonly [number, number] | undefined {
  let cache = positionCache.get(collection);
  if (!cache) positionCache.set(collection, (cache = new Map()));
  const hit = cache.get(key);
  if (hit) return hit;
  const node = collection.getItem(key);
  if (!node || node.type !== "item") return undefined;
  const parent = node.parentKey != null ? collection.getItem(node.parentKey) : null;
  const keys: Key[] = [];
  for (const sibling of parent ? getChildNodes(parent, collection) : collection) if (sibling.type === "item") keys.push(sibling.key);
  keys.forEach((k, i) => cache.set(k, [i + 1, keys.length]));
  return cache.get(key);
}
