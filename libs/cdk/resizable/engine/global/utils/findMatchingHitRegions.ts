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
