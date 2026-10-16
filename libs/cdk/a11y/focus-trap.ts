// FocusTrap (tab anchors before / after the region, `cdkFocusRegionStart` / `End` / `cdkFocusInitial`
// markers), FocusTrapFactory, the CdkTrapFocus directive behaviour, and the configurable focus trap
// (FocusTrapManager stack + inert strategy that pulls escaped focus back).
// Ported from Angular CDK a11y focus-trap (angular/components), MIT, © Google LLC.
//
// Rivet: no DI / NgZone; constructors take the element (+ optional checker / document). The
// directive is `CdkTrapFocus` (a class: `attach()` after mount, `destroy()` on unmount); the
// declarative `<FocusScope contain>` (react-aria) is the component-level alternative. "When ready"
// waits for the next animation frame (Angular `afterNextRender`). Anchors carry Rivet's visually
// hidden styles (`hideVisually`) next to the `cdk-visually-hidden` class. Browser only.
import { hideVisually } from "./index.ts";
import { getInteractivityChecker, type InteractivityChecker } from "./interactivity-checker.ts";

function nextRender(fn: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => fn());
  else setTimeout(fn);
}

/** The focused element, through open shadow roots. */
export function _getFocusedElementPierceShadowDom(): HTMLElement | null {
  let activeElement = typeof document !== "undefined" && document ? (document.activeElement as HTMLElement | null) : null;
  while (activeElement && activeElement.shadowRoot) {
    const newActiveElement = activeElement.shadowRoot.activeElement as HTMLElement | null;
    if (newActiveElement === activeElement) break;
    activeElement = newActiveElement;
  }
  return activeElement;
}

/**
 * Traps Tab focus inside a region: focusable anchors before and after the element wrap focus to the
 * last / first tabbable element. Does not stop programmatic or pointer focus from leaving.
 */
export class FocusTrap {
  private _startAnchor: HTMLElement | null = null;
  private _endAnchor: HTMLElement | null = null;
  private _hasAttached = false;

  protected startAnchorListener = () => {
    const isSuccess = this.focusLastTabbableElement();
    if (!isSuccess && this._checker.isFocusable(this._element)) this._element.focus();
  };

  protected endAnchorListener = () => {
    const isSuccess = this.focusFirstTabbableElement();
    if (!isSuccess && this._checker.isFocusable(this._element)) this._element.focus();
  };

  /** Whether the trap is active (anchors tabbable). */
  get enabled(): boolean {
    return this._enabled;
  }
  set enabled(value: boolean) {
    this._enabled = value;
    if (this._startAnchor && this._endAnchor) {
      this._toggleAnchorTabIndex(value, this._startAnchor);
      this._toggleAnchorTabIndex(value, this._endAnchor);
    }
  }
  protected _enabled = true;

  readonly _element: HTMLElement;
  protected _checker: InteractivityChecker;
  readonly _document: Document;

  constructor(element: HTMLElement, checker: InteractivityChecker = getInteractivityChecker(), doc: Document = document, deferAnchors = false) {
    this._element = element;
    this._checker = checker;
    this._document = doc;
    if (!deferAnchors) this.attachAnchors();
  }

  /** Remove the anchors. */
  destroy(): void {
    const startAnchor = this._startAnchor;
    const endAnchor = this._endAnchor;
    if (startAnchor) {
      startAnchor.removeEventListener("focus", this.startAnchorListener);
      startAnchor.remove();
    }
    if (endAnchor) {
      endAnchor.removeEventListener("focus", this.endAnchorListener);
      endAnchor.remove();
    }
    this._startAnchor = this._endAnchor = null;
    this._hasAttached = false;
  }

  /** Insert the anchors around the element; false when it has no parent yet. */
  attachAnchors(): boolean {
    if (this._hasAttached) return true;
    if (!this._startAnchor) {
      this._startAnchor = this._createAnchor();
      this._startAnchor.addEventListener("focus", this.startAnchorListener);
    }
    if (!this._endAnchor) {
      this._endAnchor = this._createAnchor();
      this._endAnchor.addEventListener("focus", this.endAnchorListener);
    }
    if (this._element.parentNode) {
      this._element.parentNode.insertBefore(this._startAnchor, this._element);
      this._element.parentNode.insertBefore(this._endAnchor, this._element.nextSibling);
      this._hasAttached = true;
    }
    return this._hasAttached;
  }

  /** `focusInitialElement` after the next render. */
  focusInitialElementWhenReady(options?: FocusOptions): Promise<boolean> {
    return new Promise((resolve) => this._executeOnStable(() => resolve(this.focusInitialElement(options))));
  }

  /** `focusFirstTabbableElement` after the next render. */
  focusFirstTabbableElementWhenReady(options?: FocusOptions): Promise<boolean> {
    return new Promise((resolve) => this._executeOnStable(() => resolve(this.focusFirstTabbableElement(options))));
  }

  /** `focusLastTabbableElement` after the next render. */
  focusLastTabbableElementWhenReady(options?: FocusOptions): Promise<boolean> {
    return new Promise((resolve) => this._executeOnStable(() => resolve(this.focusLastTabbableElement(options))));
  }

  private _getRegionBoundary(bound: "start" | "end"): HTMLElement | null {
    // `cdk-focus-region-*` / `cdk-focus-*` are the deprecated spellings; still honoured.
    const markers = this._element.querySelectorAll(`[cdk-focus-region-${bound}], [cdkFocusRegion${bound}], [cdk-focus-${bound}]`) as NodeListOf<HTMLElement>;
    if (bound === "start") return markers.length ? markers[0]! : this._getFirstTabbableElement(this._element);
    return markers.length ? markers[markers.length - 1]! : this._getLastTabbableElement(this._element);
  }

  /** Focus the `[cdkFocusInitial]` element (or its first tabbable child), else the first tabbable element. */
  focusInitialElement(options?: FocusOptions): boolean {
    const redirectToElement = this._element.querySelector(`[cdk-focus-initial], [cdkFocusInitial]`) as HTMLElement | null;
    if (redirectToElement) {
      if (!this._checker.isFocusable(redirectToElement)) {
        const focusableChild = this._getFirstTabbableElement(redirectToElement);
        focusableChild?.focus(options);
        return !!focusableChild;
      }
      redirectToElement.focus(options);
      return true;
    }
    return this.focusFirstTabbableElement(options);
  }

  /** Focus the `[cdkFocusRegionStart]` element or the first tabbable element. */
  focusFirstTabbableElement(options?: FocusOptions): boolean {
    const redirectToElement = this._getRegionBoundary("start");
    if (redirectToElement) redirectToElement.focus(options);
    return !!redirectToElement;
  }

  /** Focus the `[cdkFocusRegionEnd]` element or the last tabbable element. */
  focusLastTabbableElement(options?: FocusOptions): boolean {
    const redirectToElement = this._getRegionBoundary("end");
    if (redirectToElement) redirectToElement.focus(options);
    return !!redirectToElement;
  }

  /** Whether the anchors are in the DOM. */
  hasAttached(): boolean {
    return this._hasAttached;
  }

  private _getFirstTabbableElement(root: HTMLElement): HTMLElement | null {
    if (this._checker.isFocusable(root) && this._checker.isTabbable(root)) return root;
    const children = root.children;
    for (let i = 0; i < children.length; i++) {
      const tabbableChild = children[i]!.nodeType === this._document.ELEMENT_NODE ? this._getFirstTabbableElement(children[i] as HTMLElement) : null;
      if (tabbableChild) return tabbableChild;
    }
    return null;
  }

  private _getLastTabbableElement(root: HTMLElement): HTMLElement | null {
    if (this._checker.isFocusable(root) && this._checker.isTabbable(root)) return root;
    const children = root.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const tabbableChild = children[i]!.nodeType === this._document.ELEMENT_NODE ? this._getLastTabbableElement(children[i] as HTMLElement) : null;
      if (tabbableChild) return tabbableChild;
    }
    return null;
  }

  private _createAnchor(): HTMLElement {
    const anchor = this._document.createElement("div");
    this._toggleAnchorTabIndex(this._enabled, anchor);
    anchor.classList.add("cdk-visually-hidden", "cdk-focus-trap-anchor");
    hideVisually(anchor);
    anchor.setAttribute("aria-hidden", "true");
    return anchor;
  }

  private _toggleAnchorTabIndex(isEnabled: boolean, anchor: HTMLElement): void {
    if (isEnabled) anchor.setAttribute("tabindex", "0");
    else anchor.removeAttribute("tabindex");
  }

  /** Toggle the anchors' tabindex. */
  protected toggleAnchors(enabled: boolean): void {
    if (this._startAnchor && this._endAnchor) {
      this._toggleAnchorTabIndex(enabled, this._startAnchor);
      this._toggleAnchorTabIndex(enabled, this._endAnchor);
    }
  }

  private _executeOnStable(fn: () => void): void {
    nextRender(fn);
  }
}

/** Creates FocusTraps. */
export class FocusTrapFactory {
  private _checker: InteractivityChecker;
  private _document: Document;

  constructor(checker: InteractivityChecker = getInteractivityChecker(), doc: Document = document) {
    this._checker = checker;
    this._document = doc;
  }

  /** A focus trap for `element`; `deferCaptureElements` defers anchor insertion to `attachAnchors()`. */
  create(element: HTMLElement, deferCaptureElements = false): FocusTrap {
    return new FocusTrap(element, this._checker, this._document, deferCaptureElements);
  }
}

export interface CdkTrapFocusOptions {
  /** Whether the trap is active (default true). */
  enabled?: boolean;
  /** Focus the initial element on attach and restore the previous focus on destroy. */
  autoCapture?: boolean;
}

/**
 * The `cdkTrapFocus` directive: call `attach()` once the element is in the DOM (a client effect)
 * and `destroy()` on unmount.
 */
export class CdkTrapFocus {
  readonly focusTrap: FocusTrap;
  private _previouslyFocusedElement: HTMLElement | null = null;
  private _autoCapture: boolean;

  constructor(element: HTMLElement, options: CdkTrapFocusOptions = {}, factory: FocusTrapFactory = new FocusTrapFactory()) {
    this.focusTrap = factory.create(element, true);
    this.focusTrap.enabled = options.enabled ?? true;
    this._autoCapture = !!options.autoCapture;
  }

  get enabled(): boolean {
    return this.focusTrap?.enabled || false;
  }
  set enabled(value: boolean) {
    this.focusTrap.enabled = value;
  }

  get autoCapture(): boolean {
    return this._autoCapture;
  }
  set autoCapture(value: boolean) {
    const changed = value && !this._autoCapture;
    this._autoCapture = value;
    if (changed && this.focusTrap.hasAttached()) this._captureFocus();
  }

  /** ngAfterContentInit: attach anchors, auto-capture. */
  attach(): void {
    this.focusTrap.attachAnchors();
    if (this._autoCapture) this._captureFocus();
  }

  /** ngDoCheck: retry anchors when the element had no parent at attach time. */
  check(): void {
    if (!this.focusTrap.hasAttached()) this.focusTrap.attachAnchors();
  }

  destroy(): void {
    this.focusTrap.destroy();
    if (this._previouslyFocusedElement) {
      this._previouslyFocusedElement.focus();
      this._previouslyFocusedElement = null;
    }
  }

  private _captureFocus(): void {
    this._previouslyFocusedElement = _getFocusedElementPierceShadowDom();
    void this.focusTrap.focusInitialElementWhenReady();
  }
}

// --- Configurable focus trap ---------------------------------------------------------------------

/** Options for the configurable focus trap. */
export interface ConfigurableFocusTrapConfig {
  /** Defer anchor insertion to `attachAnchors()`. */
  defer: boolean;
}

/** A focus trap the FocusTrapManager can enable / disable. */
export interface ManagedFocusTrap {
  _enable(): void;
  _disable(): void;
  focusInitialElementWhenReady(): Promise<boolean>;
}

/** Keeps only the most recently registered trap active. */
export class FocusTrapManager {
  private _focusTrapStack: ManagedFocusTrap[] = [];

  /** Disable the active trap and activate `focusTrap`. */
  register(focusTrap: ManagedFocusTrap): void {
    // Dedupe when re-enabled.
    this._focusTrapStack = this._focusTrapStack.filter((ft) => ft !== focusTrap);
    const stack = this._focusTrapStack;
    if (stack.length) stack[stack.length - 1]!._disable();
    stack.push(focusTrap);
    focusTrap._enable();
  }

  /** Disable `focusTrap` and re-activate the previous one. */
  deregister(focusTrap: ManagedFocusTrap): void {
    focusTrap._disable();
    const stack = this._focusTrapStack;
    const i = stack.indexOf(focusTrap);
    if (i !== -1) {
      stack.splice(i, 1);
      if (stack.length) stack[stack.length - 1]!._enable();
    }
  }
}

/** How a configurable trap keeps focus from leaving by means other than Tab. */
export interface FocusTrapInertStrategy {
  preventFocus(focusTrap: FocusTrap): void;
  allowFocus(focusTrap: FocusTrap): void;
}

/** Pulls focus back into the trap when it moves outside (except into `div.cdk-overlay-pane`). */
export class EventListenerFocusTrapInertStrategy implements FocusTrapInertStrategy {
  private _listener: ((e: FocusEvent) => void) | null = null;

  preventFocus(focusTrap: FocusTrap): void {
    // Only one trap is active at a time.
    if (this._listener) focusTrap._document.removeEventListener("focus", this._listener, true);
    this._listener = (e: FocusEvent) => this._trapFocus(focusTrap, e);
    focusTrap._document.addEventListener("focus", this._listener, true);
  }

  allowFocus(focusTrap: FocusTrap): void {
    if (!this._listener) return;
    focusTrap._document.removeEventListener("focus", this._listener, true);
    this._listener = null;
  }

  private _trapFocus(focusTrap: FocusTrap, event: FocusEvent): void {
    const target = event.target as HTMLElement;
    const focusTrapRoot = focusTrap._element;
    // Overlay panes opened from inside the trap may take focus.
    if (target && !focusTrapRoot.contains(target) && !target.closest?.("div.cdk-overlay-pane, [data-rv-top-layer]")) {
      // Let the focus land first: a refocus inside the handler confuses screen readers.
      setTimeout(() => {
        if (focusTrap.enabled && !focusTrapRoot.contains(focusTrap._document.activeElement)) focusTrap.focusFirstTabbableElement();
      });
    }
  }
}

/** A FocusTrap managed by a FocusTrapManager, with an inert strategy for non-Tab focus moves. */
export class ConfigurableFocusTrap extends FocusTrap implements ManagedFocusTrap {
  private _focusTrapManager!: FocusTrapManager;
  private _inertStrategy!: FocusTrapInertStrategy;

  override get enabled(): boolean {
    return this._enabled;
  }
  override set enabled(value: boolean) {
    this._enabled = value;
    if (this._enabled) this._focusTrapManager.register(this);
    else this._focusTrapManager.deregister(this);
  }

  constructor(
    element: HTMLElement,
    checker: InteractivityChecker,
    doc: Document,
    focusTrapManager: FocusTrapManager,
    inertStrategy: FocusTrapInertStrategy,
    config: ConfigurableFocusTrapConfig,
  ) {
    // Anchors attach after the manager fields are set (fields initialise after super()).
    super(element, checker, doc, true);
    this._focusTrapManager = focusTrapManager;
    this._inertStrategy = inertStrategy;
    if (!config.defer) this.attachAnchors();
    this._focusTrapManager.register(this);
  }

  override destroy(): void {
    this._focusTrapManager.deregister(this);
    super.destroy();
  }

  /** @internal */
  _enable(): void {
    this._inertStrategy.preventFocus(this);
    this.toggleAnchors(true);
  }

  /** @internal */
  _disable(): void {
    this._inertStrategy.allowFocus(this);
    this.toggleAnchors(false);
  }
}

let sharedManager: FocusTrapManager | null = null;

/** The shared FocusTrapManager. */
export function getFocusTrapManager(): FocusTrapManager {
  return (sharedManager ??= new FocusTrapManager());
}

/** Creates ConfigurableFocusTraps (default inert strategy: EventListenerFocusTrapInertStrategy). */
export class ConfigurableFocusTrapFactory {
  private _inertStrategy: FocusTrapInertStrategy;
  private _checker: InteractivityChecker;
  private _focusTrapManager: FocusTrapManager;
  private _document: Document;

  constructor(
    inertStrategy: FocusTrapInertStrategy = new EventListenerFocusTrapInertStrategy(),
    checker: InteractivityChecker = getInteractivityChecker(),
    focusTrapManager: FocusTrapManager = getFocusTrapManager(),
    doc: Document = document,
  ) {
    this._inertStrategy = inertStrategy;
    this._checker = checker;
    this._focusTrapManager = focusTrapManager;
    this._document = doc;
  }

  create(element: HTMLElement, config: ConfigurableFocusTrapConfig = { defer: false }): ConfigurableFocusTrap {
    return new ConfigurableFocusTrap(element, this._checker, this._document, this._focusTrapManager, this._inertStrategy, config);
  }
}
