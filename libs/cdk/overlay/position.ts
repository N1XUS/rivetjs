// Overlay positioning: a 1:1 port of React Aria's `calculatePosition` (placement, flip, offset,
// crossOffset, containerPadding, boundary element, maxHeight, arrow position, trigger anchor point)
// and `useOverlayPosition` (as `overlayPosition()`: imperative, called when the overlay opens; it
// follows window / visual viewport resizes and overlay / target size changes, and closes on scroll of
// the trigger's scroll parents). Writes styles through CSSOM (CSP-safe). The overlay components
// (Popover, Menu, ComboBox, …) call it while open.
//
// Ported from @react-aria/overlays (calculatePosition.ts, useOverlayPosition.ts, useCloseOnScroll.ts),
// Apache-2.0, © Adobe.
import { signal, type Signal } from "@rivetjs/reactivity";
import { direction as directionOf, type Direction } from "../bidi/index.ts";
import { isWebKit } from "../platform/index.ts";
import { onCloseMap } from "./close-on-scroll.ts";

/** React Aria placements, plus the logical `side start|end` forms of earlier cdk versions. */
export type Placement =
  | "bottom"
  | "bottom left"
  | "bottom right"
  | "bottom start"
  | "bottom end"
  | "top"
  | "top left"
  | "top right"
  | "top start"
  | "top end"
  | "left"
  | "left top"
  | "left bottom"
  | "start"
  | "start top"
  | "start bottom"
  | "right"
  | "right top"
  | "right bottom"
  | "end"
  | "end top"
  | "end bottom"
  // cdk 0.x logical cross placements on horizontal sides (`start` = top, `end` = bottom).
  | "left start"
  | "left end"
  | "right start"
  | "right end";

export type Axis = "top" | "bottom" | "left" | "right";
export type SizeAxis = "width" | "height";
export type PlacementAxis = Axis | "center";

interface Position {
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
}

/** Boundary / container geometry (see `getContainerDimensions`). */
export interface Dimensions {
  width: number;
  height: number;
  totalWidth: number;
  totalHeight: number;
  top: number;
  left: number;
  scroll: Position;
}

interface ParsedPlacement {
  placement: PlacementAxis;
  crossPlacement: PlacementAxis;
  axis: Axis;
  crossAxis: Axis;
  size: SizeAxis;
  crossSize: SizeAxis;
}

export interface Offset {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PositionOpts {
  arrowSize: number;
  placement: Placement;
  targetNode: Element;
  overlayNode: Element;
  scrollNode: Element;
  padding: number;
  shouldFlip: boolean;
  boundaryElement: Element;
  offset: number;
  crossOffset: number;
  maxHeight?: number | undefined;
  arrowBoundaryOffset?: number | undefined;
  targetRect?: Offset | null | undefined;
}

type HeightGrowthDirection = "top" | "bottom";

export interface PositionResult {
  position: Position;
  arrowOffsetLeft?: number | undefined;
  arrowOffsetTop?: number | undefined;
  triggerAnchorPoint: { x: number; y: number };
  maxHeight: number;
  placement: PlacementAxis;
}

type Keyed = Record<string, string>;
const AXIS: Keyed = { top: "top", bottom: "top", left: "left", right: "left" };
const FLIPPED_DIRECTION: Keyed = { top: "bottom", bottom: "top", left: "right", right: "left" };
const CROSS_AXIS: Keyed = { top: "left", left: "top" };
const AXIS_SIZE: Keyed = { top: "height", left: "width" };
const TOTAL_SIZE: Keyed = { width: "totalWidth", height: "totalHeight" };
const PARSED_PLACEMENT_CACHE: Record<string, ParsedPlacement> = {};

const clamp = (value: number, min = -Infinity, max = Infinity): number => Math.min(Math.max(value, min), max);
const getVisualViewport = (): VisualViewport | null => (typeof document !== "undefined" ? (window.visualViewport ?? null) : null);
// Index helpers: the original indexes positions / offsets / dimensions by axis names.
type Bag = Record<string, number | undefined>;
const at = (o: object, key: string): number => (o as Bag)[key] ?? 0;
const opt = (o: object, key: string): number | undefined => (o as Bag)[key];
const put = (o: object, key: string, value: number): void => {
  (o as Bag)[key] = value;
};

function getContainerDimensions(containerNode: Element, visualViewport: VisualViewport | null): Dimensions {
  let width = 0,
    height = 0,
    totalWidth = 0,
    totalHeight = 0,
    top = 0,
    left = 0;
  const scroll: Position = {};
  const isPinchZoomedIn = (visualViewport?.scale ?? 1) > 1;

  // `html` / `body` without positioning: absolute positions are relative to the initial containing
  // block (the viewport), so use the visual viewport.
  if (containerNode.tagName === "BODY" || containerNode.tagName === "HTML") {
    const documentElement = document.documentElement;
    totalWidth = documentElement.clientWidth;
    totalHeight = documentElement.clientHeight;
    width = visualViewport?.width ?? totalWidth;
    height = visualViewport?.height ?? totalHeight;
    scroll.top = documentElement.scrollTop || containerNode.scrollTop;
    scroll.left = documentElement.scrollLeft || containerNode.scrollLeft;
    // Top / left of the visual viewport relative to the layout viewport origin (pageTop / pageLeft:
    // WebKit misreports offsetTop / offsetLeft during pans).
    if (visualViewport) {
      top = Math.max(0, visualViewport.pageTop - (scroll.top ?? 0));
      left = Math.max(0, visualViewport.pageLeft - (scroll.left ?? 0));
    }
  } else {
    ({ width, height, top, left } = getOffset(containerNode, false));
    scroll.top = containerNode.scrollTop;
    scroll.left = containerNode.scrollLeft;
    totalWidth = width;
    totalHeight = height;
  }

  if (isWebKit() && (containerNode.tagName === "BODY" || containerNode.tagName === "HTML") && isPinchZoomedIn) {
    // Safari reports a non-zero scrollTop / Left for the non-scrolling body / html when pinch zoomed.
    scroll.top = 0;
    scroll.left = 0;
    top = visualViewport?.pageTop ?? 0;
    left = visualViewport?.pageLeft ?? 0;
  }

  return { width, height, totalWidth, totalHeight, scroll, top, left };
}

function getScroll(node: Element): Offset {
  return { top: node.scrollTop, left: node.scrollLeft, width: node.scrollWidth, height: node.scrollHeight };
}

// Space required to move the overlay so it stays inside the boundary.
function getDelta(
  axis: Axis,
  offset: number,
  size: number,
  boundaryDimensions: Dimensions,
  containerDimensions: Dimensions,
  padding: number,
  containerOffsetWithBoundary: Offset,
): number {
  const containerScroll = at(containerDimensions.scroll, axis);
  const boundarySize = at(boundaryDimensions, AXIS_SIZE[axis]!);
  const boundaryScroll = at(boundaryDimensions.scroll, AXIS[axis]!);
  const boundaryStartEdge = at(containerOffsetWithBoundary, axis) + boundaryScroll + padding;
  const boundaryEndEdge = at(containerOffsetWithBoundary, axis) + boundaryScroll + boundarySize - padding;
  const startEdgeOffset = offset - containerScroll + boundaryScroll + at(containerOffsetWithBoundary, axis) - at(boundaryDimensions, AXIS[axis]!);
  const endEdgeOffset = offset - containerScroll + size + boundaryScroll + at(containerOffsetWithBoundary, axis) - at(boundaryDimensions, AXIS[axis]!);

  // An overlay edge outside the boundary: shift so that edge aligns with the closest boundary edge.
  if (startEdgeOffset < boundaryStartEdge) return boundaryStartEdge - startEdgeOffset;
  if (endEdgeOffset > boundaryEndEdge) return Math.max(boundaryEndEdge - endEdgeOffset, boundaryStartEdge - startEdgeOffset);
  return 0;
}

function getMargins(node: Element): Required<Position> {
  const style = window.getComputedStyle(node);
  return {
    top: parseInt(style.marginTop, 10) || 0,
    bottom: parseInt(style.marginBottom, 10) || 0,
    left: parseInt(style.marginLeft, 10) || 0,
    right: parseInt(style.marginRight, 10) || 0,
  };
}

function parsePlacement(input: Placement): ParsedPlacement {
  if (PARSED_PLACEMENT_CACHE[input]) return PARSED_PLACEMENT_CACHE[input]!;
  let [placement, crossPlacement] = input.split(" ") as [string, string | undefined];
  const axis = (AXIS[placement] || "right") as Axis;
  const crossAxis = CROSS_AXIS[axis] as Axis;
  if (!crossPlacement || !AXIS[crossPlacement]) crossPlacement = "center";
  const size = AXIS_SIZE[axis] as SizeAxis;
  const crossSize = AXIS_SIZE[crossAxis] as SizeAxis;
  return (PARSED_PLACEMENT_CACHE[input] = {
    placement: placement as PlacementAxis,
    crossPlacement: crossPlacement as PlacementAxis,
    axis,
    crossAxis,
    size,
    crossSize,
  });
}

function computePosition(
  childOffset: Offset,
  _boundaryDimensions: Dimensions,
  overlaySize: Offset,
  placementInfo: ParsedPlacement,
  offset: number,
  crossOffset: number,
  _containerOffsetWithBoundary: Offset,
  isContainerPositioned: boolean,
  arrowSize: number,
  arrowBoundaryOffset: number,
  containerDimensions: Dimensions,
): Position {
  const { placement, crossPlacement, axis, crossAxis, size, crossSize } = placementInfo;
  const position: Position = {};

  // Trigger position on the cross axis.
  put(position, crossAxis, at(childOffset, crossAxis));
  if (crossPlacement === "center") {
    // Overlay center on the trigger center.
    put(position, crossAxis, at(position, crossAxis) + (at(childOffset, crossSize) - at(overlaySize, crossSize)) / 2);
  } else if (crossPlacement !== crossAxis) {
    // Overlay end edge on the trigger end edge.
    put(position, crossAxis, at(position, crossAxis) + at(childOffset, crossSize) - at(overlaySize, crossSize));
  } // else: overlay start edge on the trigger start edge.

  put(position, crossAxis, at(position, crossAxis) + crossOffset);

  // Keep the arrow overlapping the trigger.
  const minPosition = at(childOffset, crossAxis) - at(overlaySize, crossSize) + arrowSize + arrowBoundaryOffset;
  const maxPosition = at(childOffset, crossAxis) + at(childOffset, crossSize) - arrowSize - arrowBoundaryOffset;
  put(position, crossAxis, clamp(at(position, crossAxis), minPosition, maxPosition));

  // Whole pixels.
  if (placement === axis) {
    // A positioned container: `bottom` is relative to its height; static: only `body`, relative to its container.
    const containerHeight = isContainerPositioned ? at(containerDimensions, size) : at(containerDimensions, TOTAL_SIZE[size]!);
    put(position, FLIPPED_DIRECTION[axis]!, Math.floor(containerHeight - at(childOffset, axis) + offset));
  } else {
    put(position, axis, Math.floor(at(childOffset, axis) + at(childOffset, size) + offset));
  }
  return position;
}

function getMaxHeight(
  position: Position,
  boundaryDimensions: Dimensions,
  containerOffsetWithBoundary: Offset,
  _isContainerPositioned: boolean,
  margins: Position,
  padding: number,
  overlayHeight: number,
  heightGrowthDirection: HeightGrowthDirection,
  containerDimensions: Dimensions,
  isContainerDescendentOfBoundary: boolean,
  visualViewport: VisualViewport | null,
): number {
  // Positioned by `bottom`: the true overlay top relative to the container.
  const overlayTop =
    (position.top != null ? position.top : containerDimensions.totalHeight - (position.bottom ?? 0) - overlayHeight) - (containerDimensions.scroll.top ?? 0);
  const boundaryToContainerTransformOffset = isContainerDescendentOfBoundary ? containerOffsetWithBoundary.top : 0;
  // Most restrictive top / bottom of the boundary and the visual viewport.
  const boundingRect = {
    top: Math.max(
      boundaryDimensions.top + boundaryToContainerTransformOffset,
      (visualViewport?.offsetTop ?? boundaryDimensions.top) + boundaryToContainerTransformOffset,
    ),
    bottom: Math.min(
      boundaryDimensions.top + boundaryDimensions.height + boundaryToContainerTransformOffset,
      (visualViewport?.offsetTop ?? 0) + (visualViewport?.height ?? 0),
    ),
  };
  return heightGrowthDirection !== "top"
    ? // Overlay top to boundary bottom.
      Math.max(0, boundingRect.bottom - overlayTop - ((margins.top ?? 0) + (margins.bottom ?? 0) + padding))
    : // Overlay bottom to boundary top.
      Math.max(0, overlayTop + overlayHeight - boundingRect.top - ((margins.top ?? 0) + (margins.bottom ?? 0) + padding));
}

function getAvailableSpace(
  boundaryDimensions: Dimensions,
  containerOffsetWithBoundary: Offset,
  childOffset: Offset,
  margins: Position,
  padding: number,
  placementInfo: ParsedPlacement,
  containerDimensions: Dimensions,
  isContainerDescendentOfBoundary: boolean,
): number {
  const { placement, axis, size } = placementInfo;
  if (placement === axis) {
    return Math.max(
      0,
      at(childOffset, axis) -
        at(containerDimensions.scroll, axis) -
        (at(boundaryDimensions, axis) + (isContainerDescendentOfBoundary ? at(containerOffsetWithBoundary, axis) : 0)) -
        at(margins, axis) -
        at(margins, FLIPPED_DIRECTION[axis]!) -
        padding,
    );
  }
  return Math.max(
    0,
    at(boundaryDimensions, size) +
      at(boundaryDimensions, axis) +
      (isContainerDescendentOfBoundary ? at(containerOffsetWithBoundary, axis) : 0) -
      at(childOffset, axis) -
      at(childOffset, size) +
      at(containerDimensions.scroll, axis) -
      at(margins, axis) -
      at(margins, FLIPPED_DIRECTION[axis]!) -
      padding,
  );
}

/** The pure geometry of `calculatePosition` (exported for tests, as in React Aria). */
export function calculatePositionInternal(
  placementInput: Placement,
  childOffset: Offset,
  overlaySize: Offset,
  _scrollSize: Offset,
  margins: Position,
  padding: number,
  flip: boolean,
  boundaryDimensions: Dimensions,
  containerDimensions: Dimensions,
  containerOffsetWithBoundary: Offset,
  offset: number,
  crossOffset: number,
  isContainerPositioned: boolean,
  userSetMaxHeight: number | undefined,
  arrowSize: number,
  arrowBoundaryOffset: number,
  isContainerDescendentOfBoundary: boolean,
  visualViewport: VisualViewport | null,
): PositionResult {
  let placementInfo = parsePlacement(placementInput);
  const { size, crossAxis, crossSize } = placementInfo;
  let { placement, crossPlacement } = placementInfo;
  let position = computePosition(
    childOffset,
    boundaryDimensions,
    overlaySize,
    placementInfo,
    offset,
    crossOffset,
    containerOffsetWithBoundary,
    isContainerPositioned,
    arrowSize,
    arrowBoundaryOffset,
    containerDimensions,
  );
  let normalizedOffset = offset;
  const space = getAvailableSpace(
    boundaryDimensions,
    containerOffsetWithBoundary,
    childOffset,
    margins,
    padding + offset,
    placementInfo,
    containerDimensions,
    isContainerDescendentOfBoundary,
  );

  // Flip when the overlay is larger than the available space and the other side has more.
  if (flip && at(overlaySize, size) > space) {
    const flippedPlacementInfo = parsePlacement(`${FLIPPED_DIRECTION[placement]} ${crossPlacement}` as Placement);
    const flippedPosition = computePosition(
      childOffset,
      boundaryDimensions,
      overlaySize,
      flippedPlacementInfo,
      offset,
      crossOffset,
      containerOffsetWithBoundary,
      isContainerPositioned,
      arrowSize,
      arrowBoundaryOffset,
      containerDimensions,
    );
    const flippedSpace = getAvailableSpace(
      boundaryDimensions,
      containerOffsetWithBoundary,
      childOffset,
      margins,
      padding + offset,
      flippedPlacementInfo,
      containerDimensions,
      isContainerDescendentOfBoundary,
    );
    if (flippedSpace > space) {
      placementInfo = flippedPlacementInfo;
      position = flippedPosition;
      normalizedOffset = offset;
    }
  }

  // Direction the overlay height can grow, for the max height.
  let heightGrowthDirection: HeightGrowthDirection = "bottom";
  if (placementInfo.axis === "top") {
    if (placementInfo.placement === "top") heightGrowthDirection = "top";
    else if (placementInfo.placement === "bottom") heightGrowthDirection = "bottom";
  } else if (placementInfo.crossAxis === "top") {
    if (placementInfo.crossPlacement === "top") heightGrowthDirection = "bottom";
    else if (placementInfo.crossPlacement === "bottom") heightGrowthDirection = "top";
  }

  let delta = getDelta(
    crossAxis,
    at(position, crossAxis),
    at(overlaySize, crossSize),
    boundaryDimensions,
    containerDimensions,
    padding,
    containerOffsetWithBoundary,
  );
  put(position, crossAxis, at(position, crossAxis) + delta);

  let maxHeight = getMaxHeight(
    position,
    boundaryDimensions,
    containerOffsetWithBoundary,
    isContainerPositioned,
    margins,
    padding,
    overlaySize.height,
    heightGrowthDirection,
    containerDimensions,
    isContainerDescendentOfBoundary,
    visualViewport,
  );
  if (userSetMaxHeight && userSetMaxHeight < maxHeight) maxHeight = userSetMaxHeight;
  overlaySize.height = Math.min(overlaySize.height, maxHeight);

  position = computePosition(
    childOffset,
    boundaryDimensions,
    overlaySize,
    placementInfo,
    normalizedOffset,
    crossOffset,
    containerOffsetWithBoundary,
    isContainerPositioned,
    arrowSize,
    arrowBoundaryOffset,
    containerDimensions,
  );
  delta = getDelta(
    crossAxis,
    at(position, crossAxis),
    at(overlaySize, crossSize),
    boundaryDimensions,
    containerDimensions,
    padding,
    containerOffsetWithBoundary,
  );
  put(position, crossAxis, at(position, crossAxis) + delta);

  const arrowPosition: Position = {};
  // Arrow coordinates: 0 at the overlay's top / left. Prefer the center of the trigger; an arrow
  // (absolutely positioned child) starts after its parent's margin, so subtract it.
  let origin = at(childOffset, crossAxis) - at(position, crossAxis) - at(margins, AXIS[crossAxis]!);
  const preferredArrowPosition = origin + 0.5 * at(childOffset, crossSize);
  const arrowMinPosition = arrowSize / 2 + arrowBoundaryOffset;
  const overlayMargin = AXIS[crossAxis] === "left" ? (margins.left ?? 0) + (margins.right ?? 0) : (margins.top ?? 0) + (margins.bottom ?? 0);
  const arrowMaxPosition = at(overlaySize, crossSize) - overlayMargin - arrowSize / 2 - arrowBoundaryOffset;
  // Keep the arrow within the trigger and within the overlay.
  const arrowOverlappingChildMinEdge = at(childOffset, crossAxis) + arrowSize / 2 - (at(position, crossAxis) + at(margins, AXIS[crossAxis]!));
  const arrowOverlappingChildMaxEdge =
    at(childOffset, crossAxis) + at(childOffset, crossSize) - arrowSize / 2 - (at(position, crossAxis) + at(margins, AXIS[crossAxis]!));
  const arrowPositionOverlappingChild = clamp(preferredArrowPosition, arrowOverlappingChildMinEdge, arrowOverlappingChildMaxEdge);
  put(arrowPosition, crossAxis, clamp(arrowPositionOverlappingChild, arrowMinPosition, arrowMaxPosition));

  // With an arrow, it is the animation origin; otherwise the target edge.
  ({ placement, crossPlacement } = placementInfo);
  if (arrowSize) origin = at(arrowPosition, crossAxis);
  else if (crossPlacement === "right") origin += at(childOffset, crossSize);
  else if (crossPlacement === "center") origin += at(childOffset, crossSize) / 2;

  const crossOrigin = placement === "left" || placement === "top" ? at(overlaySize, size) : 0;
  const triggerAnchorPoint = {
    x: placement === "top" || placement === "bottom" ? origin : crossOrigin,
    y: placement === "left" || placement === "right" ? origin : crossOrigin,
  };

  return { position, maxHeight, arrowOffsetLeft: arrowPosition.left, arrowOffsetTop: arrowPosition.top, placement, triggerAnchorPoint };
}

/** Where to place the overlay relative to the target (and the arrow, if any). */
export function calculatePosition(opts: PositionOpts): PositionResult {
  const {
    placement,
    targetNode,
    overlayNode,
    scrollNode,
    padding,
    shouldFlip,
    boundaryElement,
    offset,
    crossOffset,
    maxHeight,
    arrowSize = 0,
    arrowBoundaryOffset = 0,
    targetRect,
  } = opts;

  const visualViewport = getVisualViewport();
  const container = overlayNode instanceof HTMLElement ? getContainingBlock(overlayNode) : document.documentElement;
  const isViewportContainer = container === document.documentElement;
  const containerPositionStyle = window.getComputedStyle(container).position;
  const isContainerPositioned = !!containerPositionStyle && containerPositionStyle !== "static";
  const childOffset: Offset = isViewportContainer ? getOffset(targetNode, false, targetRect) : getPosition(targetNode, container, false, targetRect);

  if (!isViewportContainer) {
    const { marginTop, marginLeft } = window.getComputedStyle(targetNode);
    childOffset.top += parseInt(marginTop, 10) || 0;
    childOffset.left += parseInt(marginLeft, 10) || 0;
  }

  const overlaySize: Offset = getOffset(overlayNode, true);
  const margins = getMargins(overlayNode);
  overlaySize.width += margins.left + margins.right;
  overlaySize.height += margins.top + margins.bottom;

  const scrollSize = getScroll(scrollNode);

  // Body boundary: visual viewport size (zoom adjusted) and top / left; other boundaries: their
  // size and viewport-relative top / left (without scroll).
  const boundaryDimensions = getContainerDimensions(boundaryElement, visualViewport);
  const containerDimensions = getContainerDimensions(container, visualViewport);

  // The boundary's offset in the container's coordinate system (container = 0, 0).
  let containerOffsetWithBoundary: Offset;
  if ((boundaryElement.tagName === "BODY" || boundaryElement.tagName === "HTML") && !isViewportContainer) {
    // Viewport space for body / html boundaries: getRect, not getOffset.
    const containerRect = getRect(container, false);
    containerOffsetWithBoundary = {
      top: -(containerRect.top - boundaryDimensions.top),
      left: -(containerRect.left - boundaryDimensions.left),
      width: 0,
      height: 0,
    };
  } else if ((boundaryElement.tagName === "BODY" || boundaryElement.tagName === "HTML") && isViewportContainer) {
    containerOffsetWithBoundary = { top: 0, left: 0, width: 0, height: 0 };
  } else {
    // A custom boundary (e.g. a scrolling container).
    containerOffsetWithBoundary = getPosition(boundaryElement, container, false);
  }

  const isContainerDescendentOfBoundary = boundaryElement.contains(container);
  return calculatePositionInternal(
    placement,
    childOffset,
    overlaySize,
    scrollSize,
    margins,
    padding,
    shouldFlip,
    boundaryDimensions,
    containerDimensions,
    containerOffsetWithBoundary,
    offset,
    crossOffset,
    isContainerPositioned,
    maxHeight,
    arrowSize,
    arrowBoundaryOffset,
    isContainerDescendentOfBoundary,
    visualViewport,
  );
}

/** Bounding rect; with `ignoreScale`, the layout size of HTML elements (unaffected by scale transforms). */
export function getRect(node: Element, ignoreScale: boolean): Offset {
  let { top, left, width, height } = node.getBoundingClientRect();
  if (ignoreScale && node instanceof node.ownerDocument.defaultView!.HTMLElement) {
    width = node.offsetWidth;
    height = node.offsetHeight;
  }
  return { top, left, width, height };
}

function getOffset(node: Element, ignoreScale: boolean, overrideRect?: Offset | null): Offset {
  const { top, left, width, height } = overrideRect || getRect(node, ignoreScale);
  const { scrollTop, scrollLeft, clientTop, clientLeft } = document.documentElement;
  return { top: top + scrollTop - clientTop, left: left + scrollLeft - clientLeft, width, height };
}

function getPosition(node: Element, parent: Element, ignoreScale: boolean, overrideRect?: Offset | null): Offset {
  const style = window.getComputedStyle(node);
  let offset: Offset;
  if (style.position === "fixed") {
    offset = { ...(overrideRect || getRect(node, ignoreScale)) };
  } else {
    offset = getOffset(node, ignoreScale, overrideRect);
    const parentOffset = getOffset(parent, ignoreScale);
    const parentStyle = window.getComputedStyle(parent);
    parentOffset.top += (parseInt(parentStyle.borderTopWidth, 10) || 0) - parent.scrollTop;
    parentOffset.left += (parseInt(parentStyle.borderLeftWidth, 10) || 0) - parent.scrollLeft;
    offset.top -= parentOffset.top;
    offset.left -= parentOffset.left;
  }
  offset.top -= parseInt(style.marginTop, 10) || 0;
  offset.left -= parseInt(style.marginLeft, 10) || 0;
  return offset;
}

// The element `node` is positioned relative to (its containing block).
function getContainingBlock(node: HTMLElement): Element {
  let offsetParent: Element | null = node.offsetParent;
  // offsetParent stops at body even when body is not a containing block.
  if (offsetParent && offsetParent === document.body && window.getComputedStyle(offsetParent).position === "static" && !isContainingBlock(offsetParent))
    offsetParent = document.documentElement;
  // Null for position: fixed and a few other cases: walk up (fixed elements still have a
  // containing block, not always the viewport).
  if (offsetParent == null) {
    offsetParent = node.parentElement;
    while (offsetParent && !isContainingBlock(offsetParent)) offsetParent = offsetParent.parentElement;
  }
  return offsetParent || document.documentElement;
}

function isContainingBlock(node: Element): boolean {
  const style = window.getComputedStyle(node) as CSSStyleDeclaration & { WebkitBackdropFilter?: string };
  return (
    style.transform !== "none" ||
    /transform|perspective/.test(style.willChange) ||
    style.filter !== "none" ||
    style.contain === "paint" ||
    ("backdropFilter" in style && style.backdropFilter !== "none" && style.backdropFilter !== "") ||
    ("WebkitBackdropFilter" in style && style.WebkitBackdropFilter !== "none" && style.WebkitBackdropFilter !== "")
  );
}

// ---------------------------------------------------------------------------------------------
// overlayPosition (useOverlayPosition)

/** An element, or an accessor of one (`ref()` signals work as is). */
export type ElementSource<T extends Element = Element> = T | null | undefined | (() => T | null | undefined);
const read = <T extends Element>(source: ElementSource<T>): T | null => (typeof source === "function" ? source() : source) ?? null;

export interface PositionProps {
  /** Placement relative to the target. @default "bottom" */
  placement?: Placement;
  /** Padding between the overlay and its boundary. @default 12 */
  containerPadding?: number;
  /** Extra offset along the main axis. @default 0 */
  offset?: number;
  /** Extra offset along the cross axis. @default 0 */
  crossOffset?: number;
  /** Flip to the opposite side when there is not enough room. @default true */
  shouldFlip?: boolean;
  /** Whether the overlay is rendered (open). @default true */
  isOpen?: boolean;
}

export interface AriaPositionProps extends PositionProps {
  /** Cross size of the arrow in pixels. @default arrow element width, else 0 */
  arrowSize?: number;
  /** Positioning boundary. @default document.body */
  boundaryElement?: Element;
  /** Element the overlay positions itself relative to (`targetRef`). */
  target: ElementSource;
  /** The overlay element (`overlayRef`). */
  overlay: ElementSource<HTMLElement>;
  /** The arrow element (`arrowRef`). */
  arrow?: ElementSource;
  /**
   * Rivet: write the arrow's position (`position`, `left` / `top`, the placement side, `transform`) on
   * the arrow element. `false`: only its ARIA / `data-placement`; the caller applies RA's `arrowProps`
   * style from `position()` (`<OverlayArrow>`, so its own `style` wins as in RAC). @default true
   */
  arrowStyle?: boolean;
  /** Scrollable region inside the overlay (`scrollRef`). @default overlay */
  scroll?: ElementSource;
  /** Whether to update the position automatically. @default true */
  shouldUpdatePosition?: boolean;
  /** Called when the overlay should close (a scroll parent of the target scrolled). `null`: never. */
  onClose?: (() => void) | null;
  /** Upper bound of the computed max height. */
  maxHeight?: number;
  /** Minimum distance of the arrow edge from the overlay edge. @default 0 */
  arrowBoundaryOffset?: number;
  /** Override the target rectangle (e.g. a pointer position for context menus). */
  getTargetRect?: (target: Element) => DOMRect | Offset | null | undefined;
  /** Text direction for `start` / `end`. @default direction at the target */
  direction?: Direction;
  /** z-index written on the overlay (React Aria: 100000). Top-layer overlays ignore it. @default 100000 */
  zIndex?: number | null;
}

export interface PositionAria {
  /** Placement after flipping (`data-placement` on the overlay and arrow mirrors it). */
  readonly placement: Signal<PlacementAxis | null>;
  /** Origin of the target in the overlay's coordinate system (for animations; also `--trigger-anchor-point`). */
  readonly triggerAnchorPoint: Signal<{ x: number; y: number } | null>;
  /** The last computed result. */
  readonly position: Signal<PositionResult | null>;
  /** Re-position now. */
  updatePosition(): void;
  /** Stop following (call on close); styles stay. */
  dispose(): void;
}

interface ScrollAnchor {
  type: "top" | "bottom";
  offset: number;
}

export { onCloseMap };

function translateRTL(position: Placement, direction: Direction): Placement {
  // Logical cross placements on horizontal sides: `start` = top, `end` = bottom.
  const [side, cross] = position.split(" ");
  if ((side === "left" || side === "right" || side === "start" || side === "end") && (cross === "start" || cross === "end"))
    position = `${side} ${cross === "start" ? "top" : "bottom"}` as Placement;
  return (
    direction === "rtl" ? position.replace("start", "right").replace("end", "left") : position.replace("start", "left").replace("end", "right")
  ) as Placement;
}

/**
 * Position `overlay` relative to `target` now and keep it positioned until `dispose()`: window and
 * visual viewport resizes, overlay / target size changes (ResizeObserver), and the iOS virtual
 * keyboard. Scrolling a scroll parent of the target calls `onClose` (the position would be stale);
 * window scroll needs nothing (document coordinates). Call when the overlay opens; dispose on close.
 */
export function overlayPosition(props: AriaPositionProps): PositionAria {
  const {
    arrowSize,
    placement = "bottom",
    containerPadding = 12,
    shouldFlip = true,
    boundaryElement = document.body,
    offset = 0,
    crossOffset = 0,
    shouldUpdatePosition = true,
    isOpen = true,
    onClose,
    maxHeight,
    arrowBoundaryOffset = 0,
    getTargetRect,
    zIndex = 100000,
  } = props;
  const placementSignal = signal<PlacementAxis | null>(null),
    anchorPoint = signal<{ x: number; y: number } | null>(null),
    result = signal<PositionResult | null>(null);
  const visualViewport = getVisualViewport();
  // Freeze the overlay while pinch zoomed differently from when it opened.
  const lastScale = visualViewport?.scale;
  let disposed = false;

  const updatePosition = (): void => {
    const overlay = read(props.overlay),
      target = read(props.target),
      arrow = read(props.arrow ?? null),
      scroll = read(props.scroll ?? null) ?? overlay;
    if (disposed || shouldUpdatePosition === false || !isOpen || !overlay || !target || !boundaryElement) return;
    if (visualViewport?.scale !== lastScale) return;

    // Scroll anchor from the focused element: keep it in place if the overlay height changes.
    let anchor: ScrollAnchor | null = null;
    const active = document.activeElement;
    if (scroll && active && scroll.contains(active)) {
      const anchorRect = active.getBoundingClientRect(),
        scrollRect = scroll.getBoundingClientRect();
      anchor = { type: "top", offset: anchorRect.top - scrollRect.top };
      if (anchor.offset > scrollRect.height / 2) anchor = { type: "bottom", offset: anchorRect.bottom - scrollRect.bottom };
    }

    const style = overlay.style;
    // Native popover UA styles center it (inset: 0; margin: auto): auto insets make auto margins 0,
    // so unset sides are "auto" there, not "" (which falls back to the UA inset).
    const unset = overlay.hasAttribute("popover") ? "auto" : "";
    if (unset) style.inset = unset;
    if (!style.position) style.position = "absolute";
    if (zIndex != null) style.zIndex = String(zIndex);
    // Reset the previous max height (unless set by the caller) so a grown collection re-measures.
    if (!maxHeight) {
      style.top = "0px";
      style.bottom = unset;
      style.maxHeight = (window.visualViewport?.height ?? window.innerHeight) + "px";
    }

    const rect = getTargetRect?.(target);
    const position = calculatePosition({
      placement: translateRTL(placement, props.direction ?? directionOf(target)),
      overlayNode: overlay,
      targetNode: target,
      scrollNode: scroll || overlay,
      padding: containerPadding,
      shouldFlip,
      boundaryElement,
      offset,
      crossOffset,
      maxHeight,
      arrowSize: arrowSize ?? (arrow ? getRect(arrow, true).width : 0),
      arrowBoundaryOffset,
      targetRect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
    });
    if (!position.position) return;

    // Styles directly, so autofocus scrolling and scroll locking see the final position.
    style.position = "absolute";
    style.top = style.bottom = style.left = style.right = unset;
    for (const key of Object.keys(position.position) as (keyof Position)[]) style[key] = position.position[key] + "px";
    style.maxHeight = position.maxHeight != null ? position.maxHeight + "px" : "";
    const triggerWidth = getRect(target, false).width + "px";
    style.setProperty("--trigger-width", triggerWidth);
    style.setProperty("--rv-trigger-width", triggerWidth);
    style.setProperty("--rv-available-height", position.maxHeight + "px");
    style.setProperty("--trigger-anchor-point", `${position.triggerAnchorPoint.x}px ${position.triggerAnchorPoint.y}px`);
    overlay.setAttribute("data-placement", position.placement);
    if ((arrow instanceof HTMLElement || arrow instanceof SVGElement) && props.arrowStyle === false) {
      arrow.setAttribute("aria-hidden", "true");
      arrow.setAttribute("role", "presentation");
    } else if (arrow instanceof HTMLElement || arrow instanceof SVGElement) {
      arrow.setAttribute("aria-hidden", "true");
      arrow.setAttribute("role", "presentation");
      arrow.setAttribute("data-placement", position.placement);
      // RAC OverlayArrow: absolutely positioned on the overlay's edge facing the trigger, centred on the offset.
      const side = position.placement,
        s = arrow.style;
      s.position = "absolute";
      s.top = s.bottom = s.left = s.right = "";
      if (position.arrowOffsetLeft != null) s.left = position.arrowOffsetLeft + "px";
      if (position.arrowOffsetTop != null) s.top = position.arrowOffsetTop + "px";
      if (side !== "center") s[side] = "100%";
      s.transform = side === "top" || side === "bottom" ? "translateX(-50%)" : "translateY(-50%)";
    }

    // Restore the scroll position relative to the anchor element.
    const focused = document.activeElement;
    if (anchor && focused && scroll) {
      const anchorRect = focused.getBoundingClientRect(),
        scrollRect = scroll.getBoundingClientRect();
      scroll.scrollTop += anchorRect[anchor.type] - scrollRect[anchor.type] - anchor.offset;
    }

    result.set(position);
    placementSignal.set(position.placement);
    anchorPoint.set(position.triggerAnchorPoint);
  };

  const cleanups: (() => void)[] = [];
  const listen = (target: EventTarget | null | undefined, type: string, fn: (event: Event) => void, options?: AddEventListenerOptions | boolean) => {
    if (!target) return;
    target.addEventListener(type, fn, options);
    cleanups.push(() => target.removeEventListener(type, fn, options));
  };

  updatePosition();
  if (isOpen && shouldUpdatePosition !== false) {
    listen(window, "resize", updatePosition, false);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updatePosition());
      const overlay = read(props.overlay),
        target = read(props.target);
      if (overlay) observer.observe(overlay);
      if (target) observer.observe(target);
      cleanups.push(() => observer.disconnect());
    }
    // Reposition, and do not close on scroll, while the visual viewport resizes (iOS keyboard).
    let isResizing = false,
      timeout: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      isResizing = true;
      clearTimeout(timeout);
      timeout = setTimeout(() => (isResizing = false), 500);
      updatePosition();
    };
    // Only a scroll right after a resize (keyboard) repositions; not panning a pinch zoom.
    const onScroll = () => isResizing && onResize();
    listen(visualViewport, "resize", onResize);
    listen(visualViewport, "scroll", onScroll);
    listen(window, "scroll", onScroll);
    cleanups.push(() => clearTimeout(timeout));

    // Close on scroll of a scroll parent of the trigger (not the trigger's own inputs).
    const close = () => {
      if (isResizing) return;
      const target = read(props.target);
      (onClose ?? (target ? onCloseMap.get(target) : undefined))?.();
    };
    if (onClose !== null) {
      listen(
        window,
        "scroll",
        (event: Event) => {
          const target = read(props.target),
            source = event.composedPath?.()[0] ?? event.target;
          // window contains everything; elements outside the trigger's ancestors do not move it.
          if (!target || (source instanceof Node && !source.contains(target))) return;
          if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement) return;
          close();
        },
        true,
      );
    }
  }

  return {
    placement: placementSignal,
    triggerAnchorPoint: anchorPoint,
    position: result,
    updatePosition,
    dispose() {
      disposed = true;
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// cdk 0.x engine API (kept for existing callers).

type Side = "top" | "bottom" | "left" | "right";
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const GAP = 4;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * @deprecated cdk 0.x geometry (fixed 4px gap, viewport only). Use `calculatePosition` /
 * `overlayPosition`. Pure; kept for existing callers and tests.
 */
export function compute(
  anchor: Rect,
  floating: { width: number; height: number },
  viewport: { width: number; height: number },
  placement: Placement,
  rtl = false,
): { top: number; left: number; side: Side; availableHeight: number } {
  const [preferred, align = "center"] = placement.split(" ") as [Side, ("start" | "end" | "center")?];
  const fits = (side: Side): boolean =>
    side === "bottom"
      ? anchor.top + anchor.height + GAP + floating.height <= viewport.height
      : side === "top"
        ? anchor.top - GAP - floating.height >= 0
        : side === "right"
          ? anchor.left + anchor.width + GAP + floating.width <= viewport.width
          : anchor.left - GAP - floating.width >= 0;
  const side = fits(preferred) || !fits(OPPOSITE[preferred]) ? preferred : OPPOSITE[preferred];
  let top: number, left: number;
  const vertical = side === "top" || side === "bottom";
  if (vertical) {
    top = side === "bottom" ? anchor.top + anchor.height + GAP : anchor.top - GAP - floating.height;
    const start = rtl ? anchor.left + anchor.width - floating.width : anchor.left,
      end = rtl ? anchor.left : anchor.left + anchor.width - floating.width;
    left = align === "start" ? start : align === "end" ? end : anchor.left + (anchor.width - floating.width) / 2;
  } else {
    left = side === "right" ? anchor.left + anchor.width + GAP : anchor.left - GAP - floating.width;
    top = align === "start" ? anchor.top : align === "end" ? anchor.top + anchor.height - floating.height : anchor.top + (anchor.height - floating.height) / 2;
  }
  left = Math.max(GAP, Math.min(left, viewport.width - floating.width - GAP));
  top = Math.max(GAP, Math.min(top, viewport.height - floating.height - GAP));
  const availableHeight = side === "bottom" ? viewport.height - (anchor.top + anchor.height + GAP) : side === "top" ? anchor.top - GAP : viewport.height;
  return { top, left, side, availableHeight: Math.max(0, availableHeight - GAP) };
}

/** Place `floating` once (React Aria geometry; 4px offset and container padding, as in cdk 0.x). */
export function position(floating: HTMLElement, anchor: HTMLElement, placement: Placement = "bottom start"): void {
  overlayPosition({ overlay: floating, target: anchor, placement, offset: GAP, containerPadding: GAP, zIndex: null, onClose: null }).dispose();
}
