// react-aria `focusWithoutScrolling` + `runAfterTransition` (Apache-2.0, © Adobe; ported in `./index.ts` before
// DOCS-COLD 2026-10-20). A leaf module: no imports, so the focus / overlay helpers that need these two do not reach
// `./index.ts` (which re-exports `merge-props`); `./index.ts` re-exports them.

/** Focus `element` without scrolling it into view (`focus({ preventScroll: true })`, Baseline). */
export function focusWithoutScrolling(element: HTMLElement | SVGElement): void {
  element.focus({ preventScroll: true });
}

// --- runAfterTransition ---------------------------------------------------------------------------

// Elements currently transitioning → their transitioning CSS properties (a set, not a count: Chrome
// sometimes fires both transitionend and transitioncancel).
const transitionsByElement = new Map<EventTarget, Set<string>>();
const transitionCallbacks = new Set<(isTransition: boolean) => void>();
let tracking: Document | null = null;

const isTransitionEvent = (event: Event): event is TransitionEvent => "propertyName" in event;
const eventTarget = (event: Event): EventTarget | null => {
  try {
    return event.composedPath?.()[0] ?? event.target;
  } catch {
    return event.target;
  }
};

function onTransitionStart(event: Event): void {
  const target = eventTarget(event);
  if (!isTransitionEvent(event) || !target) return;
  let transitions = transitionsByElement.get(target);
  if (!transitions) {
    transitionsByElement.set(target, (transitions = new Set()));
    // On the element itself: it must fire even when the node is removed mid-transition.
    target.addEventListener("transitioncancel", onTransitionEnd, { once: true });
  }
  transitions.add(event.propertyName);
}

function onTransitionEnd(event: Event): void {
  const target = eventTarget(event);
  if (!isTransitionEvent(event) || !target) return;
  const properties = transitionsByElement.get(target);
  if (!properties) return;
  properties.delete(event.propertyName);
  if (properties.size === 0) {
    target.removeEventListener("transitioncancel", onTransitionEnd);
    transitionsByElement.delete(target);
  }
  if (transitionsByElement.size === 0) {
    for (const callback of transitionCallbacks) {
      callback(true);
      transitionCallbacks.delete(callback);
    }
  }
}

/**
 * Start tracking transitions in `doc` (react-aria does this at import; Rivet modules have no
 * import-time effects, so the first `runAfterTransition` call does it). Transitions already running
 * then are picked up from `document.getAnimations()`.
 */
export function trackTransitions(doc: Document = document): void {
  if (tracking === doc) return;
  tracking = doc;
  doc.addEventListener("transitionrun", onTransitionStart);
  doc.addEventListener("transitionend", onTransitionEnd);
  try {
    for (const animation of doc.getAnimations?.() ?? []) {
      const css = animation as Animation & { transitionProperty?: string; effect: KeyframeEffect | null };
      const target = css.effect?.target;
      if (css.transitionProperty && target && animation.playState === "running")
        onTransitionStart(
          Object.assign(new Event("transitionrun"), { propertyName: css.transitionProperty, composedPath: () => [target] }) as unknown as TransitionEvent,
        );
    }
  } catch {}
}

/** Test hook: stop tracking and forget running transitions and queued callbacks. */
export function _resetTransitions(): void {
  tracking?.removeEventListener("transitionrun", onTransitionStart);
  tracking?.removeEventListener("transitionend", onTransitionEnd);
  tracking = null;
  transitionsByElement.clear();
  transitionCallbacks.clear();
}

function cleanupDetachedElements(): void {
  for (const [target] of transitionsByElement) if ("isConnected" in target && !(target as Node).isConnected) transitionsByElement.delete(target);
}

/**
 * Run `fn` once every running CSS transition in the document finished (`fn(true)`), or on the next
 * frame when none runs (`fn(false)`; one frame lets a transition on mount start). Returns a cancel function.
 */
export function runAfterTransition(fn: (isTransition: boolean) => void): () => void {
  trackTransitions();
  const frame = requestAnimationFrame(() => {
    cleanupDetachedElements();
    if (transitionsByElement.size === 0) return fn(false);
    transitionCallbacks.add(fn);
  });
  return () => {
    cancelAnimationFrame(frame);
    transitionCallbacks.delete(fn);
  };
}
