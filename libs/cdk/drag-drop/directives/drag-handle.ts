// Ported from Angular Components (src/cdk/drag-drop/directives/drag-handle.ts), MIT, © Google LLC.
// Rivet: the handle's only input (`disabled`) is rendered by `<DragHandle>` as `data-disabled`, so the
// instance is derived from the DOM: the owning `DragInstance` collects the `[data-rv-drag-handle]`
// elements below its element (Angular: `CDK_DRAG_PARENT`, else the parent walk in `ngAfterViewInit`)
// and re-syncs them before every pointer down (Angular: `_stateChanges`). No handle code ships with
// the page. `_stateChanges` / `_addHandle` / `_removeHandle` map to `DragInstance._syncHandles()`.
import { HANDLE_ATTR } from "./registry.ts";

/** Handle that can be used to drag a `Drag` instance (Angular `CdkDragHandle`). */
export class DragHandleInstance {
  /** Element the handle is rendered as. */
  readonly element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  /** Whether starting to drag through this handle is disabled. */
  get disabled(): boolean {
    return this.element.hasAttribute("data-disabled");
  }
}

/** The handle elements of a drag element (not those of nested drags). */
export function handleElements(dragElement: HTMLElement, dragAttr: string): HTMLElement[] {
  const result: HTMLElement[] = [];
  dragElement.querySelectorAll<HTMLElement>(`[${HANDLE_ATTR}]`).forEach((handle) => {
    // Owned by the closest drag (a handle on the drag element itself counts too).
    if (handle.closest(`[${dragAttr}]`) === dragElement) result.push(handle);
  });
  return result;
}
