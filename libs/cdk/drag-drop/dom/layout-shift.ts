// Rivet-authored (no upstream file). Animates the layout shift of a drop list's items when a dragged
// item enters or leaves the list.
//
// Angular CDK moves the placeholder between lists with a plain DOM insert, so the receiving list's items
// (and the source list's items, once the placeholder leaves) jump to their new layout position: only
// the sorting inside a list animates, through the user's `transform` transition on the items. Here the
// jump is replaced by a FLIP: the items' visual rects are read before the change, then (in a microtask,
// after the drag engine finished the pointer move) each moved item plays a Web Animation from its old
// position back to zero. The animation is additive (`composite: "add"`), so the sort strategy's inline
// transforms and their CSS transitions keep working on top, and the inline style never sees it.
// The duration / easing are the item's own `transform` transition (the CSS the upstream docs ask for)
// after the change, else before it (the source list drops its `cdk-drop-list-dragging` transition on
// exit), so an item without a transform transition still jumps, as upstream.

/** `Animation.id` of the layout-shift animations (lets the drop list cancel them before it measures). */
const SHIFT_ID = "rv-drop-list-shift";

/** Cancels the running layout-shift animations of `elements`. */
export function cancelLayoutShift(elements: readonly HTMLElement[]): void {
  for (const element of elements) {
    if (typeof element.getAnimations !== "function") return;
    for (const animation of element.getAnimations()) {
      if (animation.id === SHIFT_ID) animation.cancel();
    }
  }
}

/**
 * Reads the visual rects of `elements` now (including running transforms / shift animations), cancels
 * their running shift animations and returns a function that, once called, animates every element that
 * moved from its old position to its new one (measured in a microtask, after the caller's DOM work).
 */
export function captureLayoutShift(elements: readonly HTMLElement[]): () => void {
  if (!elements.length || typeof elements[0].animate !== "function") return () => {};
  const first = elements.map((element) => element.getBoundingClientRect());
  // A list that stops sorting (exit) loses its `cdk-drop-list-dragging` transition with the change.
  const before = elements.map(transformTransition);
  cancelLayoutShift(elements);

  return () =>
    queueMicrotask(() => {
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (!element.isConnected) continue;
        const timing = transformTransition(element) || before[i];
        if (!timing) continue;
        const last = element.getBoundingClientRect();
        const x = first[i].left - last.left;
        const y = first[i].top - last.top;
        if (!x && !y) continue;
        element.animate([{ transform: `translate3d(${x}px, ${y}px, 0)` }, { transform: "translate3d(0, 0, 0)" }], {
          ...timing,
          composite: "add",
          id: SHIFT_ID,
        });
      }
    });
}

/** The element's computed `transform` transition (`transform` or `all`), or null when it has none. */
function transformTransition(element: HTMLElement): { duration: number; delay: number; easing: string } | null {
  const style = getComputedStyle(element);
  const properties = list(style, "transition-property");
  const index = properties.findIndex((property) => property === "transform" || property === "all");
  if (index < 0) return null;
  const duration = timeAt(list(style, "transition-duration"), index);
  if (!duration) return null;
  const easings = style.getPropertyValue("transition-timing-function").split(/,(?![^(]*\))/);
  return {
    duration,
    delay: timeAt(list(style, "transition-delay"), index),
    easing: (easings[index % easings.length] || "ease").trim(),
  };
}

function list(style: CSSStyleDeclaration, name: string): string[] {
  return style
    .getPropertyValue(name)
    .split(",")
    .map((part) => part.trim());
}

/** CSS repeats a shorter time list to the property count. */
function timeAt(values: string[], index: number): number {
  const value = values[index % values.length] || "0s";
  return parseFloat(value) * (value.toLowerCase().indexOf("ms") > -1 ? 1 : 1000) || 0;
}
