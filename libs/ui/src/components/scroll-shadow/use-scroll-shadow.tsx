// Ported from HeroUI v3.2.6 packages/react/src/components/scroll-shadow/use-scroll-shadow.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `.tsx` (no JSX): `.ts` modules are not server-rewritten, and this one calls `clientEffect`.
// - `containerRef: RefObject` → an element accessor (`ref()` from `@rivetjs/runtime/dom`); the other options are read lazily
//   (pass getters for live values): the `clientEffect` reads `containerRef` / `isEnabled` / `visibility` / `orientation` / `offset`
//   (upstream effect + `checkOverflow` deps) and tears the listeners down and sets them up again on any change, as upstream.
// - `onVisibilityChangeRef` (latest callback without re-subscribing) → `props.onVisibilityChange` read untracked when notifying.
// - `useRef` caches → effect-local variables (reset by the cleanup, as upstream).
// - Visibility effects release their fade attributes on cleanup (disable, axis/mode change, disposal).
// - `ResizeObserver` → cdk `useResizeObserver` (react-aria; window `resize` where unsupported). The subtree `MutationObserver`
//   keeps upstream's options (cdk `ContentObserver` watches no attributes, upstream also watches `class` / `style`).
import { untrack } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { useResizeObserver } from "@rivetjs/cdk/observers";

import type { ScrollShadowVisibility } from "./scroll-shadow.tsx";

export interface UseScrollShadowProps {
  containerRef: () => HTMLElement | null | undefined;
  orientation: "vertical" | "horizontal";
  offset: number;
  visibility: ScrollShadowVisibility;
  isEnabled: boolean;
  onVisibilityChange?: (visibility: ScrollShadowVisibility) => void;
}

/** Release the attributes owned by an automatic or controlled visibility effect. */
export function clearScrollAttributes(el: HTMLElement): void {
  delete el.dataset["topScroll"];
  delete el.dataset["bottomScroll"];
  delete el.dataset["topBottomScroll"];
  delete el.dataset["leftScroll"];
  delete el.dataset["rightScroll"];
  delete el.dataset["leftRightScroll"];
}

export function useScrollShadow(props: UseScrollShadowProps): void {
  clientEffect(() => {
    const el = props.containerRef();
    const isEnabled = props.isEnabled;
    const visibility = props.visibility;
    const isVertical = props.orientation === "vertical";
    const offset = props.offset;

    if (!el || !isEnabled || visibility !== "auto") return;

    // Cache previous state to avoid unnecessary DOM updates
    let prevState: { hasScrollBefore: boolean; hasScrollAfter: boolean } | null = null;
    // Track pending RAF to avoid multiple scheduled updates
    let rafId: number | null = null;

    const checkOverflow = () => {
      const scrollStart = isVertical ? el.scrollTop : Math.abs(el.scrollLeft);
      const scrollSize = isVertical ? el.scrollHeight : el.scrollWidth;
      const clientSize = isVertical ? el.clientHeight : el.clientWidth;

      const hasScrollBefore = scrollStart > offset;
      const hasScrollAfter = scrollStart + clientSize + offset < scrollSize - 1;

      // Skip DOM updates if state hasn't changed
      if (prevState && prevState.hasScrollBefore === hasScrollBefore && prevState.hasScrollAfter === hasScrollAfter) {
        return;
      }

      // Update state cache
      prevState = { hasScrollBefore, hasScrollAfter };

      // Cancel previous pending update
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Batch DOM updates with RAF for better performance
      rafId = requestAnimationFrame(() => {
        rafId = null;

        const notify = untrack(() => props.onVisibilityChange);

        if (isVertical) {
          if (hasScrollBefore && hasScrollAfter) {
            el.dataset["topBottomScroll"] = "true";
            delete el.dataset["topScroll"];
            delete el.dataset["bottomScroll"];

            notify?.("both");
          } else {
            el.dataset["topScroll"] = String(hasScrollBefore);
            el.dataset["bottomScroll"] = String(hasScrollAfter);
            delete el.dataset["topBottomScroll"];

            if (notify) {
              if (hasScrollBefore) {
                notify("top");
              } else if (hasScrollAfter) {
                notify("bottom");
              } else {
                notify("none");
              }
            }
          }
        } else {
          if (hasScrollBefore && hasScrollAfter) {
            el.dataset["leftRightScroll"] = "true";
            delete el.dataset["leftScroll"];
            delete el.dataset["rightScroll"];

            notify?.("both");
          } else {
            el.dataset["leftScroll"] = String(hasScrollBefore);
            el.dataset["rightScroll"] = String(hasScrollAfter);
            delete el.dataset["leftRightScroll"];

            if (notify) {
              if (hasScrollBefore) {
                notify("left");
              } else if (hasScrollAfter) {
                notify("right");
              } else {
                notify("none");
              }
            }
          }
        }
      });
    };

    // Initial check
    checkOverflow();

    // Use passive listener for better scroll performance
    el.addEventListener("scroll", checkOverflow, { passive: true });

    // Monitor size changes
    const stopResize = useResizeObserver({ ref: el, onResize: checkOverflow });

    // The observer above only reports the container's own box, so content growing
    // or shrinking inside a fixed-size container fires neither resize nor scroll
    // and would leave the shadows stale. Watch the subtree for the DOM and style
    // changes that cause it.
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(checkOverflow);

    mutationObserver?.observe(el, {
      attributeFilter: ["class", "style"],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      el.removeEventListener("scroll", checkOverflow);
      stopResize();
      mutationObserver?.disconnect();

      // Cancel pending RAF and cleanup cache
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      prevState = null;
      clearScrollAttributes(el);
    };
  });
}
