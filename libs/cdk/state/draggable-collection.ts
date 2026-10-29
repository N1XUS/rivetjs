// Ported from react-spectrum (packages/react-stately/src/dnd/useDraggableCollectionState.ts), Apache-2.0, © Adobe.
// Manages state for a draggable collection.
// Rivet:
// - `collection` / `selectionManager` may be accessors (a Rivet host rebuilds its collection view per read): the state
//   exposes them as getters, read at call time.
// - The dragging keys are a signal (`isDragging(key)` / `draggingKeys` are reactive; react-stately re-renders through
//   a `useState` toggle). Transient: never serialized.
import { signal } from "@rivetjs/reactivity";
import type { Collection, Key, Node } from "../collections/types.ts";
import type { MultipleSelectionManager } from "../selection/manager.ts";
import type {
  DraggableCollectionEndEvent,
  DraggableCollectionProps,
  DragItem,
  DragMoveEvent,
  DragPreviewRenderer,
  DragStartEvent,
  DropOperation,
} from "../dnd/types.ts";

type MaybeAccessor<T> = T | (() => T);
const read = <T>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

export interface DraggableCollectionStateOptions<T = object> extends DraggableCollectionProps<T> {
  /** A collection of items (or an accessor of one). */
  collection: MaybeAccessor<Collection<Node<unknown>>>;
  /** An interface for reading and updating multiple selection state (or an accessor of one). */
  selectionManager: MaybeAccessor<MultipleSelectionManager>;
  /** Whether the drag events should be disabled. */
  isDisabled?: boolean | undefined;
}

export interface DraggableCollectionState {
  /** A collection of items. */
  readonly collection: Collection<Node<unknown>>;
  /** An interface for reading and updating multiple selection state. */
  readonly selectionManager: MultipleSelectionManager;
  /** The key of the item that initiated a drag. */
  readonly draggedKey: Key | null;
  /** The keys of the items that are currently being dragged. */
  readonly draggingKeys: Set<Key>;
  /** Whether drag events are disabled. */
  isDisabled?: boolean | undefined;
  /** Returns whether the given key is currently being dragged. */
  isDragging(key: Key): boolean;
  /** Returns the keys of the items that will be dragged with the given key (e.g. selected items). */
  getKeysForDrag(key: Key): Set<Key>;
  /** Returns the items to drag for the given key. */
  getItems(key: Key): DragItem[];
  /** The ref of the element that will be rendered as the drag preview while dragging. */
  preview?: { readonly current: DragPreviewRenderer | null } | undefined;
  /** Function that returns the drop operations that are allowed for the dragged items. If not provided, all drop operations are allowed. */
  getAllowedDropOperations?: (() => DropOperation[]) | undefined;
  /** Begins a drag for the given key. This triggers the onDragStart event. */
  startDrag(key: Key, event: DragStartEvent): void;
  /** Triggers an onDragMove event. */
  moveDrag(event: DragMoveEvent): void;
  /** Ends the current drag, and emits an onDragEnd event. */
  endDrag(event: DraggableCollectionEndEvent): void;
}

/** Manages state for a draggable collection (react-stately `useDraggableCollectionState`). */
export function useDraggableCollectionState<T = object>(props: DraggableCollectionStateOptions<T>): DraggableCollectionState {
  const { getItems, isDisabled, onDragStart, onDragMove, onDragEnd, preview, getAllowedDropOperations } = props;
  const collectionOf = () => read(props.collection);
  const managerOf = () => read(props.selectionManager);
  const draggingKeys = signal(new Set<Key>());
  let draggedKey: Key | null = null;
  const getKeys = (key: Key) => {
    // The clicked item is always added to the drag. If it is selected, then all of the other selected items are also
    // dragged. If it is not selected, then only the clicked item is dragged. This matches native macOS behavior.
    // Additionally, we filter out any keys that are children of any of the other selected keys
    const collection = collectionOf();
    const selectionManager = managerOf();
    const keys = new Set<Key>();
    if (selectionManager.isSelected(key)) {
      for (const currentKey of selectionManager.selectedKeys) {
        const node = collection.getItem(currentKey);
        if (node) {
          let isChild = false;
          let parentKey = node.parentKey;
          while (parentKey != null) {
            if (selectionManager.selectedKeys.has(parentKey)) {
              isChild = true;
              break;
            }
            const parentNode = collection.getItem(parentKey);
            parentKey = parentNode ? parentNode.parentKey : null;
          }
          if (!isChild) keys.add(currentKey);
        }
      }
    } else keys.add(key);
    return keys;
  };

  return {
    get collection() {
      return collectionOf();
    },
    get selectionManager() {
      return managerOf();
    },
    get draggedKey() {
      return draggedKey;
    },
    get draggingKeys() {
      return draggingKeys();
    },
    isDragging(key) {
      return draggingKeys().has(key);
    },
    getKeysForDrag: getKeys,
    getItems(key) {
      const keys = getKeys(key);
      const collection = collectionOf();
      const items: any[] = [];
      for (const key of keys) {
        const value = collection.getItem(key)?.value;
        if (value != null) items.push(value);
      }
      return getItems(getKeys(key), items);
    },
    isDisabled,
    preview,
    getAllowedDropOperations,
    startDrag(key, event) {
      const keys = getKeys(key);
      draggingKeys.set(keys);
      draggedKey = key;
      managerOf().setFocused(false);
      if (typeof onDragStart === "function") onDragStart({ ...event, keys });
    },
    moveDrag(event) {
      if (typeof onDragMove === "function") onDragMove({ ...event, keys: draggingKeys() });
    },
    endDrag(event) {
      const { isInternal } = event;
      if (typeof onDragEnd === "function") onDragEnd({ ...event, keys: draggingKeys(), isInternal });
      draggingKeys.set(new Set());
      draggedKey = null;
    },
  };
}
