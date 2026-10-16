// Ported from react-resizable-panels (lib/global/event-handlers/onDocumentPointerCancel.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { abortActivePointerResize } from "../utils/abortActivePointerResize.ts";

export function onDocumentPointerCancel(event: PointerEvent) {
  // The browser has taken over the pointer (e.g. a system gesture) so no "pointerup" will follow
  // "pointercancel" coordinates are unreliable, so commit the most recent layout instead
  abortActivePointerResize(event.currentTarget as Document);
}
