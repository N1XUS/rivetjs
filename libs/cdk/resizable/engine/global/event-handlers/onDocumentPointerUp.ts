// Ported from react-resizable-panels (lib/global/event-handlers/onDocumentPointerUp.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { completeActivePointerResize } from "../utils/completeActivePointerResize.ts";

export function onDocumentPointerUp(event: PointerEvent) {
  if (event.defaultPrevented) {
    return;
  } else if (event.pointerType === "mouse" && event.button > 0) {
    return;
  }

  const matched = completeActivePointerResize(event.currentTarget as Document, event);
  if (matched) {
    event.preventDefault();
  }
}
