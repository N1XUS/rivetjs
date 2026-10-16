// Ported from react-resizable-panels (lib/global/utils/findClosestHitRegion.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import type { Point } from "../../types.ts";
import type { HitRegion, Orientation } from "../types.ts";
import { getDistanceBetweenPointAndRect } from "./getDistanceBetweenPointAndRect.ts";

export function findClosestHitRegion(orientation: Orientation, hitRegions: HitRegion[], point: Point) {
  let closestHitRegion: HitRegion | undefined = undefined;
  let minDistance = {
    x: Infinity,
    y: Infinity,
  };

  for (const hitRegion of hitRegions) {
    const data = getDistanceBetweenPointAndRect(point, hitRegion.rect);
    switch (orientation) {
      case "horizontal": {
        // Ties along the primary axis are broken by the distance along the cross axis;
        // this matters for groups whose resize targets don't span the full cross axis (e.g. Grid)
        if (data.x < minDistance.x || (data.x === minDistance.x && data.y <= minDistance.y)) {
          closestHitRegion = hitRegion;
          minDistance = data;
        }
        break;
      }
      case "vertical": {
        if (data.y < minDistance.y || (data.y === minDistance.y && data.x <= minDistance.x)) {
          closestHitRegion = hitRegion;
          minDistance = data;
        }
        break;
      }
    }
  }

  return closestHitRegion
    ? {
        distance: minDistance,
        hitRegion: closestHitRegion,
      }
    : undefined;
}
