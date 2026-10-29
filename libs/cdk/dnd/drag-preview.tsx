// Ported from react-spectrum (packages/react-aria/src/dnd/DragPreview.tsx), Apache-2.0, © Adobe.
// A drag preview renderer: `useDrag` calls it during `dragstart` with the dragged items; it renders `children(items)`
// synchronously off screen, hands the element to `setDragImage` and removes it after a frame.
// Rivet:
// - Renders imperatively into a body-level container (`mount` from `@rivetjs/runtime/dom`; its server form links and
//   throws, the renderer only runs in a browser `dragstart`) instead of a React state
//   update + `flushSync`: nothing is in the page markup (server or client) until a drag starts. The preview inherits
//   the body's text styles (react-aria: the position where `<DragPreview>` is rendered).
// - `DragPreview` sets its `ref` (`{ current }`) to the renderer and renders nothing.
import { mount } from "@rivetjs/runtime/dom";
import type { DragItem, DragPreviewRenderer } from "./types.ts";

export interface DragPreviewProps {
  /**
   * A render function which returns a preview element, or an object containing the element and a custom offset. If an
   * object is returned, the provided `x` and `y` values will be used as the drag preview offset instead of the default
   * calculation.
   */
  children: (items: DragItem[]) => unknown | { element: unknown; x: number; y: number } | null;
  /** Receives the renderer (react-aria `ref` of `DragPreview`). */
  ref?: { current: DragPreviewRenderer | null } | undefined;
}

/** The renderer of a drag preview for `children` (react-aria `DragPreview`'s imperative handle). */
export function createDragPreviewRenderer(children: DragPreviewProps["children"]): DragPreviewRenderer {
  return (items, callback) => {
    // Called during the dragstart event by useDrag: the preview must exist before this event returns so
    // event.dataTransfer.setDragImage can use it.
    const result = children(items);
    let element: unknown;
    let offsetX: number | undefined;
    let offsetY: number | undefined;
    if (result && typeof result === "object" && "element" in (result as object)) {
      element = (result as { element: unknown }).element;
      offsetX = (result as { x: number }).x;
      offsetY = (result as { y: number }).y;
    } else element = result;
    if (element == null) return callback(null);
    const host = document.createElement("div");
    host.style.cssText = "z-index:-100;position:fixed;top:0;left:-100000px";
    document.body.appendChild(host);
    const dispose = mount(() => element as never, host);
    // Yield back to useDrag to set the drag image.
    callback(host, offsetX, offsetY);
    // Remove the preview from the DOM after a frame so the browser has time to paint.
    requestAnimationFrame(() => {
      dispose();
      host.remove();
    });
  };
}

/** Provides the drag preview renderer through `ref` (renders nothing). */
export function DragPreview(props: DragPreviewProps): null {
  if (props.ref) props.ref.current = createDragPreviewRenderer(props.children);
  return null;
}
