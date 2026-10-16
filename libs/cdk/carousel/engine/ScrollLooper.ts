// Ported from embla-carousel (packages/embla-carousel/src/components/ScrollLooper.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import { Limit, type LimitType } from "../../motion/Limit.ts";
import type { Vector1DType } from "../../motion/Vector1d.ts";

export type ScrollLooperType = {
  loop: (direction: number) => void;
};

export function ScrollLooper(contentSize: number, limit: LimitType, location: Vector1DType, vectors: Vector1DType[]): ScrollLooperType {
  const jointSafety = 0.1;
  const min = limit.min + jointSafety;
  const max = limit.max + jointSafety;
  const { reachedMin, reachedMax } = Limit(min, max);

  function shouldLoop(direction: number): boolean {
    if (direction === 1) return reachedMax(location.get());
    if (direction === -1) return reachedMin(location.get());
    return false;
  }

  function loop(direction: number): void {
    if (!shouldLoop(direction)) return;

    const loopDistance = contentSize * (direction * -1);
    vectors.forEach((v) => v.add(loopDistance));
  }

  const self: ScrollLooperType = {
    loop,
  };
  return self;
}
