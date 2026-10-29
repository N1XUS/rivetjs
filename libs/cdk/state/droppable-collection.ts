// Ported from react-spectrum (packages/react-stately/src/dnd/useDroppableCollectionState.ts), Apache-2.0, © Adobe.
// Manages state for a droppable collection.
// Rivet:
// - `collection` / `selectionManager` may be accessors (a Rivet host rebuilds its collection view per read): the state
//   exposes them as getters, read at call time.
// - The drop target is a signal (`target` / `isDropTarget(…)` are reactive: drop indicators and `data-drop-target`
//   bind to them). Transient: never serialized.
// - `isEqualDropTarget` / `isDraggingWithinParent` are exported (react-aria uses its own copies).
import { signal, untrack } from "@rivetjs/reactivity";
import type { Collection, Key, Node } from "../collections/types.ts";
import type { MultipleSelectionManager } from "../selection/manager.ts";
import type { DragTypes, DropOperation, DroppableCollectionProps, DropTarget, ItemDropTarget } from "../dnd/types.ts";

type MaybeAccessor<T> = T | (() => T);
const read = <T>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

export interface DropOperationEvent {
  target: DropTarget;
  types: DragTypes;
  allowedOperations: DropOperation[];
  isInternal: boolean;
  draggingKeys: Set<Key>;
}

export interface DroppableCollectionStateOptions extends Omit<DroppableCollectionProps, "onDropMove" | "onDropActivate"> {
  /** A collection of items (or an accessor of one). */
  collection: MaybeAccessor<Collection<Node<unknown>>>;
  /** An interface for reading and updating multiple selection state (or an accessor of one). */
  selectionManager: MaybeAccessor<MultipleSelectionManager>;
  /** Whether the drop events should be disabled. */
  isDisabled?: boolean | undefined;
}

export interface DroppableCollectionState {
  /** A collection of items. */
  readonly collection: Collection<Node<unknown>>;
  /** An interface for reading and updating multiple selection state. */
  readonly selectionManager: MultipleSelectionManager;
  /** The current drop target (reactive). */
  readonly target: DropTarget | null;
  /** Whether drop events are disabled. */
  isDisabled?: boolean | undefined;
  /** Sets the current drop target. */
  setTarget(target: DropTarget | null): void;
  /** Returns whether the given target is equivalent to the current drop target (reactive). */
  isDropTarget(target: DropTarget | null): boolean;
  /** Returns the drop operation for the given parameters. */
  getDropOperation(e: DropOperationEvent): DropOperation;
}

/** Manages state for a droppable collection (react-stately `useDroppableCollectionState`). */
export function useDroppableCollectionState(props: DroppableCollectionStateOptions): DroppableCollectionState {
  const {
    acceptedDragTypes = "all",
    isDisabled,
    onInsert,
    onRootDrop,
    onItemDrop,
    onReorder,
    onMove,
    shouldAcceptItemDrop,
    onDropEnter,
    getDropOperation,
    onDrop,
  } = props;
  const collectionOf = () => read(props.collection);
  const managerOf = () => read(props.selectionManager);
  const target = signal<DropTarget | null>(null);

  const getOppositeTarget = (target: ItemDropTarget): ItemDropTarget | null => {
    const collection = collectionOf();
    if (target.dropPosition === "before") {
      const node = collection.getItem(target.key);
      return node && node.prevKey != null ? { type: "item", key: node.prevKey, dropPosition: "after" } : null;
    } else if (target.dropPosition === "after") {
      const node = collection.getItem(target.key);
      return node && node.nextKey != null ? { type: "item", key: node.nextKey, dropPosition: "before" } : null;
    }
    return null;
  };

  const defaultGetDropOperation = (e: DropOperationEvent): DropOperation => {
    const { target, types, allowedOperations, isInternal, draggingKeys } = e;
    if (isDisabled || !target) return "cancel";
    if (acceptedDragTypes === "all" || acceptedDragTypes.some((type) => types.has(type))) {
      const isValidInsert = onInsert && target.type === "item" && !isInternal && (target.dropPosition === "before" || target.dropPosition === "after");
      const isValidReorder =
        onReorder &&
        target.type === "item" &&
        isInternal &&
        (target.dropPosition === "before" || target.dropPosition === "after") &&
        isDraggingWithinParent(collectionOf(), target, draggingKeys);
      const isItemDropAllowed = target.type !== "item" || target.dropPosition !== "on" || !shouldAcceptItemDrop || shouldAcceptItemDrop(target, types);
      const isValidMove = onMove && target.type === "item" && isInternal && isItemDropAllowed;
      // Feedback was that internal root drop was weird so preventing that from happening
      const isValidRootDrop = onRootDrop && target.type === "root" && !isInternal;
      // Automatically prevent items (i.e. folders) from being dropped on themselves.
      const isValidOnItemDrop =
        onItemDrop &&
        target.type === "item" &&
        target.dropPosition === "on" &&
        !(isInternal && target.key != null && draggingKeys.has(target.key)) &&
        isItemDropAllowed;
      if (onDrop || isValidInsert || isValidReorder || isValidMove || isValidRootDrop || isValidOnItemDrop) {
        if (getDropOperation) return getDropOperation(target, types, allowedOperations);
        return allowedOperations[0]!;
      }
    }
    return "cancel";
  };

  const isDropTarget = (dropTarget: DropTarget | null, current: DropTarget | null): boolean => {
    if (!current || !dropTarget) return false;
    if (isEqualDropTarget(dropTarget, current)) return true;
    // Check if the targets point at the same point between two items, one referring before, and the other after.
    if (
      dropTarget?.type === "item" &&
      current?.type === "item" &&
      dropTarget.key !== current.key &&
      dropTarget.dropPosition !== current.dropPosition &&
      dropTarget.dropPosition !== "on" &&
      current.dropPosition !== "on"
    ) {
      return isEqualDropTarget(getOppositeTarget(dropTarget), current) || isEqualDropTarget(dropTarget, getOppositeTarget(current));
    }
    return false;
  };

  return {
    get collection() {
      return collectionOf();
    },
    get selectionManager() {
      return managerOf();
    },
    isDisabled,
    get target() {
      return target();
    },
    setTarget(newTarget) {
      untrack(() => {
        const current = target();
        if (isDropTarget(newTarget, current)) return;
        if (current && typeof props.onDropExit === "function") props.onDropExit({ type: "dropexit", x: 0, y: 0, target: current });
        if (newTarget && typeof onDropEnter === "function") onDropEnter({ type: "dropenter", x: 0, y: 0, target: newTarget });
        target.set(newTarget ?? null);
      });
    },
    isDropTarget(dropTarget) {
      return isDropTarget(dropTarget, target());
    },
    getDropOperation(e) {
      const { target, isInternal, draggingKeys } = e;
      // Prevent dropping items onto themselves or their descendants
      if (isInternal && target.type === "item" && draggingKeys.size > 0) {
        if (draggingKeys.has(target.key) && target.dropPosition === "on") return "cancel";
        const collection = collectionOf();
        let currentKey: Key | null = target.key;
        while (currentKey != null) {
          const item = collection.getItem(currentKey);
          const parentKey = item?.parentKey;
          if (parentKey != null && draggingKeys.has(parentKey)) return "cancel";
          currentKey = parentKey ?? null;
        }
      }
      return defaultGetDropOperation(e);
    },
  };
}

export function isEqualDropTarget(a?: DropTarget | null, b?: DropTarget | null): boolean {
  if (!a) return !b;
  switch (a.type) {
    case "root":
      return b?.type === "root";
    case "item":
      return b?.type === "item" && b?.key === a.key && b?.dropPosition === a.dropPosition;
  }
}

export function isDraggingWithinParent(collection: Collection<Node<unknown>>, target: ItemDropTarget, draggingKeys: Set<Key>): boolean {
  const targetNode = collection.getItem(target.key);
  for (const key of draggingKeys) {
    const node = collection.getItem(key);
    if (node?.parentKey !== targetNode?.parentKey) return false;
  }
  return true;
}
