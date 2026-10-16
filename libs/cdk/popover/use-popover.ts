// Ported from @react-aria/overlays (usePopover.ts), Apache-2.0, © Adobe.
// Popover behaviour (React Aria `usePopover` → `popoverProps`): an overlay positioned relative to its
// trigger — `overlay()` (Escape, close on outside interaction unless non-modal, close on blur),
// `overlayPosition()` (flip, offsets, arrow, max height; non-modal popovers close when a scroll
// parent of the trigger scrolls), document scroll lock and `inert` outside (modal popovers) or
// `keepVisible` (non-modal), focus-within events on the popover.
// Rivet:
// - imperative: call it in the browser when the popover is open and rendered; it attaches the
//   handlers RA spreads as `popoverProps` (overlay keydown / outside / blur, focusin / focusout of
//   useFocusWithin) and the position styles (CSSOM) to the elements directly. Returns RA's result
//   (`placement`, `triggerAnchorPoint` as signals, `underlayProps`) plus `updatePosition` and
//   `dispose` (release on close / unmount; `<Popover>` does both from a client effect).
// - refs are `ElementSource`s (an element, a `ref()` or an accessor).
import { ariaHideOutside, keepVisible } from "../overlay/aria-hide-outside.ts";
import { overlay } from "../overlay/index.ts";
import { overlayPosition, type AriaPositionProps, type ElementSource, type PositionAria } from "../overlay/position.ts";
import { modalUnderlayPointerDown } from "../overlay/modal-overlay.ts";
import { preventScroll } from "../overlay/prevent-scroll.ts";
import { focusWithinBlur, focusWithinFocus, type FocusWithinProps } from "../interactions/focus.tsx";
import { closeOverlay, type OverlayTriggerState } from "../state/overlays.ts";

export interface AriaPopoverProps extends Omit<AriaPositionProps, "isOpen" | "onClose" | "target" | "overlay" | "arrow">, Omit<FocusWithinProps, "isDisabled"> {
  /** The ref for the element which the popover positions itself with respect to. */
  triggerRef: ElementSource;
  /** The ref for the popover element. */
  popoverRef: ElementSource<HTMLElement>;
  /** A ref for the popover arrow element. */
  arrowRef?: ElementSource;
  /**
   * An optional ref for a group of popovers, e.g. submenus.
   * When provided, this element is used to detect outside interactions
   * and hiding elements from assistive technologies instead of the popoverRef.
   */
  groupRef?: ElementSource;
  /**
   * Whether the popover is non-modal, i.e. elements outside the popover may be
   * interacted with by assistive technologies.
   *
   * Most popovers should not use this option as it may negatively impact the screen
   * reader experience. Only use with components such as combobox, which are designed
   * to handle this situation carefully.
   */
  isNonModal?: boolean;
  /**
   * Whether pressing the escape key to close the popover should be disabled.
   *
   * Most popovers should not use this option. When set to true, an alternative
   * way to close the popover with a keyboard must be provided.
   *
   * @default false
   */
  isKeyboardDismissDisabled?: boolean;
  /**
   * When user interacts with the argument element outside of the popover ref,
   * return true if onClose should be called. This gives you a chance to filter
   * out interaction with elements that should not dismiss the popover.
   * By default, onClose will always be called on interaction outside the popover ref.
   */
  shouldCloseOnInteractOutside?: (element: Element) => boolean;
  /** The name of the component that triggered the popover (RA reads `trigger === "SubmenuTrigger"`). */
  trigger?: string;
}

export interface PopoverAria extends Pick<PositionAria, "placement" | "triggerAnchorPoint" | "position" | "updatePosition"> {
  /** Props to apply to the underlay element, if any (its `onPointerDown`). */
  underlayProps: { onPointerDown: (event: PointerEvent) => void };
  /** Release everything (call on close / unmount). */
  dispose(): void;
}

const read = <T extends Element>(source: ElementSource<T> | undefined): T | null => (typeof source === "function" ? source() : source) ?? null;

/**
 * Provides the behavior and accessibility implementation for a popover component. A popover is an
 * overlay element positioned relative to a trigger (React Aria `usePopover`). Call on open.
 */
export function popoverProps(props: AriaPopoverProps, state: OverlayTriggerState): PopoverAria {
  const {
    triggerRef,
    popoverRef,
    groupRef,
    arrowRef,
    isNonModal,
    isKeyboardDismissDisabled,
    shouldCloseOnInteractOutside,
    onFocusWithin,
    onBlurWithin,
    onFocusWithinChange,
    trigger,
    ...otherProps
  } = props;
  const element = read(popoverRef);
  const groupElement = read(groupRef);
  if (!element) throw new Error("popoverProps(): missing popover element");
  const isSubmenu = trigger === "SubmenuTrigger";
  const cleanups: (() => void)[] = [];
  cleanups.push(
    overlay(groupElement ?? element, {
      isOpen: true,
      onClose: () => closeOverlay(state),
      shouldCloseOnBlur: true,
      isDismissable: !isNonModal || isSubmenu,
      isKeyboardDismissDisabled,
      shouldCloseOnInteractOutside,
      keyTarget: element,
    }),
  );
  const point = state.point?.();
  const position = overlayPosition({
    ...otherProps,
    target: triggerRef,
    overlay: element,
    arrow: arrowRef,
    isOpen: true,
    onClose: isNonModal && !isSubmenu ? () => closeOverlay(state) : null,
    getTargetRect: otherProps.getTargetRect ?? (point ? () => new DOMRect(point.x, point.y, 0, 0) : undefined),
  });
  cleanups.push(() => position.dispose());
  if (!isNonModal) cleanups.push(preventScroll());
  const undo = isNonModal ? keepVisible(groupElement ?? element) : ariaHideOutside([groupElement ?? element], { shouldUseInert: true });
  if (undo) cleanups.push(undo);
  // useFocusWithin(props) merged into popoverProps.
  if (onFocusWithin || onBlurWithin || onFocusWithinChange) {
    const within = { props: { onFocusWithin, onBlurWithin, onFocusWithinChange }, state: { isFocusWithin: false, globals: [] as (() => void)[] } };
    const onIn = (e: Event) => focusWithinFocus(within, e as FocusEvent);
    const onOut = (e: Event) => focusWithinBlur(within, e as FocusEvent);
    element.addEventListener("focusin", onIn);
    element.addEventListener("focusout", onOut);
    // Focus already inside (a popover that focused itself before this ran).
    if (element.contains(element.ownerDocument.activeElement)) {
      const active = element.ownerDocument.activeElement!;
      const event = new FocusEvent("focusin", { bubbles: true });
      Object.defineProperty(event, "target", { value: active });
      Object.defineProperty(event, "currentTarget", { value: element });
      focusWithinFocus(within, event);
    }
    cleanups.push(() => {
      element.removeEventListener("focusin", onIn);
      element.removeEventListener("focusout", onOut);
      for (const remove of within.state.globals.splice(0)) remove();
    });
  }
  return {
    placement: position.placement,
    triggerAnchorPoint: position.triggerAnchorPoint,
    position: position.position,
    updatePosition: position.updatePosition,
    underlayProps: { onPointerDown: modalUnderlayPointerDown },
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    },
  };
}
