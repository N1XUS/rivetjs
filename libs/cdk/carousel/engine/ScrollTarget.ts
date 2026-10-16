// Ported from embla-carousel (packages/embla-carousel/src/components/ScrollTarget.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { LimitType } from "../../motion/Limit.ts";
import type { Vector1DType } from "../../motion/Vector1d.ts";
import { arrayLast, mathAbs, mathSign } from "./utils.ts";

export type TargetType = {
  distance: number;
  index: number;
};

export type ScrollTargetType = {
  byIndex: (target: number, direction: number) => TargetType;
  byDistance: (force: number, snap: boolean) => TargetType;
  shortcut: (target: number, direction: number) => number;
};

export function ScrollTarget(loop: boolean, scrollSnaps: number[], contentSize: number, limit: LimitType, targetVector: Vector1DType): ScrollTargetType {
  const { reachedAny, removeOffset, constrain } = limit;

  function minDistance(distances: number[]): number {
    return distances.concat().sort((a, b) => mathAbs(a) - mathAbs(b))[0];
  }

  function findTargetSnap(target: number): TargetType {
    const distance = loop ? removeOffset(target) : constrain(target);
    const ascDiffsToSnaps = scrollSnaps
      .map((snap, index) => ({ diff: shortcut(snap - distance, 0), index }))
      .sort((d1, d2) => mathAbs(d1.diff) - mathAbs(d2.diff));

    const { index } = ascDiffsToSnaps[0];
    return { index, distance };
  }

  function shortcut(target: number, direction: number): number {
    const targets = [target, target + contentSize, target - contentSize];

    if (!loop) return target;
    if (!direction) return minDistance(targets);

    const matchingTargets = targets.filter((t) => mathSign(t) === direction);
    if (matchingTargets.length) return minDistance(matchingTargets);
    return arrayLast(targets) - contentSize;
  }

  function byIndex(index: number, direction: number): TargetType {
    const diffToSnap = scrollSnaps[index] - targetVector.get();
    const distance = shortcut(diffToSnap, direction);
    return { index, distance };
  }

  function byDistance(distance: number, snap: boolean): TargetType {
    const target = targetVector.get() + distance;
    const { index, distance: targetSnapDistance } = findTargetSnap(target);
    const reachedBound = !loop && reachedAny(target);

    if (!snap || reachedBound) return { index, distance };

    const diffToSnap = scrollSnaps[index] - targetSnapDistance;
    const snapDistance = distance + shortcut(diffToSnap, 0);

    return { index, distance: snapDistance };
  }

  const self: ScrollTargetType = {
    byDistance,
    byIndex,
    shortcut,
  };
  return self;
}
