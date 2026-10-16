// Ported from embla-carousel (packages/embla-carousel/src/components/Limit.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: verbatim (TypeScript module specifiers, formatting); part of the DOM-agnostic `@rivetjs/cdk/motion` core.
import { mathAbs } from "./utils.ts";

export type LimitType = {
  min: number;
  max: number;
  length: number;
  constrain: (n: number) => number;
  reachedAny: (n: number) => boolean;
  reachedMax: (n: number) => boolean;
  reachedMin: (n: number) => boolean;
  removeOffset: (n: number) => number;
};

/** A closed range `[min, max]`: clamp (`constrain`), bound checks, and `removeOffset` (wrap into the range, for loops). */
export function Limit(min: number = 0, max: number = 0): LimitType {
  const length = mathAbs(min - max);

  function reachedMin(n: number): boolean {
    return n < min;
  }

  function reachedMax(n: number): boolean {
    return n > max;
  }

  function reachedAny(n: number): boolean {
    return reachedMin(n) || reachedMax(n);
  }

  function constrain(n: number): number {
    if (!reachedAny(n)) return n;
    return reachedMin(n) ? min : max;
  }

  function removeOffset(n: number): number {
    if (!length) return n;
    return n - length * Math.ceil((n - max) / length);
  }

  const self: LimitType = {
    length,
    max,
    min,
    constrain,
    reachedAny,
    reachedMax,
    reachedMin,
    removeOffset,
  };
  return self;
}
