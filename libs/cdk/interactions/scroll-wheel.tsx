// scrollWheelProps: wheel deltas as scroll events, page scroll prevented (Ctrl+wheel = zoom: ignored).
// Ported from @react-aria/interactions useScrollWheel (react-spectrum), Apache-2.0, © Adobe.
//
// Deviation: the original attaches a non-passive listener to a ref in an effect. Rivet returns the
// handler as `scrollWheelProps.onWheel`; delegated resumed listeners for `wheel` are passive (scroll
// performance), so on resumed pages preventDefault takes effect once the element's own listener is
// bound by a client render, or use `useScrollWheel(props, ref)` which also registers a non-passive
// client listener on `ref` (runtime boot at load).
import { clientEffect } from "@rivetjs/runtime/dom";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import { read, type MaybeAccessor } from "./utils.ts";

export interface ScrollEvent {
  deltaX: number;
  deltaY: number;
}

export interface ScrollWheelProps {
  onScroll?: (e: ScrollEvent) => void;
  /** Disable the listener (read at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
}

/** @internal wheel handler of scrollWheelProps. */
export function scrollWheel(props: ScrollWheelProps, e: WheelEvent): void {
  if (read(props.isDisabled)) return;
  // Ctrl + wheel is a zoom gesture.
  if (e.ctrlKey) return;
  // Stop scrolling the page.
  e.preventDefault();
  e.stopPropagation();
  props.onScroll?.({ deltaX: e.deltaX, deltaY: e.deltaY });
}

/**
 * Scroll wheel events for an element. With `ref`: a non-passive listener on the element (client
 * effect); without: spread `scrollWheelProps` (`onWheel`).
 */
export function scrollWheelProps(
  props: ScrollWheelProps,
  ref?: Ref<HTMLElement> | (() => HTMLElement | null | undefined),
): { scrollWheelProps: Record<string, unknown> } {
  if (ref) {
    // Resumed page: armed once the element scrolls into view (a wheel needs it visible; CEFF 2026-10-28, was idle).
    clientEffect(
      () => {
        const element = ref();
        if (!element) return;
        const listener = (e: WheelEvent) => scrollWheel(props, e);
        element.addEventListener("wheel", listener, { passive: false });
        return () => element.removeEventListener("wheel", listener);
      },
      { when: "visible" },
    );
    return { scrollWheelProps: {} };
  }
  return { scrollWheelProps: { onWheel: (e: WheelEvent) => scrollWheel(props, e) } };
}
