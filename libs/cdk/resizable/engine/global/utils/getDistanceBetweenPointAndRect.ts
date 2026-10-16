// Ported from react-resizable-panels (lib/global/utils/getDistanceBetweenPointAndRect.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import type { Point } from "../../types.ts";

export function getDistanceBetweenPointAndRect(point: Point, rect: DOMRectReadOnly) {
  return {
    x: point.x >= rect.left && point.x <= rect.right ? 0 : Math.min(Math.abs(point.x - rect.left), Math.abs(point.x - rect.right)),
    y: point.y >= rect.top && point.y <= rect.bottom ? 0 : Math.min(Math.abs(point.y - rect.top), Math.abs(point.y - rect.bottom)),
  };
}
