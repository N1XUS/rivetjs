// Ported from react-aria-components (src/useDragAndDrop.tsx, src/DragAndDrop.tsx: useDragAndDrop, DropIndicator,
// DropIndicatorContext, DragAndDropContext, useRenderDropIndicator, useDndPersistedKeys) and the react-aria /
// react-stately dnd hooks it hands out, Apache-2.0, © Adobe.
//
// `@rivetjs/cdk/dnd`: drag and drop for collections. `useDragAndDrop(options)` returns `dragAndDropHooks` for a
// collection component (`Tree` today; RAC: ListBox / GridList / Table too).
// Rivet:
// - Hooks are factories called once in a component body; their results are accessors / DOM event handlers (see each
//   module's header). `useDroppableCollection` / `useDroppableItem` / `useDropIndicator` take an optional message
//   formatter (default: the nearest locale's).
// - `renderDragPreview` renders imperatively at `dragstart` (`./drag-preview.tsx`); `renderDropIndicator` returns a
//   DOM value (`<DropIndicator target={target} />`).
// - Drop indicators render only while a keyboard / screen reader drag session runs or while they are the pointer drop
//   target (RAC): the server and the first browser render have none.
// - Everything here is browser state (drag sessions, drop targets): nothing is serialized; a resumed collection
//   registers as a keyboard drop target when it first runs in the browser (its first interaction).
import { computed, createContext, untrack, useContext } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import { renderNodeAt } from "../collections/components.tsx";
import type { Collection as ICollection, Key, Node } from "../collections/types.ts";
import type { MultipleSelectionManager } from "../selection/manager.ts";
import { renderProps, type RenderProps } from "../slots/index.tsx";
import { useDraggableCollectionState, type DraggableCollectionState, type DraggableCollectionStateOptions } from "../state/draggable-collection.ts";
import { useDroppableCollectionState, type DroppableCollectionState, type DroppableCollectionStateOptions } from "../state/droppable-collection.ts";
import { DragPreview, createDragPreviewRenderer, type DragPreviewProps } from "./drag-preview.tsx";
import { isVirtualDragging } from "./drag-manager.ts";
import { ListDropTargetDelegate } from "./list-drop-target-delegate.ts";
import type { DraggableCollectionProps, DragItem, DroppableCollectionProps, DropTarget, DropTargetDelegate, ElementRef, ItemDropTarget } from "./types.ts";
import { useDraggableCollection, type DraggableCollectionOptions } from "./use-draggable-collection.tsx";
import { useDraggableItem, type DraggableItemProps, type DraggableItemResult } from "./use-draggable-item.ts";
import { useDropIndicator, type DropIndicatorAria, type DropIndicatorProps as AriaDropIndicatorProps } from "./use-drop-indicator.ts";
import { useDroppableCollection, type DroppableCollectionOptions, type DroppableCollectionResult } from "./use-droppable-collection.tsx";
import { useDroppableItem, type DroppableItemOptions, type DroppableItemResult } from "./use-droppable-item.tsx";

export * from "./types.ts";
export { DROP_OPERATION, DROP_EFFECT_TO_DROP_OPERATION, DROP_OPERATION_TO_DROP_EFFECT, EFFECT_ALLOWED } from "./constants.ts";
export { DIRECTORY_DRAG_TYPE, isDirectoryDropItem, isFileDropItem, isTextDropItem } from "./utils.ts";
export { useDrag, type DragOptions, type DragResult } from "./use-drag.ts";
export { useDrop, type DropOptions, type DropResult } from "./use-drop.tsx";
export { useDraggableCollection, type DraggableCollectionOptions } from "./use-draggable-collection.tsx";
export { useDraggableItem, type DraggableItemProps, type DraggableItemResult } from "./use-draggable-item.ts";
export { useDroppableCollection, type DroppableCollectionOptions, type DroppableCollectionResult } from "./use-droppable-collection.tsx";
export { useDroppableItem, type DroppableItemOptions, type DroppableItemResult } from "./use-droppable-item.tsx";
export { useDropIndicator, type DropIndicatorAria } from "./use-drop-indicator.ts";
export { ListDropTargetDelegate, type ListDropTargetDelegateOptions } from "./list-drop-target-delegate.ts";
export { DragPreview, createDragPreviewRenderer, type DragPreviewProps } from "./drag-preview.tsx";
export { isVirtualDragging } from "./drag-manager.ts";
export { useDraggableCollectionState, type DraggableCollectionState, type DraggableCollectionStateOptions };
export { useDroppableCollectionState, type DroppableCollectionState, type DroppableCollectionStateOptions };

// ---------------------------------------------------------------------------------------------
// DragAndDrop.tsx
// ---------------------------------------------------------------------------------------------

export interface DragAndDropContextValue {
  dragAndDropHooks?: DragAndDropHooks | undefined;
  dragState?: DraggableCollectionState | undefined;
  dropState?: DroppableCollectionState | undefined;
}

/** RAC `DragAndDropContext`: the hooks and states of the enclosing collection. */
export const DragAndDropContext = createContext<DragAndDropContextValue>({});

export interface DropIndicatorRenderProps {
  /** Whether the drop indicator is currently the active drop target. @selector [data-drop-target] */
  isDropTarget: () => boolean;
}

export interface DropIndicatorProps extends Omit<AriaDropIndicatorProps, "activateButtonRef">, RenderProps<DropIndicatorRenderProps> {
  /** Rivet: receives the indicator element. */
  ref?: ((el: HTMLElement) => void) | undefined;
}

interface DropIndicatorContextValue {
  render: (props: DropIndicatorProps) => unknown;
}

/** RAC `DropIndicatorContext`: how the enclosing collection renders a `DropIndicator`. */
export const DropIndicatorContext = createContext<DropIndicatorContextValue | null>(null);

/** A DropIndicator is rendered between items in a collection to indicate where dropped data will be inserted. */
export function DropIndicator(props: DropIndicatorProps): unknown {
  const { render } = useContext(DropIndicatorContext)!;
  return render(props);
}

/** RAC `useRenderDropIndicator`: the collection renderer's `renderDropIndicator` (a DOM value per target). */
export function useRenderDropIndicator(
  dragAndDropHooks?: DragAndDropHooks,
  dropState?: DroppableCollectionState,
): ((target: ItemDropTarget) => unknown) | undefined {
  if (!dragAndDropHooks?.useDropIndicator) return undefined;
  const renderDropIndicator = dragAndDropHooks.renderDropIndicator;
  const isVirtual = dragAndDropHooks.isVirtualDragging ?? isVirtualDragging;
  return (target) => (
    // Only show drop indicators when virtual dragging or this is the current drop target.
    <Show when={() => isVirtual() || !!dropState?.isDropTarget(target)}>
      {() => (renderDropIndicator ? renderDropIndicator(target) : <DropIndicator target={target} />) as never}
    </Show>
  );
}

/** RAC `useDndPersistedKeys`: the focused key and the drop target key (virtualizers keep them rendered). */
export function useDndPersistedKeys(
  selectionManager: () => MultipleSelectionManager,
  dragAndDropHooks?: DragAndDropHooks,
  dropState?: DroppableCollectionState,
): () => Set<Key> {
  return () => {
    // Persist the focused key and the drop target key.
    const focusedKey = selectionManager().focusedKey;
    let dropTargetKey: Key | null | undefined = null;
    const target = dropState?.target;
    if (dragAndDropHooks?.isVirtualDragging?.() && dropState && target?.type === "item") {
      dropTargetKey = target.key;
      if (target.dropPosition === "after") {
        const collection = dropState.collection;
        // Normalize to the "before" drop position since we only render those to the DOM.
        let nextKey = collection.getKeyAfter(dropTargetKey);
        let lastDescendantKey: Key | null = null;
        if (nextKey != null) {
          const targetLevel = collection.getItem(dropTargetKey)?.level ?? 0;
          // Skip over any rows that are descendants of the target ("after" position should be after all children)
          while (nextKey != null) {
            const node = collection.getItem(nextKey);
            if (!node) break;
            // Skip over non-item nodes (e.g., loaders) since they can't be drop targets.
            if (node.type !== "item") {
              nextKey = collection.getKeyAfter(nextKey);
              continue;
            }
            // Stop once we find an item at the same level or higher
            if ((node.level ?? 0) <= targetLevel) break;
            lastDescendantKey = nextKey;
            nextKey = collection.getKeyAfter(nextKey);
          }
        }
        // If nextKey is null (end of collection), use the last descendant
        dropTargetKey = nextKey ?? lastDescendantKey ?? dropTargetKey;
      }
    }
    return new Set([focusedKey, dropTargetKey].filter((k): k is Key => k != null));
  };
}

/** Class of a drop indicator: `rv-DropIndicator` by default (RAC `react-aria-DropIndicator`). */
export function dropIndicatorRenderProps(props: DropIndicatorProps, values: DropIndicatorRenderProps): ReturnType<typeof renderProps> {
  return renderProps({ class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-DropIndicator" });
}

// ---------------------------------------------------------------------------------------------
// Collection.tsx: useCollectionRender with drop indicators
// ---------------------------------------------------------------------------------------------

/**
 * RAC `renderAfterDropIndicators`: the keys whose "after" drop indicator renders after `key`'s row — one or more when
 * the next item in the flattened collection has a smaller level, is not an item, or there are no more items in the
 * collection (otherwise the "after" position is the next item's "before" position).
 */
export function afterDropIndicatorKeys(collection: ICollection<Node<unknown>>, key: Key): Key[] {
  const node = collection.getItem(key);
  if (!node || node.type !== "item") return [];
  let keyAfter = collection.getKeyAfter(key);
  let nextItemInFlattenedCollection = keyAfter != null ? collection.getItem(keyAfter) : null;
  while (nextItemInFlattenedCollection != null && nextItemInFlattenedCollection.type !== "item") {
    keyAfter = collection.getKeyAfter(nextItemInFlattenedCollection.key);
    nextItemInFlattenedCollection = keyAfter != null ? collection.getItem(keyAfter) : null;
  }
  let nextItemInSameLevel = node.nextKey != null ? collection.getItem(node.nextKey) : null;
  while (nextItemInSameLevel != null && nextItemInSameLevel.type !== "item")
    nextItemInSameLevel = nextItemInSameLevel.nextKey != null ? collection.getItem(nextItemInSameLevel.nextKey) : null;
  const keys: Key[] = [];
  if (nextItemInSameLevel == null) {
    let current: Node<unknown> | null = node;
    while (
      current?.type === "item" &&
      (!nextItemInFlattenedCollection || (current.parentKey !== nextItemInFlattenedCollection.parentKey && nextItemInFlattenedCollection.level < current.level))
    ) {
      keys.push(current.key);
      current = current.parentKey != null ? collection.getItem(current.parentKey) : null;
    }
  }
  return keys;
}

const sameKeys = (a: readonly Key[], b: readonly Key[]): boolean => a.length === b.length && a.every((k, i) => k === b[i]);

/**
 * A collection renderer's `renderRow` with drop indicators (RAC `useCollectionRender` + `renderDropIndicator`): the
 * "before" indicator of an item, the row, then its "after" indicators (`afterDropIndicatorKeys`).
 */
export function dropIndicatorRow(
  collection: () => ICollection<Node<unknown>>,
  renderDropIndicator: (target: ItemDropTarget) => unknown,
): (key: Key) => unknown {
  return (key) => {
    const isItem = () => collection().getItem(key)?.type === "item";
    const after = computed(() => afterDropIndicatorKeys(collection(), key), { equals: sameKeys });
    return [
      <Show when={isItem}>{() => renderDropIndicator({ type: "item", key, dropPosition: "before" }) as never}</Show>,
      renderNodeAt(collection, () => key),
      <For each={after} by={(k: Key) => k}>
        {(k: () => Key) => renderDropIndicator({ type: "item", key: untrack(k), dropPosition: "after" }) as never}
      </For>,
    ];
  };
}

// ---------------------------------------------------------------------------------------------
// useDragAndDrop.tsx
// ---------------------------------------------------------------------------------------------

interface DraggableCollectionStateOpts<T = object> extends Omit<DraggableCollectionStateOptions<T>, "getItems"> {}

interface DragHooks<T = object> {
  useDraggableCollectionState?: ((props: DraggableCollectionStateOpts<T>) => DraggableCollectionState) | undefined;
  useDraggableCollection?: ((props: DraggableCollectionOptions, state: DraggableCollectionState, ref: ElementRef) => void) | undefined;
  useDraggableItem?: ((props: DraggableItemProps, state: DraggableCollectionState) => DraggableItemResult) | undefined;
  DragPreview?: typeof DragPreview | undefined;
  renderDragPreview?: DragPreviewProps["children"] | undefined;
  isVirtualDragging?: (() => boolean) | undefined;
}

interface DropHooks {
  useDroppableCollectionState?: ((props: DroppableCollectionStateOptions) => DroppableCollectionState) | undefined;
  useDroppableCollection?:
    | ((props: Omit<DroppableCollectionOptions, keyof DroppableCollectionProps>, state: DroppableCollectionState, ref: ElementRef) => DroppableCollectionResult)
    | undefined;
  useDroppableItem?:
    ((options: DroppableItemOptions, state: DroppableCollectionState, ref: () => HTMLElement | null | undefined) => DroppableItemResult) | undefined;
  useDropIndicator?:
    ((props: AriaDropIndicatorProps, state: DroppableCollectionState, ref: () => HTMLElement | null | undefined) => DropIndicatorAria) | undefined;
  renderDropIndicator?: ((target: DropTarget) => unknown) | undefined;
  dropTargetDelegate?: DropTargetDelegate | undefined;
  ListDropTargetDelegate?: typeof ListDropTargetDelegate | undefined;
}

export type DragAndDropHooks<T = object> = DragHooks<T> & DropHooks;

export interface DragAndDrop<T = object> {
  /** Drag and drop hooks for the collection element. */
  dragAndDropHooks: DragAndDropHooks<T>;
}

export interface DragAndDropOptions<T = object> extends Omit<DraggableCollectionProps<T>, "preview" | "getItems">, DroppableCollectionProps {
  /** A function that returns the items being dragged. If not specified, we assume that the collection is not draggable. */
  getItems?: ((keys: Set<Key>, items: T[]) => DragItem[]) | undefined;
  /**
   * A function that renders a drag preview, which is shown under the user's cursor while dragging. By default, a copy
   * of the dragged element is rendered.
   */
  renderDragPreview?: ((items: DragItem[]) => unknown | { element: unknown; x: number; y: number }) | undefined;
  /**
   * A function that renders a drop indicator element between two items in a collection. This should render a
   * `<DropIndicator>` element. If this function is not provided, a default DropIndicator is provided.
   */
  renderDropIndicator?: ((target: DropTarget) => unknown) | undefined;
  /** A custom delegate object that provides drop targets for pointer coordinates within the collection. */
  dropTargetDelegate?: DropTargetDelegate | undefined;
  /** Whether the drag and drop events should be disabled. */
  isDisabled?: boolean | undefined;
}

/** `{ ...props, ...options }` keeping accessor properties (a collection passes getters, e.g. its keyboard delegate). */
const withOptions = <P extends object>(props: P, options: object): P =>
  Object.defineProperties(Object.defineProperties({}, Object.getOwnPropertyDescriptors(props)), Object.getOwnPropertyDescriptors(options)) as P;

/**
 * Provides the hooks required to enable drag and drop behavior for a drag and drop compatible collection component.
 * Rivet: call it once (a component body or module scope); the options are read when the collection's hooks run.
 */
export function useDragAndDrop<T = object>(options: DragAndDropOptions<T>): DragAndDrop<T> {
  const { onDrop, onInsert, onItemDrop, onReorder, onMove, onRootDrop, getItems, renderDragPreview, renderDropIndicator, dropTargetDelegate } = options;
  const isDraggable = !!getItems;
  const isDroppable = !!(onDrop || onInsert || onItemDrop || onReorder || onMove || onRootDrop);
  const hooks = {} as DragAndDropHooks<T>;
  if (isDraggable) {
    hooks.useDraggableCollectionState = (props) => useDraggableCollectionState(withOptions(props, options) as DraggableCollectionStateOptions<T>);
    hooks.useDraggableCollection = useDraggableCollection;
    hooks.useDraggableItem = useDraggableItem;
    hooks.DragPreview = DragPreview;
    hooks.renderDragPreview = renderDragPreview as DragPreviewProps["children"] | undefined;
    hooks.isVirtualDragging = isVirtualDragging;
  }
  if (isDroppable) {
    hooks.useDroppableCollectionState = (props) => useDroppableCollectionState(withOptions(props, options));
    hooks.useDroppableItem = (o, state, ref) => useDroppableItem(o, state, ref);
    hooks.useDroppableCollection = (props, state, ref) => useDroppableCollection(withOptions(props, options) as DroppableCollectionOptions, state, ref);
    hooks.useDropIndicator = (props, state, ref) => useDropIndicator(props, state, ref);
    hooks.renderDropIndicator = renderDropIndicator;
    hooks.dropTargetDelegate = dropTargetDelegate;
    hooks.ListDropTargetDelegate = ListDropTargetDelegate;
  }
  return { dragAndDropHooks: hooks };
}

/** The drag preview renderer of a collection's hooks (`renderDragPreview`), or `undefined`. */
export function dragPreviewOf(hooks: DragAndDropHooks<any> | undefined): { current: ReturnType<typeof createDragPreviewRenderer> | null } | undefined {
  return hooks?.renderDragPreview ? { current: createDragPreviewRenderer(hooks.renderDragPreview) } : undefined;
}
