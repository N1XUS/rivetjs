// Ported from react-resizable-panels (lib/global/event-handlers/onDocumentPointerLeave.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { getMountedAxes } from "../mutable-state/axes.ts";
import { getInteractionState } from "../mutable-state/interactions.ts";
import { updateActiveHitRegions } from "../utils/updateActiveHitRegion.ts";

export function onDocumentPointerLeave(event: PointerEvent) {
  const mountedAxes = getMountedAxes();
  const interactionState = getInteractionState();

  switch (interactionState.state) {
    case "active": {
      updateActiveHitRegions({
        commit: false,
        document: event.currentTarget as Document,
        event,
        hitRegions: interactionState.hitRegions,
        initialLayoutMap: interactionState.initialLayoutMap,
        mountedAxes,
        prevCursorFlags: interactionState.cursorFlags,
      });
    }
  }
}
