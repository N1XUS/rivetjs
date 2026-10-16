// @rivetjs/motion/scroll (spec D14): scroll progress as signals and scroll-linked animations, on Motion's `scroll`.
// - `createScroll({ container?, target?, axis?, offset? })` → `{ x, y, xProgress, yProgress }` accessors (0 on the
//   server and until attached; `clientEffect` `when: "visible"` with a `target` / `container`, else `"idle"`).
// - `scrollAnimation(ref, keyframes, options?)`: a `motion/mini` animation driven by scroll (Motion attaches a native
//   `ScrollTimeline` when the browser has one: no per-frame JS).
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { scroll } from "motion";
import { animate } from "motion/mini";
import type { AnimationOptions, DOMKeyframesDefinition } from "motion";

type Edge = string | number;
/** Motion's scroll offsets (`["start end", "end start"]`, `[[0, 1], [1, 0]]`). */
export type ScrollOffset = readonly (Edge | readonly [Edge, Edge])[];
/** A `ref()` of any element type, or an accessor. */
type ElementRef = () => Element | null | undefined;

export interface ScrollOptions {
  /** Scroll container (default: the window). */
  container?: ElementRef;
  /** Track this element's progress through the container (with `offset`). */
  target?: ElementRef;
  /** Axis of the `progress` callback / scroll animation (default `"y"`). */
  axis?: "x" | "y";
  offset?: ScrollOffset;
}

const resolveOptions = (options: ScrollOptions) => ({
  container: options.container?.() ?? undefined,
  target: options.target?.() ?? undefined,
  axis: options.axis,
  offset: options.offset as never,
});

export interface ScrollValues {
  /** Scroll position in px. */
  x: () => number;
  y: () => number;
  /** Progress 0–1 (through the container, or through `target` with `offset`). */
  xProgress: () => number;
  yProgress: () => number;
}

/** Scroll position + progress as accessors. */
export function createScroll(options: ScrollOptions = {}): ScrollValues {
  const x = signal(0),
    y = signal(0),
    xProgress = signal(0),
    yProgress = signal(0);
  clientEffect(
    () =>
      scroll((_progress: number, info: { x: { current: number; progress: number }; y: { current: number; progress: number } }) => {
        x.set(info.x.current);
        y.set(info.y.current);
        xProgress.set(info.x.progress);
        yProgress.set(info.y.progress);
      }, resolveOptions(options)),
    { when: options.target || options.container ? "visible" : "idle" },
  );
  return { x: () => x(), y: () => y(), xProgress: () => xProgress(), yProgress: () => yProgress() };
}

/** Animate `target`'s `keyframes` over scroll progress (`ScrollTimeline` when supported). */
export function scrollAnimation(target: ElementRef, keyframes: DOMKeyframesDefinition, options: ScrollOptions & { transition?: AnimationOptions } = {}): void {
  clientEffect(
    () => {
      const el = target();
      if (!el) return;
      const animation = animate(el, keyframes as never, { ease: "linear", ...(options.transition as object) } as never);
      const stop = scroll(animation as never, resolveOptions(options));
      return () => {
        stop();
        (animation as unknown as { cancel?(): void }).cancel?.();
      };
    },
    { when: "visible" },
  );
}
