// Modal overlay behaviour (React Aria `useModalOverlay`): `overlay()` (Escape, optional dismiss on
// outside interaction), document scroll lock, and everything outside the modal hidden with `inert`
// (`ariaHideOutside`; while an entry animation runs, only kept visible in a parent modal's hiding).
// Call when the modal element is mounted and open; the returned function releases everything (the
// modal component calls it from a client effect, so unmounting or closing always releases).
// `modalUnderlayPointerDown` is the underlay's `onPointerDown` (React Aria `underlayProps`).
//
// Ported from @react-aria/overlays (useModalOverlay.ts, useOverlay.ts), Apache-2.0, © Adobe.
import { ariaHideOutside, keepVisible } from "./aria-hide-outside.ts";
import { overlay, type AriaOverlayProps } from "./index.ts";
import { preventScroll } from "./prevent-scroll.ts";
import { closeOverlay, type OverlayTriggerState } from "../state/overlays.ts";

export interface AriaModalOverlayProps extends Pick<AriaOverlayProps, "shouldCloseOnInteractOutside"> {
  /** Close on interaction outside the modal (a value, or an accessor read at interaction time). @default false */
  isDismissable?: boolean | (() => boolean | undefined);
  /** Disable closing with Escape (a value, or an accessor read at key time). @default false */
  isKeyboardDismissDisabled?: boolean | (() => boolean | undefined);
  /** Entry animation running: outside content is hidden only once it completes (call again with false). */
  isEntering?: boolean;
  /** Patch focus() so it does not scroll the page (React Aria `UNSTABLE_overrideFocus`). */
  overrideFocus?: boolean;
}

/** Attach modal behaviour to `element` for `state` (call when it opens); returns the release function. */
export function modalOverlay(element: HTMLElement, props: AriaModalOverlayProps, state: OverlayTriggerState): () => void {
  const cleanups = [
    overlay(element, {
      isOpen: true,
      onClose: () => closeOverlay(state),
      isDismissable: props.isDismissable,
      isKeyboardDismissDisabled: props.isKeyboardDismissDisabled,
      shouldCloseOnInteractOutside: props.shouldCloseOnInteractOutside,
    }),
    preventScroll({ overrideFocus: props.overrideFocus }),
  ];
  // Entering: keep this modal visible in a parent modal's hiding; hide outside afterwards.
  const undo = props.isEntering ? keepVisible(element) : ariaHideOutside([element], { shouldUseInert: true });
  if (undo) cleanups.push(undo);
  return () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
}

/** `onPointerDown` of a modal's underlay: a press on the underlay itself does not move focus (React Aria `onPointerDownUnderlay`). */
export function modalUnderlayPointerDown(event: PointerEvent): void {
  if (event.target === event.currentTarget) event.preventDefault();
}
