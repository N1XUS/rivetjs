// Ported from @react-stately/data (useTreeData.ts), Apache-2.0, © Adobe.
//
// Rivet:
// - `useTreeData` → `createTreeData` (wave-2 decision 7). Returns a plain object of signals + arrow
//   functions (resumable, `.tsx` so the arrows are R2 symbols); `items` is an accessor of the root
//   nodes (`tree.items()`), `selectedKeys` a two-way `Signal<Set<Key>>`.
// - State = one signal of `{ items, nodeMap }` (plain objects + a Map: serializable) + the selection
//   signal; region state (`_regionState`).
// - react-stately's methods read the tree of the current render (`nodeMap`, `items`, `selectedKeys`
//   closures); here they read the signals when called, which is the same between renders.
import { batch, signal, untrack, _regionState, type Signal } from "@rivetjs/reactivity";
import type { Key } from "../collections/types.ts";

export interface TreeOptions<T extends object> {
  /** Initial root items in the tree. */
  initialItems?: T[] | undefined;
  /** The keys for the initially selected items. */
  initialSelectedKeys?: Iterable<Key> | undefined;
  /** A function that returns a unique key for an item object. Default `item.id ?? item.key`. */
  getKey?: ((item: T) => Key) | undefined;
  /** A function that returns the children for an item object. Default `item.children`. */
  getChildren?: ((item: T) => T[]) | undefined;
}

export interface TreeNode<T extends object> {
  /** A unique key for the tree node. */
  key: Key;
  /** The key of the parent node. */
  parentKey?: Key | null;
  /** The value object for the tree node. */
  value: T;
  /** Children of the tree node. */
  children: TreeNode<T>[] | null;
}

export interface TreeData<T extends object> {
  /** The root nodes in the tree. Reads state. */
  readonly items: () => TreeNode<T>[];
  /** The keys of the currently selected items in the tree (two-way signal). */
  readonly selectedKeys: Signal<Set<Key>>;
  /** Sets the selected keys. */
  setSelectedKeys(keys: Set<Key>): void;
  /** Gets a node from the tree by key. */
  getItem(key: Key): TreeNode<T> | undefined;
  /** Inserts an item into a parent node as a child (`parentKey` null: the root). */
  insert(parentKey: Key | null, index: number, ...values: T[]): void;
  /** Inserts items before the item at the given key. */
  insertBefore(key: Key, ...values: T[]): void;
  /** Inserts items after the item at the given key. */
  insertAfter(key: Key, ...values: T[]): void;
  /** Appends an item into a parent node as a child. */
  append(parentKey: Key | null, ...values: T[]): void;
  /** Prepends an item into a parent node as a child. */
  prepend(parentKey: Key | null, ...value: T[]): void;
  /** Removes items from the tree by their keys. */
  remove(...keys: Key[]): void;
  /** Removes all items from the tree that are currently in the set of selected items. */
  removeSelectedItems(): void;
  /** Moves an item within the tree. */
  move(key: Key, toParentKey: Key | null, index: number): void;
  /** Moves one or more items before a given key. */
  moveBefore(key: Key, keys: Iterable<Key>): void;
  /** Moves one or more items after a given key. */
  moveAfter(key: Key, keys: Iterable<Key>): void;
  /** Updates an item in the tree. */
  update(key: Key, newValue: T): void;
}

interface TreeDataState<T extends object> {
  items: TreeNode<T>[];
  nodeMap: Map<Key, TreeNode<T>>;
}

type UpdateTree<T extends object> = (
  items: TreeNode<T>[],
  key: Key | null,
  update: (node: TreeNode<T>) => TreeNode<T> | null,
  originalMap: Map<Key, TreeNode<T>>,
) => TreeDataState<T>;

function buildTree<T extends object>(
  getKey: (item: T) => Key,
  getChildren: (item: T) => T[],
  initialItems: T[] | null = [],
  map: Map<Key, TreeNode<T>>,
  parentKey?: Key | null,
): TreeDataState<T> {
  if (initialItems == null) initialItems = [];
  return {
    items: initialItems.map((item) => {
      const node: TreeNode<T> = { key: getKey(item), parentKey: parentKey ?? null, value: item, children: null };
      node.children = buildTree(getKey, getChildren, getChildren(item), map, node.key).items;
      map.set(node.key, node);
      return node;
    }),
    nodeMap: map,
  };
}

function addNode<T extends object>(node: TreeNode<T>, map: Map<Key, TreeNode<T>>): void {
  map.set(node.key, node);
  if (node.children) for (const child of node.children) addNode(child, map);
}

function deleteNode<T extends object>(node: TreeNode<T>, map: Map<Key, TreeNode<T>>): void {
  map.delete(node.key);
  if (node.children) for (const child of node.children) deleteNode(child, map);
}

function updateTree<T extends object>(
  items: TreeNode<T>[],
  key: Key | null,
  update: (node: TreeNode<T>) => TreeNode<T> | null,
  originalMap: Map<Key, TreeNode<T>>,
): TreeDataState<T> {
  let node = key == null ? null : originalMap.get(key);
  if (node == null) return { items, nodeMap: originalMap };
  const map = new Map<Key, TreeNode<T>>(originalMap);
  // Create a new node. If null, then delete the node, otherwise replace.
  let newNode = update(node);
  if (newNode == null) deleteNode(node, map);
  else addNode(newNode, map);
  // Walk up the tree and update each parent to refer to the new children.
  while (node && node.parentKey) {
    const nextParent: TreeNode<T> = map.get(node.parentKey)!;
    const copy: TreeNode<T> = { key: nextParent.key, parentKey: nextParent.parentKey, value: nextParent.value, children: null };
    let children = nextParent.children;
    if (newNode == null && children) children = children.filter((c) => c !== node);
    const current = node;
    const replacement = newNode;
    copy.children = children?.map((child) => (child === current ? replacement! : child)) ?? null;
    map.set(copy.key, copy);
    newNode = copy;
    node = nextParent;
  }
  if (newNode == null) items = items.filter((c) => c !== node);
  const top = node;
  const replacement = newNode;
  return { items: items.map((item) => (item === top ? replacement! : item)), nodeMap: map };
}

function moveItems<T extends object>(
  state: TreeDataState<T>,
  keys: Iterable<Key>,
  toParent: TreeNode<T> | null,
  toIndex: number,
  update: UpdateTree<T>,
  add: (node: TreeNode<T>, map: Map<Key, TreeNode<T>>) => void,
): TreeDataState<T> {
  const { items, nodeMap } = state;
  let parent = toParent;
  const removeKeys = new Set(keys);
  while (parent != null) {
    if (removeKeys.has(parent.key)) throw new Error("Cannot move an item to be a child of itself.");
    parent = parent.parentKey != null ? (nodeMap.get(parent.parentKey) ?? null) : null;
  }
  const originalToIndex = toIndex;
  const keyArray = Array.isArray(keys) ? keys : [...keys];
  // Depth first search to put keys in order.
  const inOrderKeys: Map<Key, number> = new Map();
  const removedItems: TreeNode<T>[] = [];
  let newItems = items;
  let newMap = nodeMap;
  let i = 0;

  type Walk = { inorder?: (node: any) => void; postorder?: (node: any) => void };
  function traversal(node: any, { inorder, postorder }: Walk): void {
    inorder?.(node);
    if (node != null) {
      for (const child of node.children ?? []) {
        traversal(child, { inorder, postorder });
        postorder?.(child);
      }
    }
  }
  function inorder(child: TreeNode<T>): void {
    // In-order so we add items as we encounter them in the tree, then insert them in expected order later.
    if (keyArray.includes(child.key)) inOrderKeys.set(child.key, i++);
  }
  function postorder(child: TreeNode<T>): void {
    // Remove items and update the tree from the leaves upwards toward the root, so we don't copy
    // child node references from parents inadvertently.
    if (keyArray.includes(child.key)) {
      removedItems.push({ ...newMap.get(child.key)!, parentKey: toParent?.key ?? null });
      const { items: nextItems, nodeMap: nextMap } = update(newItems, child.key, () => null, newMap);
      newItems = nextItems;
      newMap = nextMap;
    }
    // Decrement the index if the child being removed is in the target parent and before the target
    // index. The root is null and has no key, but a parentKey can still point to it.
    if (
      (child.parentKey === (toParent as unknown) || child.parentKey === toParent?.key) &&
      keyArray.includes(child.key) &&
      (toParent?.children ? toParent.children.indexOf(child) : items.indexOf(child)) < originalToIndex
    ) {
      toIndex--;
    }
  }
  traversal({ children: items }, { inorder, postorder });
  const inOrderItems = removedItems.sort((a, b) => (inOrderKeys.get(a.key)! > inOrderKeys.get(b.key)! ? 1 : -1));
  // If parentKey is null, insert into the root.
  if (!toParent || toParent.key == null) {
    inOrderItems.forEach((movedNode) => add(movedNode, newMap));
    return { items: [...newItems.slice(0, toIndex), ...inOrderItems, ...newItems.slice(toIndex)], nodeMap: newMap };
  }
  // Otherwise, update the parent node and its ancestors.
  return update(
    newItems,
    toParent.key,
    (parentNode) => ({
      key: parentNode.key,
      parentKey: parentNode.parentKey,
      value: parentNode.value,
      children: [...parentNode.children!.slice(0, toIndex), ...inOrderItems, ...parentNode.children!.slice(toIndex)],
    }),
    newMap,
  );
}

/** Default item key: `item.id ?? item.key` (react-stately). */
const treeKey = (item: any): Key => item.id ?? item.key;
/** Default children: `item.children` (react-stately). */
const treeChildren = (item: any): any[] => item.children;

/**
 * Manages state for an immutable tree data structure, and provides convenience methods to update
 * the data over time (react-stately `useTreeData`).
 */
export function createTreeData<T extends object>(options: TreeOptions<T> = {}): TreeData<T> {
  return _regionState(() => {
    const { initialItems = [], initialSelectedKeys } = options;
    // Resumable: a module-level default is not a serializable capture; the fallback is an object-literal arrow (a resume symbol).
    const userKey = options.getKey,
      userChildren = options.getChildren;
    const fns = {
      key: (item: T): Key => (userKey ? userKey(item) : treeKey(item)),
      children: (item: T) => (userChildren ? userChildren(item) : treeChildren(item)),
    };
    const getKey = fns.key;
    const getChildren = fns.children;
    // We only want to compute this once.
    const tree = signal<TreeDataState<T>>(buildTree(getKey, getChildren, initialItems, new Map()));
    const selectedKeys = signal(new Set<Key>(initialSelectedKeys || []));
    const setItems = (fn: (state: TreeDataState<T>) => TreeDataState<T>) => tree.set(fn(untrack(tree)));
    const current = () => untrack(tree);

    const insert = (parentKey: Key | null, index: number, ...values: T[]) =>
      setItems(({ items, nodeMap: originalMap }) => {
        const { items: newNodes, nodeMap: newMap } = buildTree(getKey, getChildren, values, new Map(originalMap), parentKey);
        // If parentKey is null, insert into the root.
        if (parentKey == null) return { items: [...items.slice(0, index), ...newNodes, ...items.slice(index)], nodeMap: newMap };
        // Otherwise, update the parent node and its ancestors.
        return updateTree(
          items,
          parentKey,
          (parentNode) => ({
            key: parentNode.key,
            parentKey: parentNode.parentKey,
            value: parentNode.value,
            children: [...parentNode.children!.slice(0, index), ...newNodes, ...parentNode.children!.slice(index)],
          }),
          newMap,
        );
      });

    const remove = (...keys: Key[]) => {
      if (keys.length === 0) return;
      const { items, nodeMap } = current();
      let newItems = items;
      let prevMap = nodeMap;
      let newTree!: TreeDataState<T>;
      for (const key of keys) {
        newTree = updateTree(newItems, key, () => null, prevMap);
        prevMap = newTree.nodeMap;
        newItems = newTree.items;
      }
      const previous = untrack(selectedKeys);
      batch(() => {
        tree.set(newTree);
        const selection = new Set(previous);
        for (const key of previous) if (!newTree.nodeMap.has(key)) selection.delete(key);
        selectedKeys.set(selection);
      });
    };

    const siblingIndex = (key: Key): { parentKey: Key | null; index: number } | null => {
      const { items, nodeMap } = current();
      const node = nodeMap.get(key);
      if (!node) return null;
      const parentNode = nodeMap.get(node.parentKey!);
      const nodes = parentNode ? parentNode.children : items;
      return { parentKey: parentNode?.key ?? null, index: nodes!.indexOf(node) };
    };

    const moveRelative = (key: Key, keys: Iterable<Key>, after: boolean) =>
      setItems((prevState) => {
        const { items, nodeMap } = prevState;
        const node = nodeMap.get(key);
        if (!node) return prevState;
        const toParentKey = node.parentKey ?? null;
        let parent: TreeNode<T> | null = null;
        if (toParentKey != null) parent = nodeMap.get(toParentKey) ?? null;
        let toIndex = parent?.children ? parent.children.indexOf(node) : items.indexOf(node);
        if (after) toIndex++;
        return moveItems(prevState, keys, parent, toIndex, updateTree, addNode);
      });

    return {
      items: () => tree().items,
      selectedKeys,
      setSelectedKeys: (keys: Set<Key>) => selectedKeys.set(keys),
      getItem: (key: Key) => tree().nodeMap.get(key),
      insert,
      insertBefore: (key: Key, ...values: T[]) => {
        const at = siblingIndex(key);
        if (at) insert(at.parentKey, at.index, ...values);
      },
      insertAfter: (key: Key, ...values: T[]) => {
        const at = siblingIndex(key);
        if (at) insert(at.parentKey, at.index + 1, ...values);
      },
      prepend: (parentKey: Key | null, ...values: T[]) => insert(parentKey, 0, ...values),
      append: (parentKey: Key | null, ...values: T[]) => {
        const { items, nodeMap } = current();
        if (parentKey == null) insert(null, items.length, ...values);
        else {
          const parentNode = nodeMap.get(parentKey);
          if (!parentNode) return;
          insert(parentKey, parentNode.children!.length, ...values);
        }
      },
      remove,
      removeSelectedItems: () => remove(...untrack(selectedKeys)),
      move: (key: Key, toParentKey: Key | null, index: number) =>
        setItems(({ items, nodeMap: originalMap }) => {
          let walk = toParentKey;
          while (walk != null) {
            if (walk === key) throw new Error("Cannot move an item to be a child of itself.");
            walk = originalMap.get(walk)?.parentKey ?? null;
          }
          const node = originalMap.get(key);
          if (!node) return { items, nodeMap: originalMap };
          const { items: newItems, nodeMap: newMap } = updateTree(items, key, () => null, originalMap);
          const movedNode = { ...node, parentKey: toParentKey };
          // If parentKey is null, insert into the root.
          if (toParentKey == null) {
            addNode(movedNode, newMap);
            return { items: [...newItems.slice(0, index), movedNode, ...newItems.slice(index)], nodeMap: newMap };
          }
          // Otherwise, update the parent node and its ancestors.
          return updateTree(
            newItems,
            toParentKey,
            (parentNode) => ({
              key: parentNode.key,
              parentKey: parentNode.parentKey,
              value: parentNode.value,
              children: [...parentNode.children!.slice(0, index), movedNode, ...parentNode.children!.slice(index)],
            }),
            newMap,
          );
        }),
      moveBefore: (key: Key, keys: Iterable<Key>) => moveRelative(key, keys, false),
      moveAfter: (key: Key, keys: Iterable<Key>) => moveRelative(key, keys, true),
      update: (oldKey: Key, newValue: T) =>
        setItems(({ items, nodeMap: originalMap }) =>
          updateTree(
            items,
            oldKey,
            (oldNode) => {
              const node: TreeNode<T> = { key: oldNode.key, parentKey: oldNode.parentKey, value: newValue, children: null };
              const built = buildTree(getKey, getChildren, getChildren(newValue), originalMap, node.key);
              node.children = built.items;
              return node;
            },
            originalMap,
          ),
        ),
    };
  });
}
