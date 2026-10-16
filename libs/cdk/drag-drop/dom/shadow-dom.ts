// Ported from Angular Components (src/cdk/platform/features/shadow-dom.ts), MIT, © Google LLC.

/** Gets the shadow root of an element, if supported and the element is inside the Shadow DOM. */
export function _getShadowRoot(element: HTMLElement): ShadowRoot | null {
  if (typeof element.attachShadow === "function") {
    const rootNode = element.getRootNode ? element.getRootNode() : null;
    // Note that this should be caught by `_supportsShadowDom`, but some
    // teams have been able to hit this code path on unsupported browsers.
    if (typeof ShadowRoot !== "undefined" && ShadowRoot && rootNode instanceof ShadowRoot) return rootNode;
  }
  return null;
}

/** Gets the event target of an event while accounting for Shadow DOM. */
export function _getEventTarget<T extends EventTarget>(event: Event): T | null {
  // If an event is bound outside the Shadow DOM, the `event.target` will
  // point to the shadow root so we have to use `composedPath` instead.
  return (event.composedPath ? event.composedPath()[0] : event.target) as T | null;
}
