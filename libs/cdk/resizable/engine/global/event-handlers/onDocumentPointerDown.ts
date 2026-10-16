// Ported from react-resizable-panels (lib/global/event-handlers/onDocumentPointerDown.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { calculateResizePreviews } from "../utils/calculateResizePreviews.ts";
import { getMountedAxes } from "../mutable-state/axes.ts";
import { updateInteractionState } from "../mutable-state/interactions.ts";
import type { Layout, RegisteredResizeAxis } from "../types.ts";
import { findMatchingHitRegions } from "../utils/findMatchingHitRegions.ts";

export function onDocumentPointerDown(event: PointerEvent) {
  if (event.defaultPrevented) {
    return;
  } else if (event.pointerType === "mouse" && event.button > 0) {
    return;
  }

  const mountedAxes = getMountedAxes();

  const hitRegions = findMatchingHitRegions(event, mountedAxes);
  if (hitRegions.length === 0) {
    return;
  }

  const initialLayoutMap = new Map<RegisteredResizeAxis, Layout>();
  let didChangeFocus = false;

  hitRegions.forEach((current) => {
    if (current.separator) {
      if (!didChangeFocus) {
        didChangeFocus = true;

        // `focusVisible` is in TS 7's lib.dom but not 5.9's: assert instead of @ts-expect-error (unused under TS 7).
        // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
        current.separator.element.focus({
          focusVisible: false,
          preventScroll: true,
        } as FocusOptions);

        // TRICKY
        // Calling setPointerCapture() here would help with detecting pointer "pointermove"/"pointerup" events that happen over iframes
        // but it would also prevent "click" events from firing if the use releases without actually dragging
        // Because of this, it's safer to wait until the first "pointermove" event to set capture
      }
    }

    const match = mountedAxes.get(current.axis);
    if (match) {
      initialLayoutMap.set(current.axis, match.layout);
    }
  });

  const previews = Array.from(initialLayoutMap.keys()).flatMap((axis) =>
    axis.resizePreviewMode === "separator" ? calculateResizePreviews(axis, hitRegions) : [],
  );

  updateInteractionState({
    cursorFlags: 0,
    didPointerMove: false,
    hitRegions,
    initialLayoutMap,
    pointerDownAtPoint: { x: event.clientX, y: event.clientY },
    previewLayoutMap: new Map(initialLayoutMap),
    previews,
    state: "active",
  });

  event.preventDefault();
}
