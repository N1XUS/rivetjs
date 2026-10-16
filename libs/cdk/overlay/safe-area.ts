// Ported from @react-aria/tooltip (useSafeArea.ts; react-aria/src/tooltip/useSafeArea.ts), Apache-2.0, © Adobe.
// Tracks whether the pointer is within a "safe area" connecting a trigger and its overlay, so the
// overlay can stay open while the pointer moves between them (hover-opened overlays: PreviewTrigger).
// The safe area is the union of the trigger rect, the overlay rect, and the convex hull connecting the
// two (a polygon), which works for any placement of the overlay relative to the trigger, diagonal
// moves and any gap (offset / arrow) between them.
// Rivet:
// - `useSafeArea(options)` (an effect while `isOpen`) → `safeArea(options)`: call when the overlay
//   opens (browser only), it returns the release (call on close). `isOpen` is implied.
// - refs are `ElementSource`s; `isPointInSafeArea` is exported for tests.
import { getOwnerDocument, getOwnerWindow } from "../utils/dom.ts";
import type { ElementSource } from "./position.ts";

interface Point {
  x: number;
  y: number;
}

export interface SafeAreaOptions {
  /** Ref for the trigger element. */
  triggerRef: ElementSource;
  /** Ref for the overlay element. */
  overlayRef: ElementSource;
  /** Whether this feature is disabled. */
  isDisabled?: boolean;
  /**
   * Called on pointer move (and when the pointer leaves the document) with whether the pointer is
   * currently within the "safe area" — the trigger, the overlay, or the region between them. This
   * lets an overlay stay open while the pointer travels from the trigger to the overlay, even
   * diagonally and regardless of placement.
   */
  onSafeAreaChange: (isInSafeArea: boolean) => void;
}

// A small amount of padding (in pixels) added around the trigger and overlay so the safe area is
// slightly forgiving of sub-pixel jitter and the gap between the elements.
const PADDING = 8;

const read = (source: ElementSource | undefined): Element | null => (typeof source === "function" ? source() : source) ?? null;

/**
 * Tracks whether the pointer is within a "safe area" connecting a trigger and its overlay, so the
 * overlay can stay open while the pointer moves between them. Call while open; returns the release.
 */
export function safeArea(options: SafeAreaOptions): () => void {
  const { triggerRef, overlayRef, isDisabled } = options;
  const trigger = read(triggerRef);
  if (isDisabled || !trigger) return () => {};

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const point = { x: e.clientX, y: e.clientY };
    const triggerRect = trigger.getBoundingClientRect();
    const overlayRect = read(overlayRef)?.getBoundingClientRect();
    options.onSafeAreaChange(isPointInSafeArea(point, triggerRect, overlayRect));
  };

  // If the pointer leaves the document entirely, it is no longer in the safe area.
  const onPointerLeave = () => options.onSafeAreaChange(false);

  const win = getOwnerWindow(trigger);
  const doc = getOwnerDocument(trigger);
  win.addEventListener("pointermove", onPointerMove);
  doc.documentElement.addEventListener("pointerleave", onPointerLeave);
  return () => {
    win.removeEventListener("pointermove", onPointerMove);
    doc.documentElement.removeEventListener("pointerleave", onPointerLeave);
  };
}

/** Whether `point` is in the trigger rect, the overlay rect or the convex hull of both (padded). */
export function isPointInSafeArea(point: Point, triggerRect: DOMRect, overlayRect?: DOMRect): boolean {
  if (rectContains(triggerRect, point)) return true;
  if (!overlayRect) return false;
  if (rectContains(overlayRect, point)) return true;
  // Otherwise, check whether the point is within the convex hull connecting the two rects.
  const hull = convexHull([...rectCorners(triggerRect), ...rectCorners(overlayRect)]);
  return hull.length >= 3 && isPointInPolygon(point, hull);
}

function rectContains(rect: DOMRect, point: Point): boolean {
  return point.x >= rect.left - PADDING && point.x <= rect.right + PADDING && point.y >= rect.top - PADDING && point.y <= rect.bottom + PADDING;
}

function rectCorners(rect: DOMRect): Point[] {
  const left = rect.left - PADDING;
  const right = rect.right + PADDING;
  const top = rect.top - PADDING;
  const bottom = rect.bottom + PADDING;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

// Computes the convex hull of a set of points using the monotone chain algorithm.
function convexHull(points: Point[]): Point[] {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;

  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Ray casting point-in-polygon test.
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x;
    const yi = polygon[i]!.y;
    const xj = polygon[j]!.x;
    const yj = polygon[j]!.y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
