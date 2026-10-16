// Composition of embla-carousel's motion parts (packages/embla-carousel/src/components/Engine.ts `update` / `render`
// + Animations.ts + ScrollBody.ts + Vector1d.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: one animated 1-D value wired exactly like embla's engine loop, without a carousel: per fixed step
// `scrollBody.seek()`; per frame `offset = location * alpha + previous * (1 - alpha)` → `render(offset)`; the loop
// stops (and `onSettle` runs) once `settled()` and not `held` (embla: `!dragHandler.pointerDown()`). Numbers in,
// numbers out — the caller applies the transform.
import { AnimationLoop, type AnimationLoopType, type FrameSchedulerType } from "./Animations.ts";
import { ScrollBody, type ScrollBodyType } from "./ScrollBody.ts";
import { Vector1D, type Vector1DType } from "./Vector1d.ts";

export type Motion1DOptionsType = {
  /** Start value (location = target = rendered value). */
  value: number;
  /** Base duration (embla `duration`, fixed steps; 0 = instant). @default 25 */
  duration?: number;
  /** Base friction (embla engine constant). @default 0.68 */
  friction?: number;
  /** Called every frame with the interpolated value. */
  render: (value: number) => void;
  /** Called on the frame the value settles (embla `settle` event). */
  onSettle?: () => void;
  /** Frame scheduler (default: `globalThis.requestAnimationFrame` / `cancelAnimationFrame`). */
  scheduler?: FrameSchedulerType;
};

export type Motion1DType = {
  location: Vector1DType;
  previousLocation: Vector1DType;
  offsetLocation: Vector1DType;
  target: Vector1DType;
  scrollBody: ScrollBodyType;
  animation: AnimationLoopType;
  /** Animate to `value` with the base duration / friction (embla `scrollTo`), or `jump` there (duration 0). */
  to: (value: number, jump?: boolean) => void;
  /** Move the target by `delta` while held (embla drag: `useFriction(0.3).useDuration(0.75)`, `target.add`). */
  drag: (delta: number) => void;
  /** Hold the value (pointer down): the loop keeps running while held, even when settled. */
  hold: (held: boolean) => void;
  /** Whether the rendered value reached the target. */
  settled: () => boolean;
  /** Current rendered value. */
  get: () => number;
  /** Stop the loop. */
  stop: () => void;
};

export function Motion1D(options: Motion1DOptionsType): Motion1DType {
  const { value, duration = 25, friction = 0.68, render, onSettle, scheduler } = options;
  const location = Vector1D(value);
  const previousLocation = Vector1D(value);
  const offsetLocation = Vector1D(value);
  const target = Vector1D(value);
  const scrollBody = ScrollBody(location, offsetLocation, previousLocation, target, duration, friction);
  let held = false;

  const animation = AnimationLoop(
    () => {
      scrollBody.seek();
    },
    (alpha) => {
      const hasSettled = scrollBody.settled();
      const hasSettledAndIdle = hasSettled && !held;
      if (hasSettledAndIdle) animation.stop();
      offsetLocation.set(location.get() * alpha + previousLocation.get() * (1 - alpha));
      render(offsetLocation.get());
      if (hasSettledAndIdle) onSettle?.();
    },
    scheduler,
  );

  function to(next: number, jump?: boolean): void {
    scrollBody.useBaseFriction().useDuration(jump === true ? 0 : duration);
    const distance = next - target.get();
    target.add(distance);
    if (!distance) return;
    if (scrollBody.duration()) {
      animation.start();
    } else {
      animation.update();
      animation.render(1);
      animation.update();
    }
  }

  function drag(delta: number): void {
    scrollBody.useFriction(0.3).useDuration(0.75);
    animation.start();
    target.add(delta);
  }

  function hold(next: boolean): void {
    held = next;
    if (next) {
      scrollBody.useFriction(0).useDuration(0);
      target.set(location);
    }
  }

  const self: Motion1DType = {
    location,
    previousLocation,
    offsetLocation,
    target,
    scrollBody,
    animation,
    to,
    drag,
    hold,
    settled: () => scrollBody.settled(),
    get: () => offsetLocation.get(),
    stop: () => animation.stop(),
  };
  return self;
}
