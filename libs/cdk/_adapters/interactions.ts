// Thin layer over the package's interaction foundations for the delegated collection handlers
// (`selection.ts`, `select/behaviour.ts`): everything here re-exports ONE implementation —
// modality from `../interactions/focus-visible.tsx`, virtual events from `../platform`, links from
// `../utils/links.tsx`, scrolling from `../utils/dom.ts`, focus from `../focus`, virtual focus from
// `../selection/dom-utils.ts`. Only the owner-keyed long-press timer (react-aria `useLongPress`,
// 500 ms) and the `PressEvent` factory the handlers call are defined here.
// Ported from react-spectrum (Apache-2.0, © Adobe): interactions/useLongPress.ts (timer), usePress.ts (event shape).
import type { PressEvent as AriaPressEvent } from "../interactions/press.tsx";
import type { PointerType } from "../interactions/utils.ts";

export type { PointerType } from "../interactions/utils.ts";
export type { Modality } from "../interactions/focus-visible.tsx";
export { getInteractionModality, isFocusVisible, noteModality, setInteractionModality } from "../interactions/focus-visible.tsx";
export { isVirtualClick, isVirtualPointerEvent } from "../platform/index.ts";
export { focusSafely } from "../focus/index.ts";
export { focusWithoutScrolling } from "../utils/index.ts";
export { isOpeningLink, openLink, shouldClientNavigate, type Modifiers } from "../utils/links.tsx";
export { scrollIntoView, scrollIntoViewport } from "../utils/dom.ts";
export { dispatchVirtualBlur, dispatchVirtualFocus, getVirtuallyFocusedElement, moveVirtualFocus, pointerTypeOf } from "../selection/dom-utils.ts";
export { CLEAR_FOCUS_EVENT, FOCUS_EVENT } from "../selection/selectable-collection.ts";

/** react-aria `PressEvent` (the fields the collection behaviours read). */
export type PressEvent = AriaPressEvent;

/** A `PressEvent` for a delegated handler (`continuePropagation` is a no-op: the handler owns propagation). */
export function pressEvent(type: PressEvent["type"], pointerType: PointerType, target: HTMLElement, e: Event): PressEvent {
  const m = e as MouseEvent & KeyboardEvent;
  const rect = target.getBoundingClientRect();
  return {
    type,
    pointerType,
    target,
    shiftKey: !!m.shiftKey,
    ctrlKey: !!m.ctrlKey,
    metaKey: !!m.metaKey,
    altKey: !!m.altKey,
    ...(m.key !== undefined ? { key: m.key } : {}),
    x: (m.clientX ?? rect.left) - rect.left,
    y: (m.clientY ?? rect.top) - rect.top,
    continuePropagation() {},
  };
}

// --- Long press (useLongPress) -----------------------------------------------------------------

const DEFAULT_THRESHOLD = 500;
const timers = new WeakMap<object, ReturnType<typeof setTimeout>>();

/** Start a long-press timer for `owner` (react-aria `useLongPress`, 500 ms default threshold). */
export function startLongPress(owner: object, onLongPress: () => void, threshold = DEFAULT_THRESHOLD): void {
  cancelLongPress(owner);
  timers.set(
    owner,
    setTimeout(() => {
      timers.delete(owner);
      onLongPress();
    }, threshold),
  );
}

export function cancelLongPress(owner: object): boolean {
  const timer = timers.get(owner);
  if (timer === undefined) return false;
  clearTimeout(timer);
  timers.delete(owner);
  return true;
}
