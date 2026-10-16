// What an attached overlay does when something scrolls (Angular CDK scroll strategies):
// `noop` nothing, `close` detach it (after `threshold` px of page scroll, repositioning until then),
// `block` block page scrolling (fixed `html` at the current offset, `.cdk-global-scrollblock`),
// `reposition` re-apply the position strategy (and `autoClose` once it is scrolled out of view).
// React Aria's equivalent of `block` is `preventScroll()` (../overlay/prevent-scroll.ts).
//
// Ported from @angular/cdk/overlay (scroll/*.ts), MIT, © Google LLC.
import { getMatScrollStrategyAlreadyAttachedError, type OverlayReference, type ScrollStrategy } from "./overlay-strategy.ts";
import {
  coerceCssPixelValue,
  filter,
  isElementScrolledOutsideView,
  scrollDispatcher,
  viewportRuler,
  type ScrollDispatcher,
  type Subscription,
  type ViewportRuler,
} from "./overlay-viewport.ts";

export type { ScrollStrategy } from "./overlay-strategy.ts";

/** Does nothing on scroll. */
export class NoopScrollStrategy implements ScrollStrategy {
  enable(): void {}
  disable(): void {}
  attach(): void {}
}

export interface CloseScrollStrategyConfig {
  /** Page scroll (px) tolerated before closing; the overlay repositions until then. */
  threshold?: number;
}

/** Detach the overlay when something outside it scrolls. */
export class CloseScrollStrategy implements ScrollStrategy {
  private _scrollSubscription: Subscription | null = null;
  private _overlayRef: OverlayReference | null = null;
  private _initialScrollPosition = 0;
  private _scrollDispatcher: ScrollDispatcher;
  private _viewportRuler: ViewportRuler;
  private _config: CloseScrollStrategyConfig | undefined;

  constructor(scrollDispatcher_: ScrollDispatcher = scrollDispatcher(), viewportRuler_: ViewportRuler = viewportRuler(), config?: CloseScrollStrategyConfig) {
    this._scrollDispatcher = scrollDispatcher_;
    this._viewportRuler = viewportRuler_;
    this._config = config;
  }

  attach(overlayRef: OverlayReference): void {
    if (this._overlayRef) throw getMatScrollStrategyAlreadyAttachedError();
    this._overlayRef = overlayRef;
  }

  enable(): void {
    if (this._scrollSubscription) return;
    // Scrolling inside the overlay does not close it.
    const stream = filter(this._scrollDispatcher.scrolled(0), (scrollable) => !scrollable || !this._overlayRef!.overlayElement.contains(scrollable));
    if (this._config && this._config.threshold && this._config.threshold > 1) {
      this._initialScrollPosition = this._viewportRuler.getViewportScrollPosition().top;
      this._scrollSubscription = stream.subscribe(() => {
        const scrollPosition = this._viewportRuler.getViewportScrollPosition().top;
        if (Math.abs(scrollPosition - this._initialScrollPosition) > this._config!.threshold!) this._detach();
        else this._overlayRef!.updatePosition();
      });
    } else this._scrollSubscription = stream.subscribe(this._detach);
  }

  disable(): void {
    if (this._scrollSubscription) {
      this._scrollSubscription.unsubscribe();
      this._scrollSubscription = null;
    }
  }

  detach(): void {
    this.disable();
    this._overlayRef = null;
  }

  private _detach = (): void => {
    this.disable();
    if (this._overlayRef?.hasAttached()) this._overlayRef.detach();
  };
}

let scrollBehaviorSupported: boolean | undefined;
const supportsScrollBehavior = (): boolean =>
  (scrollBehaviorSupported ??= typeof document !== "undefined" && "scrollBehavior" in document.documentElement.style);

/** Block page scrolling while the overlay is attached. */
export class BlockScrollStrategy implements ScrollStrategy {
  private _previousHTMLStyles = { top: "", left: "" };
  private _previousScrollPosition: { top: number; left: number } | undefined;
  private _isEnabled = false;
  private _viewportRuler: ViewportRuler;
  private _document: Document;

  constructor(viewportRuler_: ViewportRuler = viewportRuler(), document_: Document = document) {
    this._viewportRuler = viewportRuler_;
    this._document = document_;
  }

  attach(): void {}

  enable(): void {
    if (!this._canBeEnabled()) return;
    const root = this._document.documentElement;
    this._previousScrollPosition = this._viewportRuler.getViewportScrollPosition();
    // Keep inline styles the page set itself.
    this._previousHTMLStyles.left = root.style.left || "";
    this._previousHTMLStyles.top = root.style.top || "";
    // `html`, not `body`: body may carry the UA margin.
    root.style.left = coerceCssPixelValue(-this._previousScrollPosition.left);
    root.style.top = coerceCssPixelValue(-this._previousScrollPosition.top);
    root.classList.add("cdk-global-scrollblock");
    this._isEnabled = true;
  }

  disable(): void {
    if (!this._isEnabled) return;
    const html = this._document.documentElement,
      body = this._document.body;
    const htmlStyle = html.style,
      bodyStyle = body.style;
    const previousHtmlScrollBehavior = htmlStyle.scrollBehavior || "",
      previousBodyScrollBehavior = bodyStyle.scrollBehavior || "";
    this._isEnabled = false;
    htmlStyle.left = this._previousHTMLStyles.left;
    htmlStyle.top = this._previousHTMLStyles.top;
    html.classList.remove("cdk-global-scrollblock");
    // No smooth scrolling while restoring the position (only where scroll-behavior exists: setting
    // it elsewhere would fool the feature detection).
    if (supportsScrollBehavior()) htmlStyle.scrollBehavior = bodyStyle.scrollBehavior = "auto";
    (this._document.defaultView ?? window).scroll(this._previousScrollPosition!.left, this._previousScrollPosition!.top);
    if (supportsScrollBehavior()) {
      htmlStyle.scrollBehavior = previousHtmlScrollBehavior;
      bodyStyle.scrollBehavior = previousBodyScrollBehavior;
    }
  }

  // The global class guards against double blocking (strategies are not singletons); a page that
  // does not scroll needs no block.
  private _canBeEnabled(): boolean {
    const html = this._document.documentElement;
    if (html.classList.contains("cdk-global-scrollblock") || this._isEnabled) return false;
    const viewport = this._viewportRuler.getViewportSize();
    return html.scrollHeight > viewport.height || html.scrollWidth > viewport.width;
  }
}

export interface RepositionScrollStrategyConfig {
  /** Throttle of position updates (ms). */
  scrollThrottle?: number;
  /** Detach once the overlay is scrolled out of the viewport. */
  autoClose?: boolean;
}

/** Re-position the overlay on scroll. */
export class RepositionScrollStrategy implements ScrollStrategy {
  private _scrollSubscription: Subscription | null = null;
  private _overlayRef: OverlayReference | null = null;
  private _scrollDispatcher: ScrollDispatcher;
  private _viewportRuler: ViewportRuler;
  private _config: RepositionScrollStrategyConfig | undefined;

  constructor(
    scrollDispatcher_: ScrollDispatcher = scrollDispatcher(),
    viewportRuler_: ViewportRuler = viewportRuler(),
    config?: RepositionScrollStrategyConfig,
  ) {
    this._scrollDispatcher = scrollDispatcher_;
    this._viewportRuler = viewportRuler_;
    this._config = config;
  }

  attach(overlayRef: OverlayReference): void {
    if (this._overlayRef) throw getMatScrollStrategyAlreadyAttachedError();
    this._overlayRef = overlayRef;
  }

  enable(): void {
    if (this._scrollSubscription) return;
    const throttle = this._config ? (this._config.scrollThrottle ?? 0) : 0;
    this._scrollSubscription = this._scrollDispatcher.scrolled(throttle).subscribe(() => {
      const overlayRef = this._overlayRef;
      if (!overlayRef) return;
      overlayRef.updatePosition();
      if (this._config && this._config.autoClose) {
        const overlayRect = overlayRef.overlayElement.getBoundingClientRect();
        const { width, height } = this._viewportRuler.getViewportSize();
        // The viewport only (Angular: ancestors once the trigger is known to the strategy).
        const parentRects = [{ width, height, bottom: height, right: width, top: 0, left: 0 }];
        if (isElementScrolledOutsideView(overlayRect, parentRects)) {
          this.disable();
          overlayRef.detach();
        }
      }
    });
  }

  disable(): void {
    if (this._scrollSubscription) {
      this._scrollSubscription.unsubscribe();
      this._scrollSubscription = null;
    }
  }

  detach(): void {
    this.disable();
    this._overlayRef = null;
  }
}

export const createNoopScrollStrategy = (): NoopScrollStrategy => new NoopScrollStrategy();
export const createCloseScrollStrategy = (config?: CloseScrollStrategyConfig): CloseScrollStrategy => new CloseScrollStrategy(undefined, undefined, config);
export const createBlockScrollStrategy = (): BlockScrollStrategy => new BlockScrollStrategy();
export const createRepositionScrollStrategy = (config?: RepositionScrollStrategyConfig): RepositionScrollStrategy =>
  new RepositionScrollStrategy(undefined, undefined, config);

/** Factories of the scroll strategies (Angular `ScrollStrategyOptions`, `overlay.scrollStrategies`). */
export class ScrollStrategyOptions {
  noop = (): NoopScrollStrategy => createNoopScrollStrategy();
  close = (config?: CloseScrollStrategyConfig): CloseScrollStrategy => createCloseScrollStrategy(config);
  block = (): BlockScrollStrategy => createBlockScrollStrategy();
  reposition = (config?: RepositionScrollStrategyConfig): RepositionScrollStrategy => createRepositionScrollStrategy(config);
}
