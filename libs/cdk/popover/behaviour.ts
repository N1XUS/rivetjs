// Ported from React Aria (@react-aria/overlays usePopover) and React Aria Components (Popover.tsx),
// Apache-2.0, © Adobe.
// `@rivetjs/cdk/popover/behaviour`: the usePopover port (`popoverProps`, ./use-popover.ts) plus the
// client-effect body of the legacy `PopoverOverlay` shim (`attachPopoverOverlay`).
// Rivet: `attachPopoverOverlay` is internal glue for menu / select / date-picker until they render
// `<Popover>` through `PopoverContext`; it is not an upstream API.
import { untrack } from "@rivetjs/reactivity";
import { focusSafely } from "../focus/index.ts";
import type { Placement } from "../overlay/position.ts";
import type { OverlayTriggerState } from "../state/overlays.ts";
import { popoverProps } from "./use-popover.ts";

export * from "./use-popover.ts";
export type { Placement };

/** @internal Options of the legacy `PopoverOverlay` shim. */
export interface PopoverOverlayOptions {
  /** Id of the element the popover is anchored to (its trigger). */
  triggerId: string;
  placement?: Placement;
  offset?: number;
  crossOffset?: number;
  containerPadding?: number;
  shouldFlip?: boolean;
  maxHeight?: number;
  arrowBoundaryOffset?: number;
  /** Id of the boundary element. */
  boundaryId?: string;
  isNonModal?: boolean;
  isKeyboardDismissDisabled?: boolean;
  shouldCloseOnInteractOutside?: (element: Element) => boolean;
}

/** @internal Client effect body of `PopoverOverlay`: popoverProps while open + dialog focus + `onOpened`. */
export function attachPopoverOverlay(
  element: HTMLElement | undefined,
  state: OverlayTriggerState,
  options: PopoverOverlayOptions,
  isDialog: boolean,
  onOpened?: (element: HTMLElement) => void,
): (() => void) | undefined {
  if (!element || !state.isOpen()) return;
  return untrack(() => {
    const doc = element.ownerDocument;
    const boundary = options.boundaryId ? doc.getElementById(options.boundaryId) : null;
    const aria = popoverProps(
      {
        triggerRef: doc.getElementById(options.triggerId),
        popoverRef: element,
        arrowRef: element.querySelector(":scope > [data-slot=arrow]"),
        placement: options.placement ?? "bottom",
        offset: options.offset ?? 8,
        crossOffset: options.crossOffset ?? 0,
        containerPadding: options.containerPadding ?? 12,
        shouldFlip: options.shouldFlip ?? true,
        maxHeight: options.maxHeight,
        arrowBoundaryOffset: options.arrowBoundaryOffset ?? 0,
        boundaryElement: boundary ?? undefined,
        isNonModal: options.isNonModal,
        isKeyboardDismissDisabled: options.isKeyboardDismissDisabled,
        shouldCloseOnInteractOutside: options.shouldCloseOnInteractOutside,
      },
      state,
    );
    if (isDialog && !element.contains(doc.activeElement)) focusSafely(element.querySelector<HTMLElement>("[autofocus]") ?? element);
    onOpened?.(element);
    return () => aria.dispose();
  });
}
