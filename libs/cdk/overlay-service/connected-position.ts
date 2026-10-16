// Position an overlay relative to an origin element or point (Angular CDK
// `FlexibleConnectedPositionStrategy`): an ordered list of preferred positions (origin connection
// point → overlay connection point); the first that fits the viewport wins, else the best flexible fit
// (the host bounding box shrinks the pane to the space left), else the fallback pushed on-screen.
// Viewport margin, default / per-position offsets, locked position, grow-after-open, transform origin,
// panel classes per position, position change stream with scroll clipping.
//
// Ported from @angular/cdk/overlay (position/flexible-connected-position-strategy.ts,
// position/connected-position.ts), MIT, © Google LLC.
import type { OverlayReference, PositionStrategy } from "./overlay-strategy.ts";
import {
  EventStream,
  coerceArray,
  coerceCssPixelValue,
  isElementClippedByScrolling,
  isElementScrolledOutsideView,
  viewportRuler,
  type Subscribable,
  type Subscription,
  type ViewportRuler,
  type ViewportScrollPosition,
} from "./overlay-viewport.ts";
import { overlayContainer, type OverlayContainer } from "./overlay-container.ts";

export type HorizontalConnectionPos = "start" | "center" | "end";
export type VerticalConnectionPos = "top" | "center" | "bottom";
/** Distance kept between the overlay and the viewport edges. */
export type ViewportMargin = number | { top?: number; bottom?: number; start?: number; end?: number };

export interface OriginConnectionPosition {
  originX: HorizontalConnectionPos;
  originY: VerticalConnectionPos;
}

export interface OverlayConnectionPosition {
  overlayX: HorizontalConnectionPos;
  overlayY: VerticalConnectionPos;
}

/** A connected position as specified by the user. */
export interface ConnectedPosition {
  originX: HorizontalConnectionPos;
  originY: VerticalConnectionPos;
  overlayX: HorizontalConnectionPos;
  overlayY: VerticalConnectionPos;
  weight?: number;
  offsetX?: number;
  offsetY?: number;
  panelClass?: string | string[];
}

/** The points of the origin element and the overlay element to connect. */
export class ConnectionPositionPair implements ConnectedPosition {
  originX: HorizontalConnectionPos;
  originY: VerticalConnectionPos;
  overlayX: HorizontalConnectionPos;
  overlayY: VerticalConnectionPos;
  offsetX?: number;
  offsetY?: number;
  panelClass?: string | string[];
  constructor(origin: OriginConnectionPosition, overlay: OverlayConnectionPosition, offsetX?: number, offsetY?: number, panelClass?: string | string[]) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.panelClass = panelClass;
    this.originX = origin.originX;
    this.originY = origin.originY;
    this.overlayX = overlay.overlayX;
    this.overlayY = overlay.overlayY;
  }
}

/** Whether the origin / overlay are clipped by or outside the strategy's scroll containers. */
export class ScrollingVisibility {
  isOriginClipped = false;
  isOriginOutsideView = false;
  isOverlayClipped = false;
  isOverlayOutsideView = false;
}

/** Emitted when the applied position (or scroll visibility) changes. */
export class ConnectedOverlayPositionChange {
  connectionPair: ConnectedPosition;
  scrollableViewProperties: ScrollingVisibility;
  constructor(connectionPair: ConnectedPosition, scrollableViewProperties: ScrollingVisibility) {
    this.connectionPair = connectionPair;
    this.scrollableViewProperties = scrollableViewProperties;
  }
}

export function validateVerticalPosition(property: string, value: VerticalConnectionPos): void {
  if (value !== "top" && value !== "bottom" && value !== "center")
    throw Error(`ConnectedPosition: Invalid ${property} "${value}". Expected "top", "bottom" or "center".`);
}

export function validateHorizontalPosition(property: string, value: HorizontalConnectionPos): void {
  if (value !== "start" && value !== "end" && value !== "center")
    throw Error(`ConnectedPosition: Invalid ${property} "${value}". Expected "start", "end" or "center".`);
}

export const STANDARD_DROPDOWN_BELOW_POSITIONS: ConnectedPosition[] = [
  { originX: "start", originY: "bottom", overlayX: "start", overlayY: "top" },
  { originX: "start", originY: "top", overlayX: "start", overlayY: "bottom" },
  { originX: "end", originY: "bottom", overlayX: "end", overlayY: "top" },
  { originX: "end", originY: "top", overlayX: "end", overlayY: "bottom" },
];

export const STANDARD_DROPDOWN_ADJACENT_POSITIONS: ConnectedPosition[] = [
  { originX: "end", originY: "top", overlayX: "start", overlayY: "top" },
  { originX: "end", originY: "bottom", overlayX: "start", overlayY: "bottom" },
  { originX: "start", originY: "top", overlayX: "end", overlayY: "top" },
  { originX: "start", originY: "bottom", overlayX: "end", overlayY: "bottom" },
];

interface Point {
  x: number;
  y: number;
}

/** Origin: an element, or a point (optionally with a size). Deviation: no `ElementRef`. */
export type FlexibleConnectedPositionStrategyOrigin = Element | (Point & { width?: number; height?: number });

type Dimensions = { top: number; bottom: number; left: number; right: number; width: number; height: number };

interface OverlayFit {
  isCompletelyWithinViewport: boolean;
  fitsInViewportVertically: boolean;
  fitsInViewportHorizontally: boolean;
  visibleArea: number;
}

interface FallbackPosition {
  position: ConnectedPosition;
  originPoint: Point;
  overlayPoint: Point;
  overlayFit: OverlayFit;
  overlayRect: Dimensions;
}

interface BoundingBoxRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  height: number;
  width: number;
}

interface FlexibleFit {
  position: ConnectedPosition;
  origin: Point;
  overlayRect: Dimensions;
  boundingBoxRect: BoundingBoxRect;
}

const boundingBoxClass = "cdk-overlay-connected-position-bounding-box";
const cssUnitPattern = /([A-Za-z%]+)$/;

type StyleMap = Partial<
  Record<
    "top" | "left" | "right" | "bottom" | "height" | "width" | "maxHeight" | "maxWidth" | "alignItems" | "justifyContent" | "position" | "transform",
    string
  >
>;

function extendStyles(destination: CSSStyleDeclaration, source: StyleMap): void {
  for (const key in source) if (Object.hasOwn(source, key)) (destination as unknown as Record<string, string>)[key] = source[key as keyof StyleMap]!;
}

function getPixelValue(input: number | string | null | undefined): number | null {
  if (typeof input !== "number" && input != null) {
    const [value, units] = input.split(cssUnitPattern);
    return !units || units === "px" ? parseFloat(value!) : null;
  }
  return input || null;
}

function getRoundedBoundingClientRect(clientRect: Dimensions): Dimensions {
  return {
    top: Math.floor(clientRect.top),
    right: Math.floor(clientRect.right),
    bottom: Math.floor(clientRect.bottom),
    left: Math.floor(clientRect.left),
    width: Math.floor(clientRect.width),
    height: Math.floor(clientRect.height),
  };
}

function compareScrollVisibility(a: ScrollingVisibility, b: ScrollingVisibility): boolean {
  if (a === b) return true;
  return (
    a.isOriginClipped === b.isOriginClipped &&
    a.isOriginOutsideView === b.isOriginOutsideView &&
    a.isOverlayClipped === b.isOverlayClipped &&
    a.isOverlayOutsideView === b.isOverlayOutsideView
  );
}

export class FlexibleConnectedPositionStrategy implements PositionStrategy {
  private _overlayRef!: OverlayReference;
  private _isInitialRender = false;
  private _lastBoundingBoxSize = { width: 0, height: 0 };
  private _isPushed = false;
  private _canPush = true;
  private _growAfterOpen = false;
  private _hasFlexibleDimensions = true;
  private _positionLocked = false;
  private _originRect!: Dimensions;
  private _overlayRect!: Dimensions;
  private _viewportRect!: Dimensions;
  private _containerRect!: Dimensions;
  private _viewportMargin: ViewportMargin = 0;
  private _scrollables: Element[] = [];
  _preferredPositions: ConnectedPosition[] = [];
  _origin!: FlexibleConnectedPositionStrategyOrigin;
  private _pane!: HTMLElement;
  private _isDisposed = false;
  private _boundingBox: HTMLElement | null = null;
  private _lastPosition: ConnectedPosition | null = null;
  private _lastScrollVisibility: ScrollingVisibility | null = null;
  private readonly _positionChanges = new EventStream<ConnectedOverlayPositionChange>();
  private _resizeSubscription: Subscription = { unsubscribe() {} };
  private _offsetX = 0;
  private _offsetY = 0;
  private _transformOriginSelector: string | undefined;
  private _appliedPanelClasses: string[] = [];
  private _previousPushAmount: Point | null = null;

  /** Position changes (only computed while subscribed). */
  readonly positionChanges: Subscribable<ConnectedOverlayPositionChange> = this._positionChanges;

  get positions(): ConnectedPosition[] {
    return this._preferredPositions;
  }

  private _viewportRuler: ViewportRuler;
  private _document: Document;
  private _overlayContainer: OverlayContainer;

  constructor(
    connectedTo: FlexibleConnectedPositionStrategyOrigin,
    ruler: ViewportRuler = viewportRuler(),
    doc: Document = document,
    container: OverlayContainer = overlayContainer(),
  ) {
    this._viewportRuler = ruler;
    this._document = doc;
    this._overlayContainer = container;
    this.setOrigin(connectedTo);
  }

  attach(overlayRef: OverlayReference): void {
    if (this._overlayRef && overlayRef !== this._overlayRef) throw Error("This position strategy is already attached to an overlay");
    this._validatePositions();
    overlayRef.hostElement.classList.add(boundingBoxClass);
    this._overlayRef = overlayRef;
    this._boundingBox = overlayRef.hostElement;
    this._pane = overlayRef.overlayElement;
    this._isDisposed = false;
    this._isInitialRender = true;
    this._lastPosition = null;
    this._resizeSubscription.unsubscribe();
    this._resizeSubscription = this._viewportRuler.change().subscribe(() => {
      // Re-measure from scratch after a resize, as on open.
      this._isInitialRender = true;
      this.apply();
    });
  }

  /**
   * Position the overlay: the first preferred position fully inside the viewport; else (flexible
   * dimensions) the flexible fit with the largest weighted area; else (push) the fallback with the
   * largest visible area, pushed on-screen; else that fallback as is.
   */
  apply(): void {
    if (this._isDisposed || typeof window === "undefined") return;
    // Locked: keep the last position after the initial render.
    if (!this._isInitialRender && this._positionLocked && this._lastPosition) {
      this.reapplyLastPosition();
      return;
    }
    this._clearPanelClasses();
    this._resetOverlayElementStyles();
    this._resetBoundingBoxStyles();

    // Measure once (reflow); everything below uses these.
    this._viewportRect = this._getNarrowedViewportRect();
    this._originRect = this._getOriginRect();
    this._overlayRect = this._pane.getBoundingClientRect();
    this._containerRect = this._getContainerRect();

    const originRect = this._originRect,
      overlayRect = this._overlayRect,
      viewportRect = this._viewportRect,
      containerRect = this._containerRect;
    const flexibleFits: FlexibleFit[] = [];
    let fallback: FallbackPosition | undefined;

    for (const pos of this._preferredPositions) {
      const originPoint = this._getOriginPoint(originRect, containerRect, pos);
      const overlayPoint = this._getOverlayPoint(originPoint, overlayRect, pos);
      const overlayFit = this._getOverlayFit(overlayPoint, overlayRect, viewportRect, pos);
      if (overlayFit.isCompletelyWithinViewport) {
        this._isPushed = false;
        this._applyPosition(pos, originPoint);
        return;
      }
      if (this._canFitWithFlexibleDimensions(overlayFit, overlayPoint, viewportRect)) {
        flexibleFits.push({ position: pos, origin: originPoint, overlayRect, boundingBoxRect: this._calculateBoundingBoxRect(originPoint, pos) });
        continue;
      }
      if (!fallback || fallback.overlayFit.visibleArea < overlayFit.visibleArea)
        fallback = { overlayFit, overlayPoint, originPoint, position: pos, overlayRect };
    }

    if (flexibleFits.length) {
      let bestFit: FlexibleFit | null = null,
        bestScore = -1;
      for (const fit of flexibleFits) {
        const score = fit.boundingBoxRect.width * fit.boundingBoxRect.height * (fit.position.weight || 1);
        if (score > bestScore) {
          bestScore = score;
          bestFit = fit;
        }
      }
      this._isPushed = false;
      this._applyPosition(bestFit!.position, bestFit!.origin);
      return;
    }
    if (this._canPush) {
      this._isPushed = true;
      this._applyPosition(fallback!.position, fallback!.originPoint);
      return;
    }
    this._applyPosition(fallback!.position, fallback!.originPoint);
  }

  detach(): void {
    this._clearPanelClasses();
    this._lastPosition = null;
    this._previousPushAmount = null;
    this._resizeSubscription.unsubscribe();
  }

  dispose(): void {
    if (this._isDisposed) return;
    if (this._boundingBox)
      extendStyles(this._boundingBox.style, { top: "", left: "", right: "", bottom: "", height: "", width: "", alignItems: "", justifyContent: "" });
    if (this._pane) this._resetOverlayElementStyles();
    if (this._overlayRef) this._overlayRef.hostElement.classList.remove(boundingBoxClass);
    this.detach();
    this._positionChanges.complete();
    this._overlayRef = this._boundingBox = null!;
    this._isDisposed = true;
  }

  /** Re-align in the last applied position even if a preferred one fits now. */
  reapplyLastPosition(): void {
    if (this._isDisposed || typeof window === "undefined") return;
    const lastPosition = this._lastPosition;
    if (lastPosition) {
      this._originRect = this._getOriginRect();
      this._overlayRect = this._pane.getBoundingClientRect();
      this._viewportRect = this._getNarrowedViewportRect();
      this._containerRect = this._getContainerRect();
      this._applyPosition(lastPosition, this._getOriginPoint(this._originRect, this._containerRect, lastPosition));
    } else this.apply();
  }

  /** Scroll containers of the origin, for `positionChanges` clipping info. Deviation: elements. */
  withScrollableContainers(scrollables: Element[]): this {
    this._scrollables = scrollables;
    return this;
  }

  withPositions(positions: ConnectedPosition[]): this {
    this._preferredPositions = positions;
    if (positions.indexOf(this._lastPosition!) === -1) this._lastPosition = null;
    this._validatePositions();
    return this;
  }

  withViewportMargin(margin: ViewportMargin): this {
    this._viewportMargin = margin;
    return this;
  }

  withFlexibleDimensions(flexibleDimensions = true): this {
    this._hasFlexibleDimensions = flexibleDimensions;
    return this;
  }

  withGrowAfterOpen(growAfterOpen = true): this {
    this._growAfterOpen = growAfterOpen;
    return this;
  }

  withPush(canPush = true): this {
    this._canPush = canPush;
    return this;
  }

  withLockedPosition(isLocked = true): this {
    this._positionLocked = isLocked;
    return this;
  }

  setOrigin(origin: FlexibleConnectedPositionStrategyOrigin): this {
    this._origin = origin;
    return this;
  }

  withDefaultOffsetX(offset: number): this {
    this._offsetX = offset;
    return this;
  }

  withDefaultOffsetY(offset: number): this {
    this._offsetY = offset;
    return this;
  }

  /** Set `transform-origin` (matching the applied position) on elements matching `selector`. */
  withTransformOriginOn(selector: string): this {
    this._transformOriginSelector = selector;
    return this;
  }

  private _getOriginPoint(originRect: Dimensions, containerRect: Dimensions, pos: ConnectedPosition): Point {
    let x: number;
    if (pos.originX == "center") x = originRect.left + originRect.width / 2;
    else {
      const startX = this._isRtl() ? originRect.right : originRect.left;
      const endX = this._isRtl() ? originRect.left : originRect.right;
      x = pos.originX == "start" ? startX : endX;
    }
    // A container pushed off-screen (e.g. by a scrolled-to-top body with negative offset).
    if (containerRect.left < 0) x -= containerRect.left;
    let y: number;
    if (pos.originY == "center") y = originRect.top + originRect.height / 2;
    else y = pos.originY == "top" ? originRect.top : originRect.bottom;
    if (containerRect.top < 0) y -= containerRect.top;
    return { x, y };
  }

  private _getOverlayPoint(originPoint: Point, overlayRect: Dimensions, pos: ConnectedPosition): Point {
    let overlayStartX: number;
    if (pos.overlayX == "center") overlayStartX = -overlayRect.width / 2;
    else if (pos.overlayX === "start") overlayStartX = this._isRtl() ? -overlayRect.width : 0;
    else overlayStartX = this._isRtl() ? 0 : -overlayRect.width;
    let overlayStartY: number;
    if (pos.overlayY == "center") overlayStartY = -overlayRect.height / 2;
    else overlayStartY = pos.overlayY == "top" ? 0 : -overlayRect.height;
    return { x: originPoint.x + overlayStartX, y: originPoint.y + overlayStartY };
  }

  private _getOverlayFit(point: Point, rawOverlayRect: Dimensions, viewport: Dimensions, position: ConnectedPosition): OverlayFit {
    // Rounded down: sub-pixel sizes must not fail an otherwise fitting position.
    const overlay = getRoundedBoundingClientRect(rawOverlayRect);
    let { x, y } = point;
    const offsetX = this._getOffset(position, "x"),
      offsetY = this._getOffset(position, "y");
    if (offsetX) x += offsetX;
    if (offsetY) y += offsetY;
    const leftOverflow = 0 - x,
      rightOverflow = x + overlay.width - viewport.width,
      topOverflow = 0 - y,
      bottomOverflow = y + overlay.height - viewport.height;
    const visibleWidth = this._subtractOverflows(overlay.width, leftOverflow, rightOverflow);
    const visibleHeight = this._subtractOverflows(overlay.height, topOverflow, bottomOverflow);
    const visibleArea = visibleWidth * visibleHeight;
    return {
      visibleArea,
      isCompletelyWithinViewport: overlay.width * overlay.height === visibleArea,
      fitsInViewportVertically: visibleHeight === overlay.height,
      fitsInViewportHorizontally: visibleWidth == overlay.width,
    };
  }

  private _canFitWithFlexibleDimensions(fit: OverlayFit, point: Point, viewport: Dimensions): boolean {
    if (this._hasFlexibleDimensions) {
      const availableHeight = viewport.bottom - point.y;
      const availableWidth = viewport.right - point.x;
      const minHeight = getPixelValue(this._overlayRef.getConfig().minHeight);
      const minWidth = getPixelValue(this._overlayRef.getConfig().minWidth);
      const verticalFit = fit.fitsInViewportVertically || (minHeight != null && minHeight <= availableHeight);
      const horizontalFit = fit.fitsInViewportHorizontally || (minWidth != null && minWidth <= availableWidth);
      return verticalFit && horizontalFit;
    }
    return false;
  }

  private _pushOverlayOnScreen(start: Point, rawOverlayRect: Dimensions, scrollPosition: ViewportScrollPosition): Point {
    // Locked: reuse the previous push so the overlay doesn't jump while scrolling.
    if (this._previousPushAmount && this._positionLocked) return { x: start.x + this._previousPushAmount.x, y: start.y + this._previousPushAmount.y };
    const overlay = getRoundedBoundingClientRect(rawOverlayRect);
    const viewport = this._viewportRect;
    const overflowRight = Math.max(start.x + overlay.width - viewport.width, 0);
    const overflowBottom = Math.max(start.y + overlay.height - viewport.height, 0);
    const overflowTop = Math.max(viewport.top - scrollPosition.top - start.y, 0);
    const overflowLeft = Math.max(viewport.left - scrollPosition.left - start.x, 0);
    let pushX = 0,
      pushY = 0;
    // Larger than the viewport: push the top-left corner on-screen, overflow right / bottom.
    if (overlay.width <= viewport.width) pushX = overflowLeft || -overflowRight;
    else pushX = start.x < this._getViewportMarginStart() ? viewport.left - scrollPosition.left - start.x : 0;
    if (overlay.height <= viewport.height) pushY = overflowTop || -overflowBottom;
    else pushY = start.y < this._getViewportMarginTop() ? viewport.top - scrollPosition.top - start.y : 0;
    this._previousPushAmount = { x: pushX, y: pushY };
    return { x: start.x + pushX, y: start.y + pushY };
  }

  private _applyPosition(position: ConnectedPosition, originPoint: Point): void {
    this._setTransformOrigin(position);
    this._setOverlayElementStyles(originPoint, position);
    this._setBoundingBoxStyles(originPoint, position);
    if (position.panelClass) this._addPanelClasses(position.panelClass);
    // Scroll visibility costs layout reads: only while someone listens.
    if (this._positionChanges.observed) {
      const scrollVisibility = this._getScrollVisibility();
      if (position !== this._lastPosition || !this._lastScrollVisibility || !compareScrollVisibility(this._lastScrollVisibility, scrollVisibility))
        this._positionChanges.next(new ConnectedOverlayPositionChange(position, scrollVisibility));
      this._lastScrollVisibility = scrollVisibility;
    }
    this._lastPosition = position;
    this._isInitialRender = false;
  }

  private _setTransformOrigin(position: ConnectedPosition): void {
    if (!this._transformOriginSelector) return;
    const elements = this._boundingBox!.querySelectorAll<HTMLElement>(this._transformOriginSelector);
    let xOrigin: "left" | "right" | "center";
    const yOrigin = position.overlayY;
    if (position.overlayX === "center") xOrigin = "center";
    else if (this._isRtl()) xOrigin = position.overlayX === "start" ? "right" : "left";
    else xOrigin = position.overlayX === "start" ? "left" : "right";
    for (const element of elements) element.style.transformOrigin = `${xOrigin} ${yOrigin}`;
  }

  /** Bounding box (sizing wrapper) for a position: no measuring, no styles. */
  private _calculateBoundingBoxRect(origin: Point, position: ConnectedPosition): BoundingBoxRect {
    const viewport = this._viewportRect;
    const isRtl = this._isRtl();
    let height: number, top: number | undefined, bottom: number | undefined;
    if (position.overlayY === "top") {
      top = origin.y;
      height = viewport.height - top + this._getViewportMarginBottom();
    } else if (position.overlayY === "bottom") {
      // Bottom-anchored: measured from the viewport bottom (margins counted twice to cancel the top one).
      bottom = viewport.height - origin.y + this._getViewportMarginTop() + this._getViewportMarginBottom();
      height = viewport.height - bottom + this._getViewportMarginTop();
    } else {
      // Centered: twice the smaller distance to a viewport edge.
      const smallestDistanceToViewportEdge = Math.min(viewport.bottom - origin.y + viewport.top, origin.y);
      const previousHeight = this._lastBoundingBoxSize.height;
      height = smallestDistanceToViewportEdge * 2;
      top = origin.y - smallestDistanceToViewportEdge;
      if (height > previousHeight && !this._isInitialRender && !this._growAfterOpen) top = origin.y - previousHeight / 2;
    }
    const isBoundedByRightViewportEdge = (position.overlayX === "start" && !isRtl) || (position.overlayX === "end" && isRtl);
    const isBoundedByLeftViewportEdge = (position.overlayX === "end" && !isRtl) || (position.overlayX === "start" && isRtl);
    let width: number, left: number | undefined, right: number | undefined;
    if (isBoundedByLeftViewportEdge) {
      right = viewport.width - origin.x + this._getViewportMarginStart() + this._getViewportMarginEnd();
      width = origin.x - this._getViewportMarginStart();
    } else if (isBoundedByRightViewportEdge) {
      left = origin.x;
      width = viewport.right - origin.x - this._getViewportMarginEnd();
    } else {
      const smallestDistanceToViewportEdge = Math.min(viewport.right - origin.x + viewport.left, origin.x);
      const previousWidth = this._lastBoundingBoxSize.width;
      width = smallestDistanceToViewportEdge * 2;
      left = origin.x - smallestDistanceToViewportEdge;
      if (width > previousWidth && !this._isInitialRender && !this._growAfterOpen) left = origin.x - previousWidth / 2;
    }
    return { top: top!, left: left!, bottom: bottom!, right: right!, width, height };
  }

  private _setBoundingBoxStyles(origin: Point, position: ConnectedPosition): void {
    const boundingBoxRect = this._calculateBoundingBoxRect(origin, position);
    // After open the box never grows (unless withGrowAfterOpen): no resize jumps while scrolling.
    if (!this._isInitialRender && !this._growAfterOpen) {
      boundingBoxRect.height = Math.min(boundingBoxRect.height, this._lastBoundingBoxSize.height);
      boundingBoxRect.width = Math.min(boundingBoxRect.width, this._lastBoundingBoxSize.width);
    }
    const styles: StyleMap = {};
    if (this._hasExactPosition()) {
      styles.top = styles.left = "0";
      styles.bottom = styles.right = "auto";
      styles.maxHeight = styles.maxWidth = "";
      styles.width = styles.height = "100%";
    } else {
      const { maxHeight, maxWidth } = this._overlayRef.getConfig();
      styles.width = coerceCssPixelValue(boundingBoxRect.width);
      styles.height = coerceCssPixelValue(boundingBoxRect.height);
      styles.top = coerceCssPixelValue(boundingBoxRect.top) || "auto";
      styles.bottom = coerceCssPixelValue(boundingBoxRect.bottom) || "auto";
      styles.left = coerceCssPixelValue(boundingBoxRect.left) || "auto";
      styles.right = coerceCssPixelValue(boundingBoxRect.right) || "auto";
      if (position.overlayX === "center") styles.alignItems = "center";
      else styles.alignItems = position.overlayX === "end" ? "flex-end" : "flex-start";
      if (position.overlayY === "center") styles.justifyContent = "center";
      else styles.justifyContent = position.overlayY === "bottom" ? "flex-end" : "flex-start";
      if (maxHeight) styles.maxHeight = coerceCssPixelValue(maxHeight);
      if (maxWidth) styles.maxWidth = coerceCssPixelValue(maxWidth);
    }
    this._lastBoundingBoxSize = boundingBoxRect;
    extendStyles(this._boundingBox!.style, styles);
  }

  private _resetBoundingBoxStyles(): void {
    extendStyles(this._boundingBox!.style, { top: "0", left: "0", right: "0", bottom: "0", height: "", width: "", alignItems: "", justifyContent: "" });
  }

  private _resetOverlayElementStyles(): void {
    extendStyles(this._pane.style, { top: "", left: "", bottom: "", right: "", position: "", transform: "" });
  }

  private _setOverlayElementStyles(originPoint: Point, position: ConnectedPosition): void {
    const styles: StyleMap = {};
    const hasExactPosition = this._hasExactPosition();
    const hasFlexibleDimensions = this._hasFlexibleDimensions;
    const config = this._overlayRef.getConfig();
    if (hasExactPosition) {
      const scrollPosition = this._viewportRuler.getViewportScrollPosition();
      extendStyles(styles as CSSStyleDeclaration, this._getExactOverlayY(position, originPoint, scrollPosition));
      extendStyles(styles as CSSStyleDeclaration, this._getExactOverlayX(position, originPoint, scrollPosition));
    } else styles.position = "static";
    // Offsets as a transform: they must not change the bounding box (flexible size) math.
    let transformString = "";
    const offsetX = this._getOffset(position, "x"),
      offsetY = this._getOffset(position, "y");
    if (offsetX) transformString += `translateX(${offsetX}px) `;
    if (offsetY) transformString += `translateY(${offsetY}px)`;
    styles.transform = transformString.trim();
    // Flexible: max sizes live on the bounding box; exact: on the pane.
    if (config.maxHeight) {
      if (hasExactPosition) styles.maxHeight = coerceCssPixelValue(config.maxHeight);
      else if (hasFlexibleDimensions) styles.maxHeight = "";
    }
    if (config.maxWidth) {
      if (hasExactPosition) styles.maxWidth = coerceCssPixelValue(config.maxWidth);
      else if (hasFlexibleDimensions) styles.maxWidth = "";
    }
    extendStyles(this._pane.style, styles);
  }

  private _getExactOverlayY(position: ConnectedPosition, originPoint: Point, scrollPosition: ViewportScrollPosition): StyleMap {
    const styles: StyleMap = { top: "", bottom: "" };
    let overlayPoint = this._getOverlayPoint(originPoint, this._overlayRect, position);
    if (this._isPushed) overlayPoint = this._pushOverlayOnScreen(overlayPoint, this._overlayRect, scrollPosition);
    // Bottom-anchored overlays keep their bottom edge when their height changes.
    if (position.overlayY === "bottom") {
      const documentHeight = this._document.documentElement.clientHeight;
      styles.bottom = `${documentHeight - (overlayPoint.y + this._overlayRect.height)}px`;
    } else styles.top = coerceCssPixelValue(overlayPoint.y);
    return styles;
  }

  private _getExactOverlayX(position: ConnectedPosition, originPoint: Point, scrollPosition: ViewportScrollPosition): StyleMap {
    const styles: StyleMap = { left: "", right: "" };
    let overlayPoint = this._getOverlayPoint(originPoint, this._overlayRect, position);
    if (this._isPushed) overlayPoint = this._pushOverlayOnScreen(overlayPoint, this._overlayRect, scrollPosition);
    let horizontalStyleProperty: "left" | "right";
    if (this._isRtl()) horizontalStyleProperty = position.overlayX === "end" ? "left" : "right";
    else horizontalStyleProperty = position.overlayX === "end" ? "right" : "left";
    if (horizontalStyleProperty === "right") {
      const documentWidth = this._document.documentElement.clientWidth;
      styles.right = `${documentWidth - (overlayPoint.x + this._overlayRect.width)}px`;
    } else styles.left = coerceCssPixelValue(overlayPoint.x);
    return styles;
  }

  private _getScrollVisibility(): ScrollingVisibility {
    const originBounds = this._getOriginRect();
    const overlayBounds = this._pane.getBoundingClientRect();
    const scrollContainerBounds = this._scrollables.map((scrollable) => scrollable.getBoundingClientRect());
    return {
      isOriginClipped: isElementClippedByScrolling(originBounds, scrollContainerBounds),
      isOriginOutsideView: isElementScrolledOutsideView(originBounds, scrollContainerBounds),
      isOverlayClipped: isElementClippedByScrolling(overlayBounds, scrollContainerBounds),
      isOverlayOutsideView: isElementScrolledOutsideView(overlayBounds, scrollContainerBounds),
    };
  }

  private _subtractOverflows(length: number, ...overflows: number[]): number {
    return overflows.reduce((currentValue, currentOverflow) => currentValue - Math.max(currentOverflow, 0), length);
  }

  private _getNarrowedViewportRect(): Dimensions {
    // documentElement client size, not the ruler: excludes the scrollbar.
    const width = this._document.documentElement.clientWidth;
    const height = this._document.documentElement.clientHeight;
    const scrollPosition = this._viewportRuler.getViewportScrollPosition();
    return {
      top: scrollPosition.top + this._getViewportMarginTop(),
      left: scrollPosition.left + this._getViewportMarginStart(),
      right: scrollPosition.left + width - this._getViewportMarginEnd(),
      bottom: scrollPosition.top + height - this._getViewportMarginBottom(),
      width: width - this._getViewportMarginStart() - this._getViewportMarginEnd(),
      height: height - this._getViewportMarginTop() - this._getViewportMarginBottom(),
    };
  }

  private _isRtl(): boolean {
    return this._overlayRef.getDirection() === "rtl";
  }

  private _hasExactPosition(): boolean {
    return !this._hasFlexibleDimensions || this._isPushed;
  }

  private _getOffset(position: ConnectedPosition, axis: "x" | "y"): number {
    if (axis === "x") return position.offsetX == null ? this._offsetX : position.offsetX;
    return position.offsetY == null ? this._offsetY : position.offsetY;
  }

  private _validatePositions(): void {
    if (!this._preferredPositions.length) throw Error("FlexibleConnectedPositionStrategy: At least one position is required.");
    for (const pair of this._preferredPositions) {
      validateHorizontalPosition("originX", pair.originX);
      validateVerticalPosition("originY", pair.originY);
      validateHorizontalPosition("overlayX", pair.overlayX);
      validateVerticalPosition("overlayY", pair.overlayY);
    }
  }

  private _addPanelClasses(cssClasses: string | string[]): void {
    if (!this._pane) return;
    for (const cssClass of coerceArray(cssClasses))
      if (cssClass !== "" && this._appliedPanelClasses.indexOf(cssClass) === -1) {
        this._appliedPanelClasses.push(cssClass);
        this._pane.classList.add(cssClass);
      }
  }

  private _clearPanelClasses(): void {
    if (!this._pane) return;
    for (const cssClass of this._appliedPanelClasses) this._pane.classList.remove(cssClass);
    this._appliedPanelClasses = [];
  }

  private _margin(side: "start" | "end" | "top" | "bottom"): number {
    if (typeof this._viewportMargin === "number") return this._viewportMargin;
    return this._viewportMargin?.[side] ?? 0;
  }
  private _getViewportMarginStart = (): number => this._margin("start");
  private _getViewportMarginEnd = (): number => this._margin("end");
  private _getViewportMarginTop = (): number => this._margin("top");
  private _getViewportMarginBottom = (): number => this._margin("bottom");

  private _getOriginRect(): Dimensions {
    const origin = this._origin;
    if (origin instanceof Element) return origin.getBoundingClientRect();
    // Point origin (e.g. a context menu at the pointer).
    const width = origin.width || 0,
      height = origin.height || 0;
    return { top: origin.y, bottom: origin.y + height, left: origin.x, right: origin.x + width, height, width };
  }

  private _getContainerRect(): Dimensions {
    return this._overlayContainer.getContainerElement().getBoundingClientRect();
  }
}

/** A flexible connected position strategy for `origin`. */
export function createFlexibleConnectedPositionStrategy(origin: FlexibleConnectedPositionStrategyOrigin): FlexibleConnectedPositionStrategy {
  return new FlexibleConnectedPositionStrategy(origin);
}
