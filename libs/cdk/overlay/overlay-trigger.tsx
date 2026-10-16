// Ported from @react-aria/overlays (useOverlayTrigger.ts), Apache-2.0, © Adobe.
// Overlay trigger (React Aria `useOverlayTrigger` → `overlayTriggerProps`): ARIA attributes of a button
// that opens an overlay positioned relative to it (popover, menu, listbox, …) and of the overlay.
// Rivet:
// - returns RA's bags with RA keys; reactive values are accessors (`aria-expanded`, `aria-controls`),
//   `onPress` toggles (spread the bag on a cdk `Button`, or call `toggleOverlay(state)` from your own
//   inline handler on a resumed page: functions created in a `.ts` module do not serialize).
// - RA's effect sharing `state.close` with useOverlayPosition through `onCloseMap` = `registerTrigger(trigger, state)`
//   (call when the trigger element exists, e.g. from a client effect; `overlayTriggerProps` registers it
//   itself when given a ref that is already attached).
// - `id` option: the overlay id (RA: `useId()`), so the server and the browser agree.
import { untrack } from "@rivetjs/reactivity";
import { createId } from "../utils/id.ts";
import { onCloseMap } from "./close-on-scroll.ts";
import { closeOverlay, toggleOverlay, type OverlayTriggerState } from "../state/overlays.ts";

export interface OverlayTriggerProps {
  /** Type of overlay that is opened by the trigger. */
  type: "dialog" | "menu" | "listbox" | "tree" | "grid";
  /** Rivet: id of the overlay element. @default createId() */
  id?: string;
}

export interface OverlayTriggerAria {
  /** Props for the trigger element. */
  triggerProps: {
    "aria-haspopup": true | "listbox" | undefined;
    "aria-expanded": () => boolean;
    "aria-controls": () => string | undefined;
    onPress: () => void;
  };
  /** Props for the overlay container element. */
  overlayProps: { id: string };
}

/**
 * Handles the behavior and accessibility for an overlay trigger, e.g. a button that opens a popover,
 * menu, or other overlay that is positioned relative to the trigger (React Aria `useOverlayTrigger`).
 */
export function overlayTriggerProps(props: OverlayTriggerProps, state: OverlayTriggerState, ref?: () => Element | null | undefined): OverlayTriggerAria {
  const { type } = props;

  // Backward compatibility. Share state close function with useOverlayPosition so it can close on scroll
  // without forcing users to pass onClose.
  const element = ref ? untrack(ref) : null;
  if (element) registerTrigger(element, state);

  // Aria 1.1 supports multiple values for aria-haspopup other than just menus.
  // https://www.w3.org/TR/wai-aria-1.1/#aria-haspopup
  // However, we only add it for menus for now because screen readers often
  // announce it as a menu even for other values.
  let ariaHasPopup: undefined | true | "listbox" = undefined;
  if (type === "menu") ariaHasPopup = true;
  else if (type === "listbox") ariaHasPopup = "listbox";

  const overlayId = props.id ?? createId();
  return {
    triggerProps: {
      "aria-haspopup": ariaHasPopup,
      "aria-expanded": () => state.isOpen(),
      "aria-controls": () => (state.isOpen() ? overlayId : undefined),
      onPress: () => toggleOverlay(state),
    },
    overlayProps: { id: overlayId },
  };
}

/** Share `state.close` with `overlayPosition` for `trigger` (React Aria's onCloseMap effect). */
export function registerTrigger(trigger: Element, state: OverlayTriggerState): void {
  onCloseMap.set(trigger, () => closeOverlay(state));
}
