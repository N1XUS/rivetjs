// Rivet addition: drag and drop for `FileTree` over a cdk `createTreeData` manager (API shape inspired by HeroUI Pro's
// public File Tree docs, `useFileTreeDrag`; independent implementation on `@rivetjs/cdk/dnd` `useDragAndDrop`).
// - Rows reorder within a level ("before" / "after") and move into folders ("on"); a folder = a node whose `children`
//   is an array (`isFolder`). A row never moves into itself / its own subtree.
// - Drop indicators render as `.file-tree__drop-indicator` (a line at the target's indent while it is the target).
// - `onMove(keys, target)` runs after the tree data moved (persist the change there).
import type { Key } from "@rivetjs/cdk/collections";
import type { TreeData, TreeNode } from "@rivetjs/cdk/data";
import { DropIndicator, useDragAndDrop } from "@rivetjs/cdk/dnd";
import type { DragAndDropHooks, DragAndDropOptions, DragItem, DropTarget, ItemDropTarget } from "@rivetjs/cdk/dnd";

import { fileTreeVariants } from "../../../styles/src/components/file-tree/index.ts";

interface UseFileTreeDragOptions<T extends object> extends Omit<DragAndDropOptions<TreeNode<T>>, "getItems" | "onMove" | "onReorder"> {
  /** The tree data manager the `FileTree` renders (`createTreeData`). */
  tree: TreeData<T>;
  /** Drag data for the dragged keys. @default each key as `text/plain` */
  getItems?: ((keys: Set<Key>, items: TreeNode<T>[]) => DragItem[]) | undefined;
  /** Called after the tree data moved `keys` to `target`. */
  onMove?: ((keys: Set<Key>, target: ItemDropTarget) => void) | undefined;
  /** Whether a row accepts drops onto it (move into). @default the node has a `children` array */
  isFolder?: ((node: TreeNode<T>) => boolean) | undefined;
}

interface UseFileTreeDragResult<T extends object> {
  /** Pass to `<FileTree dragAndDropHooks>`. */
  dragAndDropHooks: DragAndDropHooks<TreeNode<T>>;
}

function useFileTreeDrag<T extends object>(options: UseFileTreeDragOptions<T>): UseFileTreeDragResult<T> {
  const { tree, getItems, onMove, isFolder, ...rest } = options;
  const folder = (key: Key) => {
    const node = tree.getItem(key);
    return !!node && (isFolder ? isFolder(node) : Array.isArray(node.children));
  };
  // `key` is `target` or one of its ancestors.
  const contains = (key: Key, target: Key) => {
    for (let k: Key | null | undefined = target; k != null; k = tree.getItem(k)?.parentKey) if (String(k) === String(key)) return true;
    return false;
  };
  const indicatorClass = fileTreeVariants().dropIndicator();
  return useDragAndDrop<TreeNode<T>>({
    renderDropIndicator: (target: DropTarget) => <DropIndicator target={target} class={indicatorClass} />,
    shouldAcceptItemDrop: (target) => folder(target.key),
    ...rest,
    getItems: getItems ?? ((keys) => [...keys].map((key) => ({ "text/plain": String(key) }))),
    onMove(e) {
      const target = e.target;
      const keys = [...e.keys].filter((key) => !contains(key, target.key));
      if (!keys.length) return;
      if (target.dropPosition === "before") tree.moveBefore(target.key, keys);
      else if (target.dropPosition === "after") tree.moveAfter(target.key, keys);
      else {
        const index = tree.getItem(target.key)?.children?.length ?? 0;
        keys.forEach((key, i) => tree.move(key, target.key, index + i));
      }
      onMove?.(new Set(keys), target);
    },
  });
}

export { useFileTreeDrag };
export type { UseFileTreeDragOptions, UseFileTreeDragResult };
