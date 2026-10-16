// Ported from react-resizable-panels (lib/global/event-handlers/onDocumentLostPointerCapture.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { getInteractionState } from "../mutable-state/interactions.ts";
import { abortActivePointerResize } from "../utils/abortActivePointerResize.ts";

export function onDocumentLostPointerCapture(event: PointerEvent) {
  const interactionState = getInteractionState();
  if (interactionState.state !== "active") {
    return;
  }

  // Only one element can capture a pointer at a time,
  // so capturing it for one separator releases it from another when several separators are being dragged at once
  // The drag has only been interrupted if none of the active separators still holds capture
  const separatorElements = interactionState.hitRegions.flatMap(({ separator }) => (separator ? [separator.element] : []));
  if (!separatorElements.some((element) => element === event.target) || separatorElements.some((element) => element.hasPointerCapture?.(event.pointerId))) {
    return;
  }

  abortActivePointerResize(event.currentTarget as Document);
}
