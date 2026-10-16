// Ported from react-resizable-panels (lib/global/event-handlers/onDocumentPointerOut.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { getInteractionState, updateInteractionState } from "../mutable-state/interactions.ts";

export function onDocumentPointerOut(event: PointerEvent) {
  // For some reason, "pointerout" events don't fire if the `relatedTarget` is an iframe
  // This can leave the `data-separator` attribute in an invalid state ("hover") which in turn might break styles
  // The easiest fix for this case is to reset the interaction state in this specific circumstance
  // See issues/645
  if (event.relatedTarget instanceof HTMLIFrameElement) {
    const interactionState = getInteractionState();
    switch (interactionState.state) {
      case "hover": {
        updateInteractionState({
          cursorFlags: 0,
          state: "inactive",
        });
      }
    }
  }
}
