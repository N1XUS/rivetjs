// FocusMonitor (focus origin: keyboard / mouse / touch / program, `cdk-*-focused` classes, focusVia,
// checkChildren, shadow roots, window refocus, label clicks), InputModalityDetector and screen-reader
// fake event detection.
// Ported from Angular CDK a11y focus-monitor, input-modality, fake-event-detection
// (angular/components), MIT, © Google LLC.
//
// Rivet: services are plain classes; `getFocusMonitor()` / `getInputModalityDetector()` return lazily
// created shared instances (the original's root injector). Observables are minimal Subjects
// (`subscribe` returns `{ unsubscribe }`). Browser only: call from handlers or client effects.
import { Subject } from "./key-manager.ts";

export type InputModality = "keyboard" | "mouse" | "touch" | null;

export interface InputModalityDetectorOptions {
  /** Key codes that do not switch the modality to keyboard. */
  ignoreKeys?: number[];
}

// ALT, CONTROL, MAC_META, META, SHIFT: modifiers accompany mouse actions, and VoiceOver fires them
// while navigating linearly.
export const INPUT_MODALITY_DETECTOR_DEFAULT_OPTIONS: InputModalityDetectorOptions = { ignoreKeys: [18, 17, 224, 91, 16] };

/** Time after a touchstart during which a mousedown counts as touch. */
export const TOUCH_BUFFER_MS = 650;

const modalityEventListenerOptions = { passive: true, capture: true };

/** Event target, through open shadow roots. */
function getEventTarget<T extends EventTarget>(event: Event): T | null {
  return (event.composedPath ? event.composedPath()[0] : event.target) as T | null;
}

function getShadowRoot(element: HTMLElement): ShadowRoot | null {
  const root = element.getRootNode?.();
  return typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot ? root : null;
}

/** A screen reader's fake mousedown (Enter / Space on a control): buttons 0 (Firefox) or detail 0 (Chrome). */
export function isFakeMousedownFromScreenReader(event: MouseEvent): boolean {
  return event.buttons === 0 || event.detail === 0;
}

/** A screen reader's fake touchstart: identifier -1, radius 1 (NVDA on touch screens). */
export function isFakeTouchstartFromScreenReader(event: TouchEvent): boolean {
  const touch: Touch | undefined = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]);
  return !!touch && touch.identifier === -1 && (touch.radiusX == null || touch.radiusX === 1) && (touch.radiusY == null || touch.radiusY === 1);
}

/** Detects the user's input modality (keyboard / mouse / touch). Screen reader navigation does not count. */
export class InputModalityDetector {
  /** Emits on every detected modality. */
  readonly modalityDetected = new Subject<InputModality>();
  /** Emits when the modality changes. */
  readonly modalityChanged = new Subject<InputModality>();
  /** Target of the most recent modality event. */
  _mostRecentTarget: HTMLElement | null = null;
  private _modality: InputModality = null;
  private readonly _options: InputModalityDetectorOptions;
  private _lastTouchMs = 0;
  private readonly _listenerCleanups: (() => void)[] = [];

  /** The most recently detected modality. */
  get mostRecentModality(): InputModality {
    return this._modality;
  }

  constructor(options?: InputModalityDetectorOptions, doc: Document | null = typeof document === "undefined" ? null : document) {
    this._options = { ...INPUT_MODALITY_DETECTOR_DEFAULT_OPTIONS, ...options };
    if (!doc) return;
    const listen = <E extends Event>(type: string, fn: (event: E) => void) => {
      doc.addEventListener(type, fn as EventListener, modalityEventListenerOptions);
      this._listenerCleanups.push(() => doc.removeEventListener(type, fn as EventListener, modalityEventListenerOptions));
    };
    listen<KeyboardEvent>("keydown", this._onKeydown);
    listen<MouseEvent>("mousedown", this._onMousedown);
    listen<TouchEvent>("touchstart", this._onTouchstart);
  }

  private _next(modality: InputModality): void {
    const previous = this._modality;
    this._modality = modality;
    this.modalityDetected.next(modality);
    if (modality !== previous) this.modalityChanged.next(modality);
  }

  private _onKeydown = (event: KeyboardEvent) => {
    if (this._options?.ignoreKeys?.some((keyCode) => keyCode === event.keyCode)) return;
    this._next("keyboard");
    this._mostRecentTarget = getEventTarget(event);
  };

  private _onMousedown = (event: MouseEvent) => {
    // Touches also fire mouse events: a mousedown right after a touch is touch.
    if (Date.now() - this._lastTouchMs < TOUCH_BUFFER_MS) return;
    // Screen readers fire fake mousedowns when activating controls: keyboard.
    this._next(isFakeMousedownFromScreenReader(event) ? "keyboard" : "mouse");
    this._mostRecentTarget = getEventTarget(event);
  };

  private _onTouchstart = (event: TouchEvent) => {
    if (isFakeTouchstartFromScreenReader(event)) {
      this._next("keyboard");
      return;
    }
    this._lastTouchMs = Date.now();
    this._next("touch");
    this._mostRecentTarget = getEventTarget(event);
  };

  destroy(): void {
    this.modalityDetected.complete();
    this.modalityChanged.complete();
    for (const cleanup of this._listenerCleanups.splice(0)) cleanup();
  }
}

export type FocusOrigin = "touch" | "mouse" | "keyboard" | "program" | null;

/** How a focus event's origin is attributed. */
export const FocusMonitorDetectionMode = {
  /** Only interaction events of the previous / current tick count (default). */
  IMMEDIATE: 0,
  /** The last interaction event counts, however long ago. */
  EVENTUAL: 1,
} as const;
export type FocusMonitorDetectionMode = (typeof FocusMonitorDetectionMode)[keyof typeof FocusMonitorDetectionMode];

export interface FocusMonitorOptions {
  detectionMode?: FocusMonitorDetectionMode;
}

type MonitoredElementInfo = {
  checkChildren: boolean;
  readonly subject: Subject<FocusOrigin>;
  rootNode: HTMLElement | ShadowRoot | Document;
};

const captureEventListenerOptions = { passive: true, capture: true };

/** Monitors interaction events to determine the origin of focus events. */
export class FocusMonitor {
  private _origin: FocusOrigin = null;
  private _lastFocusOrigin: FocusOrigin = null;
  private _windowFocused = false;
  private _windowFocusTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private _originTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private _originFromTouchInteraction = false;
  private _elementInfo = new Map<HTMLElement, MonitoredElementInfo>();
  private _monitoredElementCount = 0;
  private _rootNodeFocusListenerCount = new Map<HTMLElement | Document | ShadowRoot, number>();
  private readonly _detectionMode: FocusMonitorDetectionMode;
  private _modalitySubscription: { unsubscribe(): void } | null = null;
  protected _document: Document;

  private readonly _inputModalityDetector: InputModalityDetector;

  constructor(options?: FocusMonitorOptions | null, inputModalityDetector: InputModalityDetector = getInputModalityDetector(), doc: Document = document) {
    this._inputModalityDetector = inputModalityDetector;
    this._detectionMode = options?.detectionMode || FocusMonitorDetectionMode.IMMEDIATE;
    this._document = doc;
  }

  private _windowFocusListener = () => {
    // The window regained focus: restore the origin of the element focused before.
    this._windowFocused = true;
    this._windowFocusTimeoutId = setTimeout(() => (this._windowFocused = false));
  };

  private _rootNodeFocusAndBlurListener = (event: Event) => {
    const target = getEventTarget<HTMLElement>(event);
    // Walk up for checkChildren.
    for (let element = target; element; element = element.parentElement) {
      if (event.type === "focus") this._onFocus(event as FocusEvent, element);
      else this._onBlur(event as FocusEvent, element);
    }
  };

  /**
   * Monitor focus on `element` (and its children with `checkChildren`) and apply the `cdk-focused`
   * / `cdk-{origin}-focused` classes. The returned subject emits the origin on focus, `null` on blur.
   */
  monitor(element: HTMLElement | { nativeElement: HTMLElement }, checkChildren = false): Subject<FocusOrigin> {
    const nativeElement = coerceElement(element);
    if (typeof document === "undefined" || nativeElement.nodeType !== 1) return new Subject<FocusOrigin>();
    // In a shadow root, focus events do not reach the document when focus moves inside the root.
    const rootNode = getShadowRoot(nativeElement) || this._document;
    const cachedInfo = this._elementInfo.get(nativeElement);
    if (cachedInfo) {
      if (checkChildren) cachedInfo.checkChildren = true;
      return cachedInfo.subject;
    }
    const info: MonitoredElementInfo = { checkChildren, subject: new Subject<FocusOrigin>(), rootNode };
    this._elementInfo.set(nativeElement, info);
    this._registerGlobalListeners(info);
    return info.subject;
  }

  /** Stop monitoring `element` and remove its focus classes. */
  stopMonitoring(element: HTMLElement | { nativeElement: HTMLElement }): void {
    const nativeElement = coerceElement(element);
    const elementInfo = this._elementInfo.get(nativeElement);
    if (elementInfo) {
      elementInfo.subject.complete();
      this._setClasses(nativeElement);
      this._elementInfo.delete(nativeElement);
      this._removeGlobalListeners(elementInfo);
    }
  }

  /** Focus `element` with the given origin. */
  focusVia(element: HTMLElement | { nativeElement: HTMLElement }, origin: FocusOrigin, options?: FocusOptions): void {
    const nativeElement = coerceElement(element);
    const focusedElement = this._document.activeElement;
    // Already focused: no focus event follows, update the classes directly.
    if (nativeElement === focusedElement) this._getClosestElementsInfo(nativeElement).forEach(([current, info]) => this._originChanged(current, origin, info));
    else {
      this._setOrigin(origin);
      if (typeof nativeElement.focus === "function") nativeElement.focus(options);
    }
  }

  destroy(): void {
    this._elementInfo.forEach((_info, element) => this.stopMonitoring(element));
  }

  private _getWindow(): Window {
    return this._document.defaultView || window;
  }

  private _getFocusOrigin(focusEventTarget: HTMLElement | null): FocusOrigin {
    if (this._origin) {
      if (this._originFromTouchInteraction) return this._shouldBeAttributedToTouch(focusEventTarget) ? "touch" : "program";
      return this._origin;
    }
    // The window just regained focus: the origin from before it blurred.
    if (this._windowFocused && this._lastFocusOrigin) return this._lastFocusOrigin;
    // A label click moves focus on click (not mousedown): mouse.
    if (focusEventTarget && this._isLastInteractionFromInputLabel(focusEventTarget)) return "mouse";
    return "program";
  }

  private _shouldBeAttributedToTouch(focusEventTarget: HTMLElement | null): boolean {
    return this._detectionMode === FocusMonitorDetectionMode.EVENTUAL || !!focusEventTarget?.contains(this._inputModalityDetector._mostRecentTarget);
  }

  private _setClasses(element: HTMLElement, origin?: FocusOrigin): void {
    element.classList.toggle("cdk-focused", !!origin);
    element.classList.toggle("cdk-touch-focused", origin === "touch");
    element.classList.toggle("cdk-keyboard-focused", origin === "keyboard");
    element.classList.toggle("cdk-mouse-focused", origin === "mouse");
    element.classList.toggle("cdk-program-focused", origin === "program");
  }

  private _setOrigin(origin: FocusOrigin, isFromInteraction = false): void {
    this._origin = origin;
    this._originFromTouchInteraction = origin === "touch" && isFromInteraction;
    // IMMEDIATE: reset at the next tick (Firefox focuses one tick after the interaction), touch after
    // TOUCH_BUFFER_MS (its focus event is not queued yet).
    if (this._detectionMode === FocusMonitorDetectionMode.IMMEDIATE) {
      clearTimeout(this._originTimeoutId);
      const ms = this._originFromTouchInteraction ? TOUCH_BUFFER_MS : 1;
      this._originTimeoutId = setTimeout(() => (this._origin = null), ms);
    }
  }

  private _onFocus(event: FocusEvent, element: HTMLElement): void {
    const elementInfo = this._elementInfo.get(element);
    const focusEventTarget = getEventTarget<HTMLElement>(event);
    if (!elementInfo || (!elementInfo.checkChildren && element !== focusEventTarget)) return;
    this._originChanged(element, this._getFocusOrigin(focusEventTarget), elementInfo);
  }

  _onBlur(event: FocusEvent, element: HTMLElement): void {
    const elementInfo = this._elementInfo.get(element);
    // checkChildren: focus moving to another child is not a blur.
    if (!elementInfo || (elementInfo.checkChildren && event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return;
    this._setClasses(element);
    this._emitOrigin(elementInfo, null);
  }

  private _emitOrigin(info: MonitoredElementInfo, origin: FocusOrigin): void {
    if (info.subject.observed) info.subject.next(origin);
  }

  private _registerGlobalListeners(elementInfo: MonitoredElementInfo): void {
    const rootNode = elementInfo.rootNode;
    const count = this._rootNodeFocusListenerCount.get(rootNode) || 0;
    if (!count) {
      rootNode.addEventListener("focus", this._rootNodeFocusAndBlurListener, captureEventListenerOptions);
      rootNode.addEventListener("blur", this._rootNodeFocusAndBlurListener, captureEventListenerOptions);
    }
    this._rootNodeFocusListenerCount.set(rootNode, count + 1);
    if (++this._monitoredElementCount === 1) {
      this._getWindow().addEventListener("focus", this._windowFocusListener);
      this._modalitySubscription = this._inputModalityDetector.modalityDetected.subscribe((modality) => this._setOrigin(modality, true));
    }
  }

  private _removeGlobalListeners(elementInfo: MonitoredElementInfo): void {
    const rootNode = elementInfo.rootNode;
    if (this._rootNodeFocusListenerCount.has(rootNode)) {
      const count = this._rootNodeFocusListenerCount.get(rootNode)!;
      if (count > 1) this._rootNodeFocusListenerCount.set(rootNode, count - 1);
      else {
        rootNode.removeEventListener("focus", this._rootNodeFocusAndBlurListener, captureEventListenerOptions);
        rootNode.removeEventListener("blur", this._rootNodeFocusAndBlurListener, captureEventListenerOptions);
        this._rootNodeFocusListenerCount.delete(rootNode);
      }
    }
    if (!--this._monitoredElementCount) {
      this._getWindow().removeEventListener("focus", this._windowFocusListener);
      this._modalitySubscription?.unsubscribe();
      this._modalitySubscription = null;
      clearTimeout(this._windowFocusTimeoutId);
      clearTimeout(this._originTimeoutId);
    }
  }

  private _originChanged(element: HTMLElement, origin: FocusOrigin, elementInfo: MonitoredElementInfo): void {
    this._setClasses(element, origin);
    this._emitOrigin(elementInfo, origin);
    this._lastFocusOrigin = origin;
  }

  private _getClosestElementsInfo(element: HTMLElement): [HTMLElement, MonitoredElementInfo][] {
    const results: [HTMLElement, MonitoredElementInfo][] = [];
    this._elementInfo.forEach((info, current) => {
      if (current === element || (info.checkChildren && current.contains(element))) results.push([current, info]);
    });
    return results;
  }

  private _isLastInteractionFromInputLabel(focusEventTarget: HTMLElement): boolean {
    const { _mostRecentTarget: mostRecentTarget, mostRecentModality } = this._inputModalityDetector;
    if (
      mostRecentModality !== "mouse" ||
      !mostRecentTarget ||
      mostRecentTarget === focusEventTarget ||
      (focusEventTarget.nodeName !== "INPUT" && focusEventTarget.nodeName !== "TEXTAREA") ||
      (focusEventTarget as HTMLInputElement | HTMLTextAreaElement).disabled
    )
      return false;
    const labels = (focusEventTarget as HTMLInputElement | HTMLTextAreaElement).labels;
    if (labels) for (let i = 0; i < labels.length; i++) if (labels[i]!.contains(mostRecentTarget)) return true;
    return false;
  }
}

function coerceElement(element: HTMLElement | { nativeElement: HTMLElement }): HTMLElement {
  return "nativeElement" in element ? element.nativeElement : element;
}

let sharedDetector: InputModalityDetector | null = null;
let sharedMonitor: FocusMonitor | null = null;

/** The shared InputModalityDetector (created on first call; browser only). */
export function getInputModalityDetector(): InputModalityDetector {
  return (sharedDetector ??= new InputModalityDetector());
}

/** The shared FocusMonitor (created on first call; browser only). */
export function getFocusMonitor(): FocusMonitor {
  return (sharedMonitor ??= new FocusMonitor());
}
