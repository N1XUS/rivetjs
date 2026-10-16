// Ported from react-resizable-panels (lib/global/event-handlers/onDocumentContextMenu.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { completeActivePointerResize } from "../utils/completeActivePointerResize.ts";

export function onDocumentContextMenu(event: MouseEvent) {
  if (event.defaultPrevented) {
    return;
  }

  completeActivePointerResize(event.currentTarget as Document, event);
}
