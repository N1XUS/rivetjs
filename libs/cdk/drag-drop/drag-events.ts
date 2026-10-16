// Ported from Angular Components (src/cdk/drag-drop/drag-events.ts), MIT, © Google LLC.
// Rivet: `Cdk` prefix dropped (`CdkDragStart` → `DragStart`, `CdkDragDrop` → `DragDrop`, …); `source` /
// `item` / `container` are the browser-side directive instances (`DragInstance`, `DropListInstance`).
// Types only (zero runtime).
import type { DragInstance } from "./directives/drag.ts";
import type { DropListInstance } from "./directives/drop-list.ts";

/** Event emitted when the user starts dragging a draggable. */
export interface DragStart<T = any> {
  /** Draggable that emitted the event. */
  source: DragInstance<T>;
  /** Native event that started the drag sequence. */
  event: MouseEvent | TouchEvent;
}

/** Event emitted when the user releases an item, before any animations have started. */
export interface DragRelease<T = any> {
  /** Draggable that emitted the event. */
  source: DragInstance<T>;
  /** Native event that caused the release event. */
  event: MouseEvent | TouchEvent;
}

/** Event emitted when the user stops dragging a draggable. */
export interface DragEnd<T = any> {
  /** Draggable that emitted the event. */
  source: DragInstance<T>;
  /** Distance in pixels that the user has dragged since the drag sequence started. */
  distance: { x: number; y: number };
  /** Position where the pointer was when the item was dropped */
  dropPoint: { x: number; y: number };
  /** Native event that caused the dragging to stop. */
  event: MouseEvent | TouchEvent;
}

/** Event emitted when the user moves an item into a new drop container. */
export interface DragEnter<T = any, I = T> {
  /** Container into which the user has moved the item. */
  container: DropListInstance<T>;
  /** Item that was moved into the container. */
  item: DragInstance<I>;
  /** Index at which the item has entered the container. */
  currentIndex: number;
}

/**
 * Event emitted when the user removes an item from a
 * drop container by moving it into another one.
 */
export interface DragExit<T = any, I = T> {
  /** Container from which the user has a removed an item. */
  container: DropListInstance<T>;
  /** Item that was removed from the container. */
  item: DragInstance<I>;
}

/** Event emitted when the user drops a draggable item inside a drop container. */
export interface DragDrop<T, O = T, I = any> {
  /** Index of the item when it was picked up. */
  previousIndex: number;
  /** Current index of the item. */
  currentIndex: number;
  /** Item that is being dropped. */
  item: DragInstance<I>;
  /** Container in which the item was dropped. */
  container: DropListInstance<T>;
  /** Container from which the item was picked up. Can be the same as the `container`. */
  previousContainer: DropListInstance<O>;
  /** Whether the user's pointer was over the container when the item was dropped. */
  isPointerOverContainer: boolean;
  /** Distance in pixels that the user has dragged since the drag sequence started. */
  distance: { x: number; y: number };
  /** Position where the pointer was when the item was dropped */
  dropPoint: { x: number; y: number };
  /** Native event that caused the drop event. */
  event: MouseEvent | TouchEvent;
}

/** Event emitted as the user is dragging a draggable item. */
export interface DragMove<T = any> {
  /** Item that is being dragged. */
  source: DragInstance<T>;
  /** Position of the user's pointer on the page. */
  pointerPosition: { x: number; y: number };
  /** Native event that is causing the dragging. */
  event: MouseEvent | TouchEvent;
  /** Distance in pixels that the user has dragged since the drag sequence started. */
  distance: { x: number; y: number };
  /**
   * Indicates the direction in which the user is dragging the element along each axis.
   * `1` means that the position is increasing (e.g. the user is moving to the right or downwards),
   * whereas `-1` means that it's decreasing (they're moving to the left or upwards). `0` means
   * that the position hasn't changed.
   */
  delta: { x: -1 | 0 | 1; y: -1 | 0 | 1 };
}

/** Event emitted when the user swaps the position of two drag items. */
export interface DragSortEvent<T = any, I = T> {
  /** Index from which the item was sorted previously. */
  previousIndex: number;
  /** Index that the item is currently in. */
  currentIndex: number;
  /** Container that the item belongs to. */
  container: DropListInstance<T>;
  /** Item that is being sorted. */
  item: DragInstance<I>;
}
