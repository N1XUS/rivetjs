// Ported from react-spectrum (@react-types/shared src/dnd.d.ts: the drag and drop types), Apache-2.0, © Adobe.
// Rivet:
// - Element refs are `ElementRef` (`{ current }`, react RefObject shape); Rivet element refs adapt with `elementRefOf`.
// - The drop item types (`DropItem`, `TextDropItem`, …) come from `../drop-zone/dnd.ts` (one implementation).
import type { Key, Node } from "../collections/types.ts";
import type { DragTypesLike, DropItem, DropOperation, FileDropItem, DirectoryDropItem, TextDropItem } from "../drop-zone/dnd.ts";

export type { DragTypesLike as DragTypes, DropItem, DropOperation, FileDropItem, DirectoryDropItem, TextDropItem };

/** A react RefObject-shaped element reference (`current` read at event time). */
export interface ElementRef<E extends Element = HTMLElement> {
  readonly current: E | null;
}

/** A drag item: a map of drag types (usually mime types) to data. */
export interface DragItem {
  [type: string]: string;
}

interface DragDropEvent {
  /** The x coordinate of the event, relative to the target element. */
  x: number;
  /** The y coordinate of the event, relative to the target element. */
  y: number;
}

export interface DragStartEvent extends DragDropEvent {
  type: "dragstart";
}
export interface DragMoveEvent extends DragDropEvent {
  type: "dragmove";
}
export interface DragEndEvent extends DragDropEvent {
  type: "dragend";
  /** The drop operation that occurred. */
  dropOperation: DropOperation;
}

export interface DropEnterEvent extends DragDropEvent {
  type: "dropenter";
}
export interface DropMoveEvent extends DragDropEvent {
  type: "dropmove";
}
export interface DropActivateEvent extends DragDropEvent {
  type: "dropactivate";
}
export interface DropExitEvent extends DragDropEvent {
  type: "dropexit";
}
export interface DropEvent extends DragDropEvent {
  type: "drop";
  /** The drop operation that should occur. */
  dropOperation: DropOperation;
  /** The dropped items. */
  items: DropItem[];
}

export type DropPosition = "on" | "before" | "after";

export interface RootDropTarget {
  /** The event type. */
  type: "root";
}

export interface ItemDropTarget {
  /** The drop target type. */
  type: "item";
  /** The item key. */
  key: Key;
  /** The drop position relative to the item. */
  dropPosition: DropPosition;
}

export type DropTarget = RootDropTarget | ItemDropTarget;

export interface DroppableCollectionEnterEvent extends DropEnterEvent {
  /** The drop target. */
  target: DropTarget;
}
export interface DroppableCollectionMoveEvent extends DropMoveEvent {
  /** The drop target. */
  target: DropTarget;
}
export interface DroppableCollectionActivateEvent extends DropActivateEvent {
  /** The drop target. */
  target: DropTarget;
}
export interface DroppableCollectionExitEvent extends DropExitEvent {
  /** The drop target. */
  target: DropTarget;
}
export interface DroppableCollectionDropEvent extends DropEvent {
  /** The drop target. */
  target: DropTarget;
}

export interface DroppableCollectionInsertDropEvent {
  /** The dropped items. */
  items: DropItem[];
  /** The drop operation that should occur. */
  dropOperation: DropOperation;
  /** The drop target. */
  target: ItemDropTarget;
}
export interface DroppableCollectionRootDropEvent {
  /** The dropped items. */
  items: DropItem[];
  /** The drop operation that should occur. */
  dropOperation: DropOperation;
}
export interface DroppableCollectionOnItemDropEvent {
  /** The dropped items. */
  items: DropItem[];
  /** The drop operation that should occur. */
  dropOperation: DropOperation;
  /** Whether the drag originated within the same collection as the drop. */
  isInternal: boolean;
  /** The drop target. */
  target: ItemDropTarget;
}
export interface DroppableCollectionReorderEvent {
  /** The keys of the items that were reordered. */
  keys: Set<Key>;
  /** The drop operation that should occur. */
  dropOperation: DropOperation;
  /** The drop target. */
  target: ItemDropTarget;
}

export interface DragTypesLikeSet {
  has(type: string | symbol): boolean;
}

export interface DroppableCollectionUtilityOptions {
  /** The drag types that the droppable collection accepts. If the collection accepts directories, include `DIRECTORY_DRAG_TYPE`. Default "all". */
  acceptedDragTypes?: "all" | Array<string | symbol> | undefined;
  /** Handler that is called when external items are dropped "between" items. */
  onInsert?: ((e: DroppableCollectionInsertDropEvent) => void | Promise<void>) | undefined;
  /** Handler that is called when external items are dropped on the droppable collection's root. */
  onRootDrop?: ((e: DroppableCollectionRootDropEvent) => void | Promise<void>) | undefined;
  /** Handler that is called when items are dropped "on" an item. */
  onItemDrop?: ((e: DroppableCollectionOnItemDropEvent) => void | Promise<void>) | undefined;
  /** Handler that is called when items are reordered within the collection (within the same parent). */
  onReorder?: ((e: DroppableCollectionReorderEvent) => void | Promise<void>) | undefined;
  /** Handler that is called when items are moved within the source collection (any position, any parent). */
  onMove?: ((e: DroppableCollectionReorderEvent) => void | Promise<void>) | undefined;
  /** A function returning whether a given target in the droppable collection is a valid "on" drop target for the current drag types. */
  shouldAcceptItemDrop?: ((target: ItemDropTarget, types: DragTypesLikeSet) => boolean) | undefined;
}

export interface DroppableCollectionBaseProps {
  /** Handler that is called when a valid drag enters a drop target. */
  onDropEnter?: ((e: DroppableCollectionEnterEvent) => void) | undefined;
  /** Handler that is called after a valid drag is held over a drop target for a period of time. */
  onDropActivate?: ((e: DroppableCollectionActivateEvent) => void) | undefined;
  /** Handler that is called when a valid drag exits a drop target. */
  onDropExit?: ((e: DroppableCollectionExitEvent) => void) | undefined;
  /** Handler that is called when a valid drag is dropped on a drop target. When defined, the utility handlers are not called. */
  onDrop?: ((e: DroppableCollectionDropEvent) => void) | undefined;
  /** A function returning the drop operation to be performed when items matching the given types are dropped on the drop target. */
  getDropOperation?: ((target: DropTarget, types: DragTypesLikeSet, allowedOperations: DropOperation[]) => DropOperation) | undefined;
}

export interface DroppableCollectionProps extends DroppableCollectionUtilityOptions, DroppableCollectionBaseProps {}

export interface DraggableCollectionStartEvent extends DragStartEvent {
  /** The keys of the items that were dragged. */
  keys: Set<Key>;
}
export interface DraggableCollectionMoveEvent extends DragMoveEvent {
  /** The keys of the items that were dragged. */
  keys: Set<Key>;
}
export interface DraggableCollectionEndEvent extends DragEndEvent {
  /** The keys of the items that were dragged. */
  keys: Set<Key>;
  /** Whether the drop ended within the same collection as it originated. */
  isInternal: boolean;
}

/** A drag preview renderer: renders the items' preview synchronously and hands its element to `callback`. */
export type DragPreviewRenderer = (items: DragItem[], callback: (node: HTMLElement | null, x?: number, y?: number) => void) => void;

export interface DraggableCollectionProps<T = object> {
  /** Handler that is called when a drag operation is started. */
  onDragStart?: ((e: DraggableCollectionStartEvent) => void) | undefined;
  /** Handler that is called when the drag is moved. */
  onDragMove?: ((e: DraggableCollectionMoveEvent) => void) | undefined;
  /** Handler that is called when the drag operation is ended, either as a result of a drop or a cancellation. */
  onDragEnd?: ((e: DraggableCollectionEndEvent) => void) | undefined;
  /** A function that returns the items being dragged. */
  getItems: (keys: Set<Key>, items: T[]) => DragItem[];
  /** The ref of the element that will be rendered as the drag preview while dragging. */
  preview?: { readonly current: DragPreviewRenderer | null } | undefined;
  /** Function that returns the drop operations that are allowed for the dragged items. If not provided, all drop operations are allowed. */
  getAllowedDropOperations?: (() => DropOperation[]) | undefined;
}

/** Provides drop targets for pointer coordinates within a collection (`ListDropTargetDelegate`, `TreeDropTargetDelegate`). */
export interface DropTargetDelegate {
  /**
   * Returns a drop target within a collection for the given x and y coordinates. The point is provided relative to the
   * top left corner of the collection container. A drop target can be checked to see if it is valid using the provided
   * `isValidDropTarget` function.
   */
  getDropTargetFromPoint(x: number, y: number, isValidDropTarget: (target: DropTarget) => boolean): DropTarget | null;
}

/** A collection DnD reads: the flattened collection (react-stately `Collection<Node>`). */
export type { Key, Node };
