// Ported from embla-carousel (packages/embla-carousel/src/components/Animations.ts, v8.6.0), MIT, © David Jerleke.
// Rivet:
// - DOM-agnostic split for `@rivetjs/cdk/motion`: `AnimationLoop(update, render, scheduler?)` is the fixed-timestep
//   loop of upstream `Animations` (1000/60 ms steps, `update()` per step, two `update()`s on the first frame,
//   `render(alpha)` with the leftover fraction for interpolation). The frame scheduler is injectable
//   (`{ requestAnimationFrame, cancelAnimationFrame }`, default `globalThis`'s), so tests and non-DOM hosts drive it.
// - Upstream `Animations(ownerDocument, ownerWindow, update, render)` (with its `visibilitychange` reset) lives
//   on in `carousel/engine/Animations.ts` over this loop; `reset()` is upstream's private `reset` made public for it.
export type FrameSchedulerType = {
  requestAnimationFrame: (callback: (timeStamp: number) => void) => number;
  cancelAnimationFrame: (handle: number) => void;
};

export type AnimationLoopType = {
  start: () => void;
  stop: () => void;
  reset: () => void;
  update: () => void;
  render: (alpha: number) => void;
};

/**
 * Fixed-timestep animation loop: `update()` advances the simulation by one 1000/60 ms step as many times as the
 * elapsed frame time allows; `render(alpha)` then draws, `alpha` (0–1) being the fraction of a step left over
 * (interpolate `location * alpha + previousLocation * (1 - alpha)`). `stop()` from inside `render` ends the loop.
 */
export function AnimationLoop(update: () => void, render: (alpha: number) => void, scheduler?: FrameSchedulerType): AnimationLoopType {
  const frames: FrameSchedulerType = scheduler || (globalThis as unknown as FrameSchedulerType);
  const fixedTimeStep = 1000 / 60;

  let lastTimeStamp: number | null = null;
  let accumulatedTime = 0;
  let animationId = 0;

  function animate(timeStamp: number): void {
    if (!animationId) return;
    if (!lastTimeStamp) {
      lastTimeStamp = timeStamp;
      update();
      update();
    }

    const timeElapsed = timeStamp - lastTimeStamp;
    lastTimeStamp = timeStamp;
    accumulatedTime += timeElapsed;

    while (accumulatedTime >= fixedTimeStep) {
      update();
      accumulatedTime -= fixedTimeStep;
    }

    const alpha = accumulatedTime / fixedTimeStep;
    render(alpha);

    if (animationId) {
      animationId = frames.requestAnimationFrame(animate);
    }
  }

  function start(): void {
    if (animationId) return;
    animationId = frames.requestAnimationFrame(animate);
  }

  function stop(): void {
    frames.cancelAnimationFrame(animationId);
    lastTimeStamp = null;
    accumulatedTime = 0;
    animationId = 0;
  }

  function reset(): void {
    lastTimeStamp = null;
    accumulatedTime = 0;
  }

  const self: AnimationLoopType = {
    start,
    stop,
    reset,
    update,
    render,
  };
  return self;
}
