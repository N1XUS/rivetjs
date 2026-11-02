// Ported from react-resizable-panels (lib/global/utils/findMatchingHitRegions.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { calculateHitRegions } from "../dom/calculateHitRegions.ts";
import type { MountedAxes } from "../mutable-state/axes.ts";
import type { HitRegion } from "../types.ts";
import { findClosestHitRegion } from "./findClosestHitRegion.ts";
import { isViableHitTarget } from "./isViableHitTarget.ts";

export function findMatchingHitRegions(
  event: {
    clientX: number;
    clientY: number;
    target: EventTarget | null;
  },
  mountedAxes: MountedAxes,
): HitRegion[] {
  const matchingHitRegions: HitRegion[] = [];

  mountedAxes.forEach((_, axisData) => {
    if (axisData.disabled) {
      return;
    }

    // Rivet: hover runs on every document pointermove for every mounted group. A pointer farther than the largest
    // hit-target expansion from the group's box cannot be in one of its regions: one rect read instead of every
    // panel / separator rect + sort.
    const box = axisData.element.getBoundingClientRect();
    const margin = Math.max(axisData.resizeTargetMinimumSize.coarse, axisData.resizeTargetMinimumSize.fine);
    if (event.clientX < box.left - margin || event.clientX > box.right + margin || event.clientY < box.top - margin || event.clientY > box.bottom + margin) {
      return;
    }

    const hitRegions = calculateHitRegions({ axis: axisData });
    const match = findClosestHitRegion(axisData.orientation, hitRegions, {
      x: event.clientX,
      y: event.clientY,
    });
    if (
      match &&
      match.distance.x <= 0 &&
      match.distance.y <= 0 &&
      isViableHitTarget({
        axisElement: axisData.element,
        hitRegion: match.hitRegion.rect,
        pointerEventTarget: event.target,
      })
    ) {
      matchingHitRegions.push(match.hitRegion);
    }
  });

  return matchingHitRegions;
}
