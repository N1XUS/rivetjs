// Ported from embla-carousel (packages/embla-carousel/src/components/ScrollBounds.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import { Limit, type LimitType } from "../../motion/Limit.ts";
import type { ScrollBodyType } from "../../motion/ScrollBody.ts";
import type { Vector1DType } from "../../motion/Vector1d.ts";
import { mathAbs } from "./utils.ts";
import type { PercentOfViewType } from "./PercentOfView.ts";

export type ScrollBoundsType = {
  shouldConstrain: () => boolean;
  constrain: (pointerDown: boolean) => void;
  toggleActive: (active: boolean) => void;
};

export function ScrollBounds(
  limit: LimitType,
  location: Vector1DType,
  target: Vector1DType,
  scrollBody: ScrollBodyType,
  percentOfView: PercentOfViewType,
): ScrollBoundsType {
  const pullBackThreshold = percentOfView.measure(10);
  const edgeOffsetTolerance = percentOfView.measure(50);
  const frictionLimit = Limit(0.1, 0.99);
  let disabled = false;

  function shouldConstrain(): boolean {
    if (disabled) return false;
    if (!limit.reachedAny(target.get())) return false;
    if (!limit.reachedAny(location.get())) return false;
    return true;
  }

  function constrain(pointerDown: boolean): void {
    if (!shouldConstrain()) return;
    const edge = limit.reachedMin(location.get()) ? "min" : "max";
    const diffToEdge = mathAbs(limit[edge] - location.get());
    const diffToTarget = target.get() - location.get();
    const friction = frictionLimit.constrain(diffToEdge / edgeOffsetTolerance);

    target.subtract(diffToTarget * friction);

    if (!pointerDown && mathAbs(diffToTarget) < pullBackThreshold) {
      target.set(limit.constrain(target.get()));
      scrollBody.useDuration(25).useBaseFriction();
    }
  }

  function toggleActive(active: boolean): void {
    disabled = !active;
  }

  const self: ScrollBoundsType = {
    shouldConstrain,
    constrain,
    toggleActive,
  };
  return self;
}
