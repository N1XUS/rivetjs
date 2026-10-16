// Angular CDK overlays: `createOverlayRef(config)` creates a floating panel (pane) inside a host;
// content is attached as a portal (../portal/portal-outlet.ts); a position strategy places it and a scroll
// strategy decides what scrolling does. The host goes into the overlay container
// (./overlay-container.ts), the div overlay layer every cdk overlay shares.
// Deviation: no native top layer — Angular v20+ renders hosts as `popover="manual"` by default
// (`usePopover`, `OVERLAY_DEFAULT_CONFIG.usePopover`, `withPopoverLocation`); Rivet removed that path
// (one div overlay layer: the container is one `div[data-rivet-portal]` host at the end of body, moved
// back to the end on every attach so the most recently attached overlay stacks last).
// Styles: `@rivetjs/cdk/overlay.css`.
// Observables are `Subscribable` streams (./overlay-viewport.ts); Angular `signal` → reactivity signal.
//
// Ported from @angular/cdk/overlay (overlay.ts, overlay-ref.ts, overlay-config.ts, backdrop-ref.ts), MIT, © Google LLC.
import { signal, untrack } from "@rivetjs/reactivity";
import type { Direction } from "../bidi/index.ts";
import { overlayContainer, type OverlayContainer } from "./overlay-container.ts";
import {
  overlayKeyboardDispatcher,
  overlayOutsideClickDispatcher,
  type OverlayKeyboardDispatcher,
  type OverlayOutsideClickDispatcher,
} from "./overlay-dispatchers.ts";
import type { OverlayReference, PositionStrategy, ScrollStrategy } from "./overlay-strategy.ts";
import { coerceArray, coerceCssPixelValue, EventStream, type Subscribable } from "./overlay-viewport.ts";
import { DomPortalOutlet, type Portal, type PortalOutlet } from "../portal/portal-outlet.ts";

export type { PositionStrategy, ScrollStrategy } from "./overlay-strategy.ts";

/** `true` / `"pop-state"`: dispose on back / forward; `"url-change"`: on any URL change; `false`: never. */
export type OverlayDisposeOnNavigation = boolean | "url-change" | "pop-state";

/** A direction, or a Directionality-like object whose `value` is read when needed. */
export type DirectionSource = Direction | { readonly value: Direction };

/** Size properties of an overlay. */
export interface OverlaySizeConfig {
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
}

/** Initial configuration of an overlay. */
export class OverlayConfig implements OverlaySizeConfig {
  positionStrategy?: PositionStrategy;
  scrollStrategy?: ScrollStrategy = { enable() {}, disable() {}, attach() {} };
  panelClass?: string | string[] = "";
  hasBackdrop?: boolean = false;
  backdropClass?: string | string[] = "cdk-overlay-dark-backdrop";
  disableAnimations?: boolean;
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  direction?: DirectionSource;
  disposeOnNavigation?: OverlayDisposeOnNavigation = false;
  /** Whether this overlay receives a dispatched event (else the next one in the stack does). */
  eventPredicate?: (event: Event) => boolean;

  constructor(config?: Partial<OverlayConfig>) {
    if (config)
      for (const key of Object.keys(config) as (keyof OverlayConfig)[]) if (config[key] !== undefined) (this as Record<string, unknown>)[key] = config[key];
  }
}

const attachedOverlaysInternal = signal<readonly OverlayRef[]>([]);
/** All currently attached overlays (read-only signal). */
export const attachedOverlays = (): readonly OverlayRef[] => attachedOverlaysInternal();

/** Whether `value` is an element. */
export const isElement = (value: unknown): value is Element => !!value && (value as Element).nodeType === 1;

/** A backdrop behind an overlay. */
export class BackdropRef {
  readonly element: HTMLElement;
  private _cleanupClick: (() => void) | undefined;
  private _cleanupTransitionEnd: (() => void) | undefined;
  private _fallbackTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(document_: Document, onClick: (event: MouseEvent) => void) {
    this.element = document_.createElement("div");
    this.element.classList.add("cdk-overlay-backdrop");
    this.element.addEventListener("click", onClick);
    this._cleanupClick = () => this.element.removeEventListener("click", onClick);
  }

  /** Fade out (transitionend, or 500 ms without a transition), then remove. */
  detach(): void {
    const element = this.element;
    clearTimeout(this._fallbackTimeout);
    this._cleanupTransitionEnd?.();
    element.addEventListener("transitionend", this.dispose);
    this._cleanupTransitionEnd = () => element.removeEventListener("transitionend", this.dispose);
    this._fallbackTimeout = setTimeout(this.dispose, 500);
    // Without a transition no transitionend fires: unclickable until removed.
    element.style.pointerEvents = "none";
    element.classList.remove("cdk-overlay-backdrop-showing");
  }

  dispose = (): void => {
    clearTimeout(this._fallbackTimeout);
    this._cleanupClick?.();
    this._cleanupTransitionEnd?.();
    this._cleanupClick = this._cleanupTransitionEnd = this._fallbackTimeout = undefined;
    this.element.remove();
  };
}

/** Collaborators of an `OverlayRef` (Angular injects them). */
export interface OverlayRefDeps {
  document?: Document;
  keyboardDispatcher?: OverlayKeyboardDispatcher;
  outsideClickDispatcher?: OverlayOutsideClickDispatcher;
}

/** A created overlay: attach content, position it, dispose it. */
export class OverlayRef implements PortalOutlet, OverlayReference {
  private readonly _backdropClick = new EventStream<MouseEvent>();
  private readonly _attachments = new EventStream<void>();
  private readonly _detachments = new EventStream<void>();
  private _positionStrategy: PositionStrategy | undefined;
  private _scrollStrategy: ScrollStrategy | undefined;
  private _locationChanges: (() => void) | undefined;
  private _backdropRef: BackdropRef | null = null;
  private _detachContentMutationObserver: MutationObserver | undefined;
  private _detachContentFrame: number | undefined;
  private _disposed = false;
  private _previousHostParent: HTMLElement | null = null;
  private _afterNextRender: number | undefined;
  /** Keydown events dispatched to this overlay. */
  readonly _keydownEvents = new EventStream<KeyboardEvent>();
  /** Pointer events outside this overlay. */
  readonly _outsidePointerEvents = new EventStream<MouseEvent>();

  private _portalOutlet: PortalOutlet;
  private _host: HTMLElement;
  private _pane: HTMLElement;
  private _config: OverlayConfig;
  private _keyboardDispatcher: OverlayKeyboardDispatcher;
  private _document: Document;
  private _outsideClickDispatcher: OverlayOutsideClickDispatcher;
  private _animationsDisabled: boolean;
  /** Rivet: the container the host lives in (moved to the end of body on attach: one overlay layer). */
  _container: OverlayContainer | null = null;

  constructor(
    portalOutlet: PortalOutlet,
    host: HTMLElement,
    pane: HTMLElement,
    config: OverlayConfig,
    keyboardDispatcher: OverlayKeyboardDispatcher,
    document_: Document,
    outsideClickDispatcher: OverlayOutsideClickDispatcher,
    animationsDisabled = false,
  ) {
    this._portalOutlet = portalOutlet;
    this._host = host;
    this._pane = pane;
    this._config = config;
    this._keyboardDispatcher = keyboardDispatcher;
    this._document = document_;
    this._outsideClickDispatcher = outsideClickDispatcher;
    this._animationsDisabled = animationsDisabled;
    if (config.scrollStrategy) {
      this._scrollStrategy = config.scrollStrategy;
      this._scrollStrategy.attach(this);
    }
    this._positionStrategy = config.positionStrategy;
  }

  /** The pane holding the content. */
  get overlayElement(): HTMLElement {
    return this._pane;
  }

  /** The backdrop element, if any. */
  get backdropElement(): HTMLElement | null {
    return this._backdropRef?.element || null;
  }

  /** Wrapper around the pane (positioning wrappers, popover host). */
  get hostElement(): HTMLElement {
    return this._host;
  }

  /** Filter of dispatched events. */
  get eventPredicate(): ((event: Event) => boolean) | null {
    return this._config?.eventPredicate || null;
  }

  /** Attach content (creates the backdrop if configured); returns the portal's attach result. */
  attach<T>(portal: Portal<T>): T;
  attach(portal: Portal<unknown>): unknown;
  attach(portal: Portal<unknown>): unknown {
    if (this._disposed) return null;
    this._attachHost();
    const attachResult = this._portalOutlet.attach(portal) as { onDestroy?: (fn: () => void) => void } | null;
    this._positionStrategy?.attach(this);
    this._updateStackingOrder();
    this._updateElementSize();
    this._updateElementDirection();
    untrack(() => {
      const prev = attachedOverlaysInternal();
      if (!prev.includes(this)) attachedOverlaysInternal.set([...prev, this]);
    });
    this._scrollStrategy?.enable();
    // afterNextRender: position once the content has rendered.
    if (this._afterNextRender !== undefined) cancelAnimationFrame(this._afterNextRender);
    this._afterNextRender = requestAnimationFrame(() => {
      this._afterNextRender = undefined;
      if (this.hasAttached()) this.updatePosition();
    });
    this._togglePointerEvents(true);
    if (this._config.hasBackdrop) this._attachBackdrop();
    if (this._config.panelClass) this._toggleClasses(this._pane, this._config.panelClass, true);
    this._attachments.next();
    this._completeDetachContent();
    this._keyboardDispatcher.add(this);
    if (this._config.disposeOnNavigation === true || this._config.disposeOnNavigation === "pop-state") {
      const view = this._document.defaultView ?? window;
      const listener = () => this.dispose();
      view.addEventListener("popstate", listener);
      this._locationChanges = () => view.removeEventListener("popstate", listener);
    } else if (this._config.disposeOnNavigation === "url-change") {
      this._locationChanges = onUrlChange(this._document, () => this.dispose());
    }
    this._outsideClickDispatcher.add(this);
    // Content destroyed elsewhere: detach.
    if (typeof attachResult?.onDestroy === "function")
      attachResult.onDestroy(() => {
        if (this.hasAttached()) void Promise.resolve().then(() => this.detach());
      });
    return attachResult;
  }

  /** Detach the content; returns the outlet's detach result. */
  detach(): unknown {
    if (!this.hasAttached()) return;
    this.detachBackdrop();
    this._togglePointerEvents(false);
    this._positionStrategy?.detach?.();
    this._scrollStrategy?.disable();
    const detachmentResult = this._portalOutlet.detach();
    this._detachments.next();
    this._completeDetachContent();
    this._keyboardDispatcher.remove(this);
    this._detachContentWhenEmpty();
    this._locationChanges?.();
    this._outsideClickDispatcher.remove(this);
    untrack(() => attachedOverlaysInternal.set(attachedOverlaysInternal().filter((o) => o !== this)));
    return detachmentResult;
  }

  /** Remove the overlay from the DOM and release everything. */
  dispose(): void {
    if (this._disposed) return;
    const isAttached = this.hasAttached();
    this._positionStrategy?.dispose();
    this._disposeScrollStrategy();
    this._backdropRef?.dispose();
    this._locationChanges?.();
    this._keyboardDispatcher.remove(this);
    this._portalOutlet.dispose();
    this._attachments.complete();
    this._backdropClick.complete();
    this._keydownEvents.complete();
    this._outsidePointerEvents.complete();
    this._outsideClickDispatcher.remove(this);
    this._host?.remove();
    if (this._afterNextRender !== undefined) cancelAnimationFrame(this._afterNextRender);
    this._previousHostParent = this._backdropRef = null;
    this._pane = this._host = null!;
    if (isAttached) this._detachments.next();
    this._detachments.complete();
    this._completeDetachContent();
    this._disposed = true;
    untrack(() => attachedOverlaysInternal.set(attachedOverlaysInternal().filter((o) => o !== this)));
  }

  hasAttached(): boolean {
    return this._portalOutlet.hasAttached();
  }

  /** Clicks on the backdrop. */
  backdropClick(): Subscribable<MouseEvent> {
    return this._backdropClick;
  }

  /** Emits when content is attached. */
  attachments(): Subscribable<void> {
    return this._attachments;
  }

  /** Emits when content is detached. */
  detachments(): Subscribable<void> {
    return this._detachments;
  }

  /** Keydown events targeted at this overlay (top-most listening overlay). */
  keydownEvents(): Subscribable<KeyboardEvent> {
    return this._keydownEvents;
  }

  /** Pointer events outside this overlay. */
  outsidePointerEvents(): Subscribable<MouseEvent> {
    return this._outsidePointerEvents;
  }

  getConfig(): OverlayConfig & { direction?: Direction } {
    return this._config as OverlayConfig & { direction?: Direction };
  }

  /** Re-apply the position strategy. */
  updatePosition(): void {
    this._positionStrategy?.apply();
  }

  /** Switch the position strategy (and position). */
  updatePositionStrategy(strategy: PositionStrategy): void {
    if (strategy === this._positionStrategy) return;
    this._positionStrategy?.dispose();
    this._positionStrategy = strategy;
    if (this.hasAttached()) {
      strategy.attach(this);
      this.updatePosition();
    }
  }

  /** Update the size properties. */
  updateSize(sizeConfig: OverlaySizeConfig): void {
    this._config = new OverlayConfig({ ...this._config, ...sizeConfig });
    this._updateElementSize();
  }

  /** Set the text direction. */
  setDirection(dir: DirectionSource): void {
    this._config = new OverlayConfig({ ...this._config, direction: dir });
    this._updateElementDirection();
  }

  addPanelClass(classes: string | string[]): void {
    if (this._pane) this._toggleClasses(this._pane, classes, true);
  }

  removePanelClass(classes: string | string[]): void {
    if (this._pane) this._toggleClasses(this._pane, classes, false);
  }

  /** Layout direction of the panel. */
  getDirection(): Direction {
    const direction = this._config.direction;
    if (!direction) return "ltr";
    return typeof direction === "string" ? direction : direction.value;
  }

  /** Switch the scroll strategy. */
  updateScrollStrategy(strategy: ScrollStrategy): void {
    if (strategy === this._scrollStrategy) return;
    this._disposeScrollStrategy();
    this._scrollStrategy = strategy;
    if (this.hasAttached()) {
      strategy.attach(this);
      strategy.enable();
    }
  }

  private _updateElementDirection(): void {
    this._host.setAttribute("dir", this.getDirection());
  }

  private _updateElementSize(): void {
    if (!this._pane) return;
    const style = this._pane.style;
    style.width = coerceCssPixelValue(this._config.width);
    style.height = coerceCssPixelValue(this._config.height);
    style.minWidth = coerceCssPixelValue(this._config.minWidth);
    style.minHeight = coerceCssPixelValue(this._config.minHeight);
    style.maxWidth = coerceCssPixelValue(this._config.maxWidth);
    style.maxHeight = coerceCssPixelValue(this._config.maxHeight);
  }

  private _togglePointerEvents(enablePointer: boolean): void {
    this._pane.style.pointerEvents = enablePointer ? "" : "none";
  }

  private _attachHost(): void {
    if (!this._host.parentElement) this._previousHostParent?.appendChild(this._host);
    // One overlay layer: the container goes back to the end of its parent, after the React Aria-style
    // portal hosts, so this overlay stacks above every overlay opened before it.
    this._container?.bringToFront();
  }

  private _attachBackdrop(): void {
    const showingClass = "cdk-overlay-backdrop-showing";
    this._backdropRef?.dispose();
    this._backdropRef = new BackdropRef(this._document, (event) => this._backdropClick.next(event));
    if (this._animationsDisabled) this._backdropRef.element.classList.add("cdk-overlay-backdrop-noop-animation");
    if (this._config.backdropClass) this._toggleClasses(this._backdropRef.element, this._config.backdropClass, true);
    this._host.parentElement!.insertBefore(this._backdropRef.element, this._host);
    // Next frame, so the opacity transition runs.
    if (!this._animationsDisabled && typeof requestAnimationFrame !== "undefined")
      requestAnimationFrame(() => this._backdropRef?.element.classList.add(showingClass));
    else this._backdropRef.element.classList.add(showingClass);
  }

  // A detached overlay that is re-attached after another one was destroyed would stay below it:
  // move the host to the end of the container.
  private _updateStackingOrder(): void {
    if (this._host.nextSibling) this._host.parentNode!.appendChild(this._host);
  }

  /** Detach the backdrop (fades out unless animations are disabled). */
  detachBackdrop(): void {
    if (this._animationsDisabled) {
      this._backdropRef?.dispose();
      this._backdropRef = null;
    } else this._backdropRef?.detach();
  }

  private _toggleClasses(element: HTMLElement, cssClasses: string | string[], isAdd: boolean): void {
    const classes = coerceArray(cssClasses || []).filter((c) => !!c);
    if (classes.length) {
      if (isAdd) element.classList.add(...classes);
      else element.classList.remove(...classes);
    }
  }

  // Remove the host once the content finished animating out (pane empty): next frame, or when the
  // pane's children change.
  private _detachContentWhenEmpty(): void {
    this._detachContentFrame = requestAnimationFrame(() => this._detachContent());
    if (globalThis.MutationObserver && this._pane) {
      this._detachContentMutationObserver ||= new globalThis.MutationObserver(() => this._detachContent());
      this._detachContentMutationObserver.observe(this._pane, { childList: true });
    }
  }

  private _detachContent(): void {
    if (!this._pane || !this._host || this._pane.children.length === 0) {
      if (this._pane && this._config.panelClass) this._toggleClasses(this._pane, this._config.panelClass, false);
      if (this._host && this._host.parentElement) {
        this._previousHostParent = this._host.parentElement;
        this._host.remove();
      }
      this._completeDetachContent();
    }
  }

  private _completeDetachContent(): void {
    if (this._detachContentFrame !== undefined) cancelAnimationFrame(this._detachContentFrame);
    this._detachContentFrame = undefined;
    this._detachContentMutationObserver?.disconnect();
  }

  private _disposeScrollStrategy(): void {
    const scrollStrategy = this._scrollStrategy;
    scrollStrategy?.disable();
    scrollStrategy?.detach?.();
  }
}

// Any URL change (Angular `Location.onUrlChange`): the Navigation API, else popstate + hashchange.
function onUrlChange(document_: Document, fn: () => void): () => void {
  const view = (document_.defaultView ?? window) as Window & { navigation?: EventTarget };
  if (view.navigation) {
    view.navigation.addEventListener("currententrychange", fn);
    return () => view.navigation!.removeEventListener("currententrychange", fn);
  }
  view.addEventListener("popstate", fn);
  view.addEventListener("hashchange", fn);
  return () => {
    view.removeEventListener("popstate", fn);
    view.removeEventListener("hashchange", fn);
  };
}

let ids = 0;

/** Overrides of the defaults `createOverlayRef` uses. */
export interface CreateOverlayOptions extends OverlayRefDeps {
  container?: OverlayContainer;
}

/** Create an overlay (Angular `createOverlayRef` / `Overlay.create`). Browser only. */
export function createOverlayRef(config?: Partial<OverlayConfig>, options: CreateOverlayOptions = {}): OverlayRef {
  const doc = options.document ?? document;
  const overlayConfig = new OverlayConfig(config);
  overlayConfig.direction = overlayConfig.direction || ((doc.documentElement.dir || "ltr").toLowerCase() === "rtl" ? "rtl" : "ltr");

  const pane = doc.createElement("div");
  const host = doc.createElement("div");
  pane.id = `cdk-overlay-${ids++}`;
  pane.classList.add("cdk-overlay-pane");
  host.appendChild(pane);
  const container = options.container ?? overlayContainer();
  container.getContainerElement().appendChild(host);

  const ref = new OverlayRef(
    new DomPortalOutlet(pane),
    host,
    pane,
    overlayConfig,
    options.keyboardDispatcher ?? overlayKeyboardDispatcher(),
    doc,
    options.outsideClickDispatcher ?? overlayOutsideClickDispatcher(),
    config?.disableAnimations ?? false,
  );
  ref._container = container;
  return ref;
}
