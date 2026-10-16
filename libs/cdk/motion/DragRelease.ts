// Ported from embla-carousel (packages/embla-carousel/src/components/DragHandler.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: the release physics of upstream `DragHandler` (`snapForceBoost` / `freeForceBoost`, `forceBoost()`, the
// `up()` speed + friction formula) extracted for `@rivetjs/cdk/motion`, numbers only; the carousel engine's
// `DragHandler.ts` uses it, so the carousel keeps upstream behaviour exactly.
import { factorAbs } from "./utils.ts";

export type DragReleaseType = {
  /** Multiplier for the tracker's px/ms flick force (`VelocityTracker.pointerUp`) → px of throw. */
  forceBoost: (isMouse: boolean) => number;
  /**
   * Scroll body settings after a release: `rawForce` = boosted flick force, `force` = the distance actually
   * allowed (snapped / clamped by the caller). The further the allowed distance falls short of the raw throw, the
   * shorter the duration and the higher the friction.
   */
  settle: (rawForce: number, force: number) => { duration: number; friction: number };
};

export const snapForceBoost = { mouse: 300, touch: 400 };
export const freeForceBoost = { mouse: 500, touch: 600 };

export function DragRelease(dragFree: boolean, baseFriction: number): DragReleaseType {
  const baseSpeed = dragFree ? 43 : 25;

  function forceBoost(isMouse: boolean): number {
    const boost = dragFree ? freeForceBoost : snapForceBoost;
    const type = isMouse ? "mouse" : "touch";
    return boost[type];
  }

  function settle(rawForce: number, force: number): { duration: number; friction: number } {
    const forceFactor = factorAbs(rawForce, force);
    const speed = baseSpeed - 10 * forceFactor;
    const friction = baseFriction + forceFactor / 50;
    return { duration: speed, friction };
  }

  const self: DragReleaseType = {
    forceBoost,
    settle,
  };
  return self;
}
