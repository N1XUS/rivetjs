---
title: Motion
description: "@rivetjs/cdk/motion is embla-carousel's motion core, DOM-agnostic: fixed-step loop with interpolation, scroll body integrator, drag velocity tracker."
template: guide
status: experimental
related: [components/carousel, components/slider, foundations/interactions]
---

`@rivetjs/cdk/motion` is the motion of [embla-carousel](https://www.embla-carousel.com/) 8.6.0, taken out of the carousel so other components can move the same way. It works on numbers only: you pass positions and time stamps in, you get positions out, and your code applies the transform. The [Carousel](../components/carousel.md) runs on it, and the [Slider](../components/slider.md) animates its snap to a step with `Motion1D`. Apps that do not import it pay nothing.

::example{id=motion-basic}

## Import

```ts
import { AnimationLoop, ScrollBody, Vector1D, VelocityTracker, DragRelease, Motion1D, Limit } from "@rivetjs/cdk/motion";
```

## How embla moves

- **Fixed-step loop.** `AnimationLoop` runs `update()` once per 1000/60 ms of elapsed frame time, so the physics do not depend on the display rate. Then it calls `render(alpha)` with the leftover fraction of a step. Rendering `location * alpha + previousLocation * (1 - alpha)` keeps 120 Hz screens smooth.
- **Scroll body.** Each step, `ScrollBody.seek()` adds `displacement / duration` to the velocity, multiplies it by the friction, and moves the location. The result is embla's ease-out. `duration` 0 jumps. It has settled when the rendered value is within 0.001 of the target.
- **Drag and release.** While the pointer is down, the target follows the pointer (friction 0.3, duration 0.75). `VelocityTracker` measures the flick force (px/ms over the last 170 ms). On release, `DragRelease` boosts the force (snap: 300 mouse / 400 touch; free: 500 / 600). The caller snaps the target, and `settle()` picks the duration and friction: a throw cut short settles faster.

## API

| Export                                         | Signature                                                                                                                         |                                                                                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AnimationLoop`                                | `(update: () => void, render: (alpha: number) => void, scheduler?: FrameSchedulerType) => { start, stop, reset, update, render }` | Fixed-timestep loop (60 Hz steps, two updates on the first frame). `stop()` inside `render` ends it. `scheduler` defaults to `requestAnimationFrame` / `cancelAnimationFrame`. |
| `ScrollBody`                                   | `(location, offsetLocation, previousLocation, target, baseDuration, baseFriction) => ScrollBodyType`                              | Integrator: `seek()`, `settled()`, `velocity()`, `direction()`, `duration()`, `useDuration(n)`, `useFriction(n)`, `useBaseDuration()`, `useBaseFriction()`.                    |
| `Vector1D`                                     | `(initial: number) => { get, set, add, subtract }`                                                                                | Mutable 1-D value (`set` / `add` accept a number or another vector).                                                                                                           |
| `Limit`                                        | `(min, max) => { constrain, reachedMin, reachedMax, reachedAny, removeOffset, length, min, max }`                                 | Range helper (embla `Limit`).                                                                                                                                                  |
| `VelocityTracker`                              | `() => { pointerDown(point, time), pointerMove(point, time), pointerUp(time) }`                                                   | `pointerMove` returns the diff since the last move; `pointerUp` returns the flick force in px/ms (0: no flick).                                                                |
| `DragRelease`                                  | `(dragFree: boolean, baseFriction: number) => { forceBoost(isMouse), settle(rawForce, force) }`                                   | Release physics; `settle` returns `{ duration, friction }` for the scroll body. Constants `snapForceBoost`, `freeForceBoost`.                                                  |
| `Motion1D`                                     | `({ value, duration = 25, friction = 0.68, render, onSettle?, scheduler? }) => Motion1DType`                                      | One animated value, wired like embla's engine. See below.                                                                                                                      |
| `mathAbs`, `mathSign`, `deltaAbs`, `factorAbs` | `(…numbers) => number`                                                                                                            | embla's math helpers.                                                                                                                                                          |

### Motion1D

| Member                                                                                |                                                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `to(value, jump?)`                                                                    | Animate to `value` with the base duration and friction (embla `scrollTo`); `jump` moves at once. |
| `hold(held)`                                                                          | Pointer down / up: while held the target stays where the value is and the loop keeps running.    |
| `drag(delta)`                                                                         | Move the target by `delta` while held (embla's drag settings).                                   |
| `settled()`, `get()`                                                                  | Reached the target? The current rendered value.                                                  |
| `stop()`                                                                              | Stop the loop.                                                                                   |
| `location`, `previousLocation`, `offsetLocation`, `target`, `scrollBody`, `animation` | The parts, to tune `scrollBody.useDuration(…)` after a release and similar.                      |

`render(value)` runs every frame with the interpolated value. `onSettle()` runs once on the frame the value settles while not held.

A release with a flick, the way the carousel does it:

```ts
import { DragRelease, Motion1D, VelocityTracker } from "@rivetjs/cdk/motion";

const motion = Motion1D({ value: 0, render: (x) => (sheet.style.transform = `translateY(${x}px)`) });
const tracker = VelocityTracker();
const release = DragRelease(false, 0.68);

function down(y: number, time: number) {
  tracker.pointerDown(y, time);
  motion.hold(true);
}
function move(y: number, time: number) {
  motion.drag(tracker.pointerMove(y, time));
}
function up(time: number, isMouse: boolean) {
  const rawForce = tracker.pointerUp(time) * release.forceBoost(isMouse);
  const next = rawForce > 0 ? 400 : 0; // snap: open or closed
  const { duration, friction } = release.settle(rawForce, next - motion.target.get());
  motion.hold(false);
  motion.scrollBody.useDuration(duration).useFriction(friction);
  motion.target.set(next);
  motion.animation.start();
}
```

## Notes

- This module is the cdk's physics: gestures, drag, flicks, scroll snap and wheel (carousel, sheet, sliders, drag and drop). Declarative animations (entrances, exits, gestures as states, layout, scroll values) are `@rivetjs/motion`, Motion (motion.dev) on Rivet signals; both meet in [FLIP](./flip.md), where Masonry's relayout takes this spring by default or Motion's WAAPI driver.

- The module touches no DOM. `AnimationLoop` only needs the frame scheduler: pass one in tests or on the server.
- `prefers-reduced-motion` is not built in, as in embla: pass `duration: 0` or call `to(value, true)` to jump.
- The carousel engine's `Animations` adds embla's `visibilitychange` reset on top of `AnimationLoop`.
