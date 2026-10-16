// Ported from embla-carousel (packages/embla-carousel/src/components/ScrollProgress.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { LimitType } from "../../motion/Limit.ts";

export type ScrollProgressType = {
  get: (n: number) => number;
};

export function ScrollProgress(limit: LimitType): ScrollProgressType {
  const { max, length } = limit;

  function get(n: number): number {
    const currentLocation = n - max;
    return length ? currentLocation / -length : 0;
  }

  const self: ScrollProgressType = {
    get,
  };
  return self;
}
