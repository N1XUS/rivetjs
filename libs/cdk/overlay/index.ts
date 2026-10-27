// Overlays: React Aria's `useOverlay` as `overlay(element, props)`: the stack of visible overlays
// (only the top-most one closes at once), Escape inside the overlay, interact outside (pointerdown
// then click outside, `shouldCloseOnInteractOutside` filter), close on blur. Imperative: call when
// the overlay element is mounted and open (the overlay components call it from a client effect),
// call the returned function when it closes. Overlays are plain divs in the overlay layer
// (`<Overlay>`, ../portal/index.tsx), never the native top layer (`popover`, `<dialog>`).
// Global listeners attach on open and detach on close; nothing runs at import time.
//
// `overlay` / `interactOutside` ported from @react-aria/overlays (useOverlay.ts) and
// @react-aria/interactions (useInteractOutside.ts), Apache-2.0, © Adobe. `interactOutside` is the
// imperative (element + cleanup) form of `useInteractOutside` (`../interactions/interact-outside.tsx`)
// and shares its `isValidOutsideEvent`.
import { isValidOutsideEvent } from "../interactions/interact-outside.tsx";
import { getEventTarget } from "../utils/dom-core.ts";

export type { Placement } from "./position.ts";

export interface AriaOverlayProps {
  /** Whether the overlay is open (registered in the visible stack). @default true */
  isOpen?: boolean;
  /** Called when the overlay should close. */
  onClose?: () => void;
  /** Close on interaction outside the overlay (a value, or an accessor read at interaction time). @default false */
  isDismissable?: boolean | (() => boolean | undefined);
  /** Close when focus leaves the overlay (not when it is lost to the body). */
  shouldCloseOnBlur?: boolean;
  /** Disable closing with Escape (a value, or an accessor read at key time). @default false */
  isKeyboardDismissDisabled?: boolean | (() => boolean | undefined);
  /** Filter: return true when an interaction with `element` (outside the overlay) should close it. */
  shouldCloseOnInteractOutside?: (element: Element) => boolean;
  /**
   * Rivet: the element React Aria spreads `overlayProps.onKeyDown` on (a popover passes its own element while
   * `element` is its group, e.g. a submenu's root container). Default `element`.
   */
  keyTarget?: Element;
}

export interface InteractOutsideProps {
  onInteractOutside?: (event: PointerEvent) => void;
  onInteractOutsideStart?: (event: PointerEvent) => void;
  isDisabled?: boolean;
}

// Stack of visible overlays, top-most last (React Aria `visibleOverlays`).
const visibleOverlays: Element[] = [];

/** The top-most open overlay registered with `overlay()`. */
export const topOverlay = (): Element | undefined => visibleOverlays[visibleOverlays.length - 1];

/**
 * Interactions outside `element` (React Aria `useInteractOutside`): a pointerdown outside starts
 * one (`onInteractOutsideStart`), the following click outside completes it (`onInteractOutside`;
 * click rather than pointerup for Android Chrome). Capture phase. Returns the remove function.
 */
export function interactOutside(element: Element, props: InteractOutsideProps): () => void {
  const { onInteractOutside, onInteractOutsideStart, isDisabled } = props;
  if (isDisabled) return () => {};
  const doc = element.ownerDocument;
  let isPointerDown = false;
  // Outside-ness: ONE implementation (`../interactions/interact-outside.tsx`).
  const onPointerDown = (event: PointerEvent) => {
    if (onInteractOutside && isValidOutsideEvent(event, element)) {
      onInteractOutsideStart?.(event);
      isPointerDown = true;
    }
  };
  const onClick = (event: MouseEvent) => {
    if (isPointerDown && isValidOutsideEvent(event, element)) onInteractOutside?.(event as PointerEvent);
    isPointerDown = false;
  };
  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("click", onClick, true);
  return () => {
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("click", onClick, true);
  };
}

/**
 * Overlay behaviour (React Aria `useOverlay`) on `element`: Escape (keydown inside the overlay)
 * and, with `isDismissable`, interaction outside close the top-most overlay only;
 * `shouldCloseOnBlur` closes when focus moves to an element outside. Call on open; the returned
 * function unregisters (call on close).
 */
export function overlay(element: Element, props: AriaOverlayProps): () => void {
  const {
    onClose,
    shouldCloseOnBlur,
    isOpen = true,
    isDismissable = false,
    isKeyboardDismissDisabled = false,
    shouldCloseOnInteractOutside,
    keyTarget = element,
  } = props;
  const cleanups: (() => void)[] = [];
  if (isOpen && !visibleOverlays.includes(element)) {
    visibleOverlays.push(element);
    cleanups.push(() => {
      const index = visibleOverlays.indexOf(element);
      if (index >= 0) visibleOverlays.splice(index, 1);
    });
  }
  // Only the top-most visible overlay hides.
  const onHide = () => {
    if (visibleOverlays[visibleOverlays.length - 1] === element && onClose) onClose();
  };
  let lastVisibleOverlay: Element | undefined;
  const allowed = (target: EventTarget | null) => !shouldCloseOnInteractOutside || shouldCloseOnInteractOutside(target as Element);

  const onKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    // useKeyboard shortcut "Escape": no modifiers, no repeats, not composing; handled keys stop
    // propagating and prevent the default (nested overlays: the inner one handles it).
    if (e.key !== "Escape" || e.isComposing || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (typeof isKeyboardDismissDisabled === "function" ? isKeyboardDismissDisabled() : isKeyboardDismissDisabled) return;
    e.stopPropagation();
    e.preventDefault();
    onHide();
  };
  // On the overlay element, not its group: a submenu shares the root popover's container as group, and a
  // listener there sees the submenu's Escape before the submenu's own delegated (DOM v2) keydown handler
  // could stop it — closing the root menu too (React Aria: `onKeyDown` in the popover's `overlayProps`).
  keyTarget.addEventListener("keydown", onKeyDown);
  cleanups.push(() => keyTarget.removeEventListener("keydown", onKeyDown));

  // Rivet (live props): an accessor `isDismissable` is read at interaction time (React re-renders with the new value).
  const dismissable = typeof isDismissable === "function" ? () => !!isDismissable() : undefined;
  if ((dismissable || isDismissable) && isOpen)
    cleanups.push(
      interactOutside(element, {
        onInteractOutsideStart(event) {
          const topMostOverlay = visibleOverlays[visibleOverlays.length - 1];
          lastVisibleOverlay = topMostOverlay;
          if (dismissable && !dismissable()) return;
          if (allowed(getEventTarget(event)) && topMostOverlay === element) event.stopPropagation();
        },
        onInteractOutside(event) {
          if (dismissable && !dismissable()) return void (lastVisibleOverlay = undefined);
          if (allowed(getEventTarget(event))) {
            if (visibleOverlays[visibleOverlays.length - 1] === element) event.stopPropagation();
            if (lastVisibleOverlay === element) onHide();
          }
          lastVisibleOverlay = undefined;
        },
      }),
    );
  else
    cleanups.push(
      interactOutside(element, {
        // Still record the top-most overlay at pointerdown (React Aria passes the start handler always).
        onInteractOutsideStart: () => (lastVisibleOverlay = visibleOverlays[visibleOverlays.length - 1]),
      }),
    );

  if (shouldCloseOnBlur) {
    const onFocusOut = (event: Event) => {
      const related = (event as FocusEvent).relatedTarget as Element | null;
      // Focus lost to the body (tab switch, VoiceOver quirks): outside press handles real clicks.
      // Focus moving into a nested overlay (a child layer above this one) does not close it.
      if (!related || element.contains(related)) return;
      const index = visibleOverlays.indexOf(element);
      if (visibleOverlays.slice(index + 1).some((layer) => layer.contains(related))) return;
      if (allowed(related)) onClose?.();
    };
    element.addEventListener("focusout", onFocusOut);
    cleanups.push(() => element.removeEventListener("focusout", onFocusOut));
  }
  return () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  };
}
