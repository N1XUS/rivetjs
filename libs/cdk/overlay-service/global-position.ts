// Position an overlay relative to the viewport (Angular CDK `GlobalPositionStrategy`): the host
// becomes a full-viewport flex wrapper (`.cdk-global-overlay-wrapper`) and the pane is aligned with
// margins — top / bottom / left / right / start / end offsets, centering, width / height.
//
// Ported from @angular/cdk/overlay (position/global-position-strategy.ts), MIT, © Google LLC.
import type { OverlayReference, PositionStrategy } from "./overlay-strategy.ts";

const wrapperClass = "cdk-global-overlay-wrapper";

export class GlobalPositionStrategy implements PositionStrategy {
  private _overlayRef: OverlayReference | null = null;
  private _cssPosition = "static";
  private _topOffset = "";
  private _bottomOffset = "";
  private _alignItems = "";
  private _xPosition = "";
  private _xOffset = "";
  private _width = "";
  private _height = "";
  private _isDisposed = false;

  attach(overlayRef: OverlayReference): void {
    const config = overlayRef.getConfig();
    this._overlayRef = overlayRef;
    if (this._width && !config.width) overlayRef.updateSize({ width: this._width });
    if (this._height && !config.height) overlayRef.updateSize({ height: this._height });
    overlayRef.hostElement.classList.add(wrapperClass);
    this._isDisposed = false;
  }

  /** Top offset (clears bottom). */
  top(value = ""): this {
    this._bottomOffset = "";
    this._topOffset = value;
    this._alignItems = "flex-start";
    return this;
  }

  left(value = ""): this {
    this._xOffset = value;
    this._xPosition = "left";
    return this;
  }

  /** Bottom offset (clears top). */
  bottom(value = ""): this {
    this._topOffset = "";
    this._bottomOffset = value;
    this._alignItems = "flex-end";
    return this;
  }

  right(value = ""): this {
    this._xOffset = value;
    this._xPosition = "right";
    return this;
  }

  /** Offset from the start edge (left in LTR, right in RTL). */
  start(value = ""): this {
    this._xOffset = value;
    this._xPosition = "start";
    return this;
  }

  /** Offset from the end edge. */
  end(value = ""): this {
    this._xOffset = value;
    this._xPosition = "end";
    return this;
  }

  /** @deprecated Angular: use the overlay's `width` config. */
  width(value = ""): this {
    if (this._overlayRef) this._overlayRef.updateSize({ width: value });
    else this._width = value;
    return this;
  }

  /** @deprecated Angular: use the overlay's `height` config. */
  height(value = ""): this {
    if (this._overlayRef) this._overlayRef.updateSize({ height: value });
    else this._height = value;
    return this;
  }

  centerHorizontally(offset = ""): this {
    this.left(offset);
    this._xPosition = "center";
    return this;
  }

  centerVertically(offset = ""): this {
    this.top(offset);
    this._alignItems = "center";
    return this;
  }

  apply(): void {
    // Applied asynchronously: the overlay may be gone.
    if (!this._overlayRef || !this._overlayRef.hasAttached()) return;
    const styles = this._overlayRef.overlayElement.style;
    const parentStyles = this._overlayRef.hostElement.style;
    const config = this._overlayRef.getConfig();
    const { width, height, maxWidth, maxHeight } = config;
    const shouldBeFlushHorizontally = (width === "100%" || width === "100vw") && (!maxWidth || maxWidth === "100%" || maxWidth === "100vw");
    const shouldBeFlushVertically = (height === "100%" || height === "100vh") && (!maxHeight || maxHeight === "100%" || maxHeight === "100vh");
    const xPosition = this._xPosition;
    const xOffset = this._xOffset;
    const isRtl = this._overlayRef.getDirection() === "rtl";
    let marginLeft = "",
      marginRight = "",
      justifyContent = "";
    if (shouldBeFlushHorizontally) justifyContent = "flex-start";
    else if (xPosition === "center") {
      justifyContent = "center";
      if (isRtl) marginRight = xOffset;
      else marginLeft = xOffset;
    } else if (isRtl) {
      if (xPosition === "left" || xPosition === "end") {
        justifyContent = "flex-end";
        marginLeft = xOffset;
      } else if (xPosition === "right" || xPosition === "start") {
        justifyContent = "flex-start";
        marginRight = xOffset;
      }
    } else if (xPosition === "left" || xPosition === "start") {
      justifyContent = "flex-start";
      marginLeft = xOffset;
    } else if (xPosition === "right" || xPosition === "end") {
      justifyContent = "flex-end";
      marginRight = xOffset;
    }
    styles.position = this._cssPosition;
    styles.marginLeft = shouldBeFlushHorizontally ? "0" : marginLeft;
    styles.marginTop = shouldBeFlushVertically ? "0" : this._topOffset;
    styles.marginBottom = this._bottomOffset;
    styles.marginRight = shouldBeFlushHorizontally ? "0" : marginRight;
    parentStyles.justifyContent = justifyContent;
    parentStyles.alignItems = shouldBeFlushVertically ? "flex-start" : this._alignItems;
  }

  dispose(): void {
    if (this._isDisposed || !this._overlayRef) return;
    const styles = this._overlayRef.overlayElement.style;
    const parent = this._overlayRef.hostElement;
    const parentStyles = parent.style;
    parent.classList.remove(wrapperClass);
    parentStyles.justifyContent =
      parentStyles.alignItems =
      styles.marginTop =
      styles.marginBottom =
      styles.marginLeft =
      styles.marginRight =
      styles.position =
        "";
    this._overlayRef = null;
    this._isDisposed = true;
  }
}

/** A new `GlobalPositionStrategy` (Angular `createGlobalPositionStrategy`). */
export const createGlobalPositionStrategy = (): GlobalPositionStrategy => new GlobalPositionStrategy();
