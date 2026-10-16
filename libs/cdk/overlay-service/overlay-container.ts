// The container Angular-style overlays render into (Angular CDK `OverlayContainer`; the div overlay
// layer, never the native top layer): one `<div data-rivet-portal class="cdk-overlay-container">` at the
// end of body, created on first use.
// Deviation (one overlay layer): the container is a portal host like the React Aria-style overlays'
// (`<Portal>` hosts, `div[data-rivet-portal]`) and `bringToFront()` (called on every attach) moves it back
// to the end of its parent, so the most recently opened overlay of either kind stacks last; both share
// the z-index base 100000 (`overlay.css`, `overlayPosition`). `FullscreenOverlayContainer` moves it into the fullscreen element while one is active.
// Styles: `@rivetjs/cdk/overlay.css` (Angular loads them on first use; Rivet ships a stylesheet —
// no style injection, CSP-safe).
//
// Ported from @angular/cdk/overlay (overlay-container.ts, fullscreen-overlay-container.ts), MIT, © Google LLC.

export class OverlayContainer {
  protected _containerElement: HTMLElement | undefined;
  protected _document: Document;

  constructor(document_: Document = document) {
    this._document = document_;
  }

  /** Remove the container. */
  ngOnDestroy(): void {
    this._containerElement?.remove();
    this._containerElement = undefined;
  }

  /** The container element (created on first call). */
  getContainerElement(): HTMLElement {
    if (!this._containerElement || !this._containerElement.isConnected) this._createContainer();
    return this._containerElement!;
  }

  /** Move the container to the end of its parent (stack above overlays opened before it). */
  bringToFront(): void {
    const container = this._containerElement;
    const parent = container?.parentNode;
    if (container && parent && container.nextSibling) parent.appendChild(container);
  }

  protected _createContainer(): void {
    const containerClass = "cdk-overlay-container";
    // Server-rendered or stale test containers of another instance (Angular removes the opposite platform's).
    for (const old of this._document.querySelectorAll(`.${containerClass}[platform="server"], .${containerClass}[platform="test"]`)) old.remove();
    const container = this._document.createElement("div");
    container.setAttribute("data-rivet-portal", "");
    container.classList.add(containerClass);
    this._document.body.appendChild(container);
    this._containerElement = container;
  }
}

/** An `OverlayContainer` that follows the fullscreen element (overlays stay visible in fullscreen). */
export class FullscreenOverlayContainer extends OverlayContainer {
  private _fullScreenEventName: string | undefined;
  private _cleanupFullScreenListener: (() => void) | undefined;

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._cleanupFullScreenListener?.();
  }

  protected override _createContainer(): void {
    const eventName = this._getEventName();
    super._createContainer();
    this._adjustParentForFullscreenChange();
    if (eventName) {
      this._cleanupFullScreenListener?.();
      const listener = () => this._adjustParentForFullscreenChange();
      this._document.addEventListener(eventName, listener);
      this._cleanupFullScreenListener = () => this._document.removeEventListener(eventName, listener);
    }
  }

  private _adjustParentForFullscreenChange(): void {
    if (this._containerElement) (this.getFullscreenElement() || this._document.body).appendChild(this._containerElement);
  }

  private _getEventName(): string | undefined {
    if (!this._fullScreenEventName) {
      const doc = this._document as Document & { webkitFullscreenEnabled?: boolean };
      if (doc.fullscreenEnabled) this._fullScreenEventName = "fullscreenchange";
      else if (doc.webkitFullscreenEnabled) this._fullScreenEventName = "webkitfullscreenchange";
    }
    return this._fullScreenEventName;
  }

  /** The current fullscreen element, if any. */
  getFullscreenElement(): Element | null {
    const doc = this._document as Document & { webkitFullscreenElement?: Element | null };
    return doc.fullscreenElement || doc.webkitFullscreenElement || null;
  }
}

let shared: OverlayContainer | undefined;
/** The shared overlay container (created on first use). */
export const overlayContainer = (): OverlayContainer => (shared ??= new OverlayContainer());
/** Replace the shared container (e.g. with a `FullscreenOverlayContainer`); Angular's DI override. */
export function provideOverlayContainer(container: OverlayContainer): void {
  shared = container;
}
