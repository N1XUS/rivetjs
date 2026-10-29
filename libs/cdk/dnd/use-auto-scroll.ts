// Ported from react-spectrum (packages/react-aria/src/dnd/useAutoScroll.ts), Apache-2.0, © Adobe.
// Rivet: the scrollable element is resolved on the first `move` (react-aria: an effect after mount); the frame is
// cancelled by the owner's cleanup.
import { getOwner, onCleanup } from "@rivetjs/reactivity";
import { isIOS, isWebKit } from "../platform/index.ts";
import { getScrollParent, isScrollable } from "../utils/dom.ts";
import type { ElementRef } from "./types.ts";

const AUTOSCROLL_AREA_SIZE = 20;

export interface AutoScrollAria {
  move(x: number, y: number): void;
  stop(): void;
}

export function useAutoScroll(ref: ElementRef<Element>): AutoScrollAria {
  let scrollable: Element | null = null;
  let scrollableX = true;
  let scrollableY = true;
  const resolve = () => {
    if (scrollable || !ref.current) return;
    scrollable = isScrollable(ref.current) ? ref.current : getScrollParent(ref.current);
    const style = window.getComputedStyle(scrollable);
    scrollableX = /(auto|scroll)/.test(style.overflowX);
    scrollableY = /(auto|scroll)/.test(style.overflowY);
  };
  const state: { timer: ReturnType<typeof requestAnimationFrame> | undefined; dx: number; dy: number } = { timer: undefined, dx: 0, dy: 0 };
  if (typeof document !== "undefined" && getOwner())
    onCleanup(() => {
      if (state.timer) {
        cancelAnimationFrame(state.timer);
        state.timer = undefined;
      }
    });
  const scroll = () => {
    if (scrollableX && scrollable) scrollable.scrollLeft += state.dx;
    if (scrollableY && scrollable) scrollable.scrollTop += state.dy;
    if (state.timer) state.timer = requestAnimationFrame(scroll);
  };
  return {
    move(x, y) {
      // Most browsers auto scroll natively, but WebKit on macOS does not (iOS does).
      // https://bugs.webkit.org/show_bug.cgi?id=222636
      if (!isWebKit() || isIOS()) return;
      resolve();
      if (!scrollable) return;
      const box = scrollable.getBoundingClientRect();
      const left = AUTOSCROLL_AREA_SIZE;
      const top = AUTOSCROLL_AREA_SIZE;
      const bottom = box.height - AUTOSCROLL_AREA_SIZE;
      const right = box.width - AUTOSCROLL_AREA_SIZE;
      if (x < left || x > right || y < top || y > bottom) {
        if (x < left) state.dx = x - left;
        else if (x > right) state.dx = x - right;
        if (y < top) state.dy = y - top;
        else if (y > bottom) state.dy = y - bottom;
        if (!state.timer) state.timer = requestAnimationFrame(scroll);
      } else this.stop();
    },
    stop() {
      if (state.timer) {
        cancelAnimationFrame(state.timer);
        state.timer = undefined;
      }
    },
  };
}
