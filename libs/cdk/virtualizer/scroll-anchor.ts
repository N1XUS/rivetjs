// Ported from React Spectrum (react-stately/src/virtualizer/ScrollAnchor.ts), Apache-2.0, © Adobe.
import type { Key } from "../collections/index.ts";
import type { LayoutInfo } from "./layout-info.ts";
import { Rect, type RectCorner } from "./rect.ts";
import type { Size } from "./size.ts";

export type ScrollAnchorAxis = "x" | "y";
export type ScrollAnchorEdge = "start" | "end";
export interface ScrollAnchor {
  key: Key;
  corner: RectCorner;
  offset: number;
}

export interface ScrollAnchorInfo {
  /** Which edge of the content the viewport should stay anchored to. */
  edge: "start" | "end";
  /** Which axis `edge` refers to — 'y' for vertical lists, 'x' for horizontal. */
  axis: "x" | "y";
  /** Distance (px) from `edge` within which the viewport is considered "following" it. */
  threshold: number;
  /** Excludes structural/ephemeral layout infos (e.g. loaders) from being the anchor. Default: any. */
  isAnchorable?: (layoutInfo: LayoutInfo) => boolean;
}

/** Minimum overlap (along the scroll axis) an item needs with the viewport to be eligible as a scroll anchor. */
const MIN_ANCHOR_OVERLAP = 4;

const dimensionForAxis = (axis: ScrollAnchorAxis): "width" | "height" => (axis === "x" ? "width" : "height");

/** Viewport coordinate (along `axis`) that keeps a previously captured anchor at the same offset from the viewport start. */
export function computeScrollAnchorTarget(
  anchor: ScrollAnchor,
  axis: ScrollAnchorAxis,
  getLayoutInfo: (key: Key) => LayoutInfo | null,
  visibleRect: Rect,
  contentSize: Size,
): number | null {
  const finalInfo = getLayoutInfo(anchor.key);
  if (!finalInfo) return null;
  const adjustment = finalInfo.rect[anchor.corner][axis] - visibleRect[axis] - anchor.offset;
  if (adjustment === 0) return null;
  const target = visibleRect[axis] + adjustment;
  const dimension = dimensionForAxis(axis);
  const max = Math.max(0, contentSize[dimension] - visibleRect[dimension]);
  const clamped = Math.max(0, Math.min(max, target));
  return clamped !== visibleRect[axis] ? clamped : null;
}

/**
 * Picks the item to anchor scroll to: nearest the top of the viewport when anchoring to 'end', nearest the
 * bottom when anchoring to 'start'. `isAnchorable` excludes items (like loaders).
 */
export function captureScrollAnchor(
  edge: ScrollAnchorEdge,
  axis: ScrollAnchorAxis,
  visibleRect: Rect,
  visibleLayoutInfos: Iterable<[Key, LayoutInfo]>,
  isAnchorable: (layoutInfo: LayoutInfo) => boolean = () => true,
): ScrollAnchor | null {
  const dimension = dimensionForAxis(axis);
  let best: ScrollAnchor | null = null;
  for (const [key, layoutInfo] of visibleLayoutInfos) {
    if (!layoutInfo || !isAnchorable(layoutInfo)) continue;
    const overlap = layoutInfo.rect.intersection(visibleRect)[dimension];
    if (layoutInfo.rect.area > 0 && overlap >= MIN_ANCHOR_OVERLAP) {
      const corner = layoutInfo.rect.getCornerInRect(visibleRect) ?? "topLeft";
      const offset = layoutInfo.rect[corner][axis] - visibleRect[axis];
      const isBetter = !best || (edge === "end" ? offset < best.offset : offset > best.offset);
      if (isBetter) best = { key, corner, offset };
    }
  }
  return best;
}

/** Viewport coordinate (along `axis`) that pins the viewport to `edge` of the content. */
export function getEdgeSnapTarget(edge: ScrollAnchorEdge, axis: ScrollAnchorAxis, contentSize: Size, previousVisibleRect: Rect): number {
  if (edge === "start") return 0;
  const dimension = dimensionForAxis(axis);
  return Math.max(0, contentSize[dimension] - previousVisibleRect[dimension]);
}

/** Whether the viewport is within `threshold` px of the anchored edge. */
export function isNearEdge(visibleRect: Rect, contentSize: Size, edge: ScrollAnchorEdge, axis: ScrollAnchorAxis, threshold: number): boolean {
  if (edge === "start") return visibleRect[axis] <= threshold;
  const dimension = dimensionForAxis(axis);
  const distanceFromEnd = contentSize[dimension] - (visibleRect[axis] + visibleRect[dimension]);
  return distanceFromEnd <= threshold;
}

/**
 * New scroll position after content changes: keep the anchor item where it was; else stick to the edge, but
 * only if the viewport was near it and the user is not scrolling away.
 */
export function resolveScrollAdjustment(
  edge: ScrollAnchorEdge,
  axis: ScrollAnchorAxis,
  anchor: ScrollAnchor | null,
  wasNearAnchorEdge: boolean,
  isScrolling: boolean,
  itemSizeChanged: boolean,
  contentSizeDelta: number,
  getLayoutInfo: (key: Key) => LayoutInfo | null,
  previousVisibleRect: Rect,
  contentSize: Size,
): Rect | null {
  const withTarget = (target: number): Rect =>
    axis === "x"
      ? new Rect(target, previousVisibleRect.y, previousVisibleRect.width, previousVisibleRect.height)
      : new Rect(previousVisibleRect.x, target, previousVisibleRect.width, previousVisibleRect.height);

  if (anchor) {
    const target = computeScrollAnchorTarget(anchor, axis, getLayoutInfo, previousVisibleRect, contentSize);
    if (target != null) return withTarget(target);
  }

  if (wasNearAnchorEdge && !isScrolling && (!itemSizeChanged || contentSizeDelta > 0)) {
    const target = withTarget(getEdgeSnapTarget(edge, axis, contentSize, previousVisibleRect));
    return target.equals(previousVisibleRect) ? null : target;
  }

  return null;
}

export interface ResolveAfterLayoutOptions {
  anchorInfo: ScrollAnchorInfo | null;
  /** The anchor captured by `captureBeforeLayout` before this pass's `layout.update()` ran. */
  anchor: ScrollAnchor | null;
  /** The full post-layout visible layout infos, i.e. `virtualizer.getVisibleLayoutInfos()`. */
  postLayoutInfos: Map<Key, LayoutInfo>;
  previousVisibleRect: Rect;
  previousContentSize: Size;
  contentSize: Size;
  itemSizeChanged: boolean;
  isScrolling: boolean;
  getLayoutInfo: (key: Key) => LayoutInfo | null;
}

/** Cross-pass state needed to keep the viewport anchored to a layout's edge across relayouts. */
export class ScrollAnchorTracker {
  private hasSnappedToEdge = false;
  private hadEstimatedVisibleItems = false;
  private wasNearAnchorEdge = false;

  /** Resets all tracked state, e.g. when the virtualizer's layout instance changes. */
  reset(): void {
    this.hasSnappedToEdge = false;
    this.hadEstimatedVisibleItems = false;
    this.wasNearAnchorEdge = false;
  }

  /** Captures the anchor from pre-layout view positions. */
  captureBeforeLayout(anchorInfo: ScrollAnchorInfo | null, preLayoutInfos: Iterable<[Key, LayoutInfo]>, visibleRect: Rect): ScrollAnchor | null {
    if (!anchorInfo) return null;
    return captureScrollAnchor(anchorInfo.edge, anchorInfo.axis, visibleRect, preLayoutInfos, anchorInfo.isAnchorable);
  }

  /** Post-layout decision: updates the tracked state for the next pass and returns the scroll target, or null. */
  resolveAfterLayout(options: ResolveAfterLayoutOptions): Rect | null {
    const { anchorInfo, anchor, postLayoutInfos, previousVisibleRect, previousContentSize, contentSize, itemSizeChanged, isScrolling, getLayoutInfo } = options;
    if (!anchorInfo) return null;

    // Read the previous pass's state into locals before any writes below overwrite it.
    const wasSettlingLastPass = this.hadEstimatedVisibleItems;
    const wasNearAnchorEdgeLastPass = this.wasNearAnchorEdge;

    let hasEstimated = false;
    for (const layoutInfo of postLayoutInfos.values()) {
      if (layoutInfo.estimatedSize) {
        hasEstimated = true;
        break;
      }
    }
    this.hadEstimatedVisibleItems = hasEstimated;
    // Don't recheck "near edge?" mid-resize (it could look like a scroll that never happened).
    if (!wasSettlingLastPass) {
      this.wasNearAnchorEdge = isNearEdge(previousVisibleRect, previousContentSize, anchorInfo.edge, anchorInfo.axis, anchorInfo.threshold);
    }

    if (previousVisibleRect.area === 0) return null;

    const dimension = anchorInfo.axis === "x" ? "width" : "height";
    const contentSizeDelta = contentSize[dimension] - previousContentSize[dimension];
    const isFirstAnchoredLayout = !this.hasSnappedToEdge;
    this.hasSnappedToEdge = true;

    // Only modify scroll when content actually changed (or this is the first layout, which always snaps).
    if (!(isFirstAnchoredLayout || contentSizeDelta !== 0 || itemSizeChanged)) return null;

    const wasNearAnchorEdge =
      isFirstAnchoredLayout ||
      (wasSettlingLastPass && wasNearAnchorEdgeLastPass) ||
      isNearEdge(previousVisibleRect, previousContentSize, anchorInfo.edge, anchorInfo.axis, anchorInfo.threshold);
    // A first-ever layout always snaps: save that decision so later passes of this cascade reuse it.
    if (!wasSettlingLastPass) this.wasNearAnchorEdge = wasNearAnchorEdge;
    // While still resizing, items above the anchor are also growing: following it would fall short of the edge.
    const effectiveAnchor = isFirstAnchoredLayout || (wasSettlingLastPass && wasNearAnchorEdgeLastPass) ? null : anchor;
    return resolveScrollAdjustment(
      anchorInfo.edge,
      anchorInfo.axis,
      effectiveAnchor,
      wasNearAnchorEdge,
      isScrolling,
      itemSizeChanged,
      contentSizeDelta,
      getLayoutInfo,
      previousVisibleRect,
      contentSize,
    );
  }
}
