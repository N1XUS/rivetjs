// Ported from react-resizable-panels (lib/global/event-handlers/onWindowBlur.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { abortActivePointerResize } from "../utils/abortActivePointerResize.ts";

export function onWindowBlur(event: FocusEvent) {
  // Element "blur" events don't bubble, but ignore them anyway in case they are dispatched to the window
  if (event.target !== event.currentTarget) {
    return;
  }

  // Focus moved to another window or a native dialog so a "pointerup" event may never reach this document
  abortActivePointerResize((event.currentTarget as Window).document);
}
