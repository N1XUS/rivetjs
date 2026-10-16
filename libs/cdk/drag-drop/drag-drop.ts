// Ported from Angular Components (src/cdk/drag-drop/drag-drop.ts), MIT, © Google LLC.
// Rivet: the `DragDrop` service is the `dragDrop` object (no DI; the name `DragDrop` is the drop event
// type); prefer `createDragRef` / `createDropListRef` (better tree shaking, like upstream).
import { createDragRef, type DragRef, type DragRefConfig } from "./drag-ref.ts";
import { createDropListRef, type DropListRef } from "./drop-list-ref.ts";
import type { ElementLike } from "./dom/coerce.ts";

/** Service that allows for drag-and-drop functionality to be attached to DOM elements (Angular `DragDrop`). */
export interface DragDropService {
  /**
   * Turns an element into a draggable item.
   * @param element Element to which to attach the dragging functionality.
   * @param config Object used to configure the dragging behavior.
   */
  createDrag<T = any>(element: ElementLike, config?: DragRefConfig): DragRef<T>;
  /**
   * Turns an element into a drop list.
   * @param element Element to which to attach the drop list functionality.
   */
  createDropList<T = any>(element: ElementLike): DropListRef<T>;
}

/** Angular `inject(DragDrop)`. */
export const dragDrop: DragDropService = {
  createDrag: <T = any>(element: ElementLike, config?: DragRefConfig): DragRef<T> => createDragRef<T>(element, config),
  createDropList: <T = any>(element: ElementLike): DropListRef<T> => createDropListRef<T>(element),
};
