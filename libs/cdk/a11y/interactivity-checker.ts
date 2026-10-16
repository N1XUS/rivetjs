// InteractivityChecker: is an element disabled / visible / focusable / tabbable (frames, iOS WebKit
// rules, audio / video, contenteditable).
// Ported from Angular CDK a11y interactivity-checker (angular/components), MIT, © Google LLC.
//
// Rivet: a plain class plus a shared instance; the platform checks follow Angular's `Platform`
// (WEBKIT excludes Blink, IOS = iPad / iPhone / iPod user agents). Not supported on the server
// (`isTabbable` returns false there, as in the original).

/** Options for `isFocusable`. */
export class IsFocusableConfig {
  /** Whether to count invisible elements as focusable. */
  ignoreVisibility = false;
}

function userAgent(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}
const isBrowser = (): boolean => typeof document === "object" && !!document;
const isEdge = (): boolean => /(edge)/i.test(userAgent());
const isTrident = (): boolean => /(msie|trident)/i.test(userAgent());
const isBlink = (): boolean => isBrowser() && !!((globalThis as { chrome?: unknown }).chrome || (typeof Intl !== "undefined" && (Intl as { v8BreakIterator?: unknown }).v8BreakIterator)) && typeof CSS !== "undefined" && !isEdge() && !isTrident();
const isPlatformWebKit = (): boolean => isBrowser() && /AppleWebKit/i.test(userAgent()) && !isBlink() && !isEdge() && !isTrident();
const isPlatformIOS = (): boolean => isBrowser() && /iPad|iPhone|iPod/.test(userAgent()) && !("MSStream" in globalThis);
const isPlatformFirefox = (): boolean => isBrowser() && /(firefox|minefield)/i.test(userAgent());

/** Checks interactivity of elements: disabled, visible, tabbable, focusable. */
export class InteractivityChecker {
  /** Whether the element has a `disabled` attribute (not `aria-disabled`). */
  isDisabled(element: HTMLElement): boolean {
    return element.hasAttribute("disabled");
  }

  /** Whether the element is rendered (has geometry) and `visibility: visible`. */
  isVisible(element: HTMLElement): boolean {
    return hasGeometry(element) && getComputedStyle(element).visibility === "visible";
  }

  /** Whether Tab reaches the element (assumes it is visible). */
  isTabbable(element: HTMLElement): boolean {
    if (!isBrowser()) return false;
    const frameElement = getFrameElement(getWindow(element));
    if (frameElement) {
      // Inside a frame: an untabbable or hidden frame makes its content untabbable.
      if (getTabIndexValue(frameElement) === -1) return false;
      if (!this.isVisible(frameElement)) return false;
    }
    const nodeName = element.nodeName.toLowerCase();
    const tabIndexValue = getTabIndexValue(element);
    if (element.hasAttribute("contenteditable")) return tabIndexValue !== -1;
    // Browsers do not keep focus inside frames / objects; they are not part of the tab order.
    if (nodeName === "iframe" || nodeName === "object") return false;
    // iOS Safari tabs only between text inputs, selects and textareas.
    if (isPlatformWebKit() && isPlatformIOS() && !isPotentiallyTabbableIOS(element)) return false;
    if (nodeName === "audio") {
      if (!element.hasAttribute("controls")) return false;
      return tabIndexValue !== -1;
    }
    if (nodeName === "video") {
      if (tabIndexValue === -1) return false;
      if (tabIndexValue !== null) return true;
      // Firefox tabs to videos without controls.
      return isPlatformFirefox() || element.hasAttribute("controls");
    }
    return element.tabIndex >= 0;
  }

  /** Whether the element can receive focus (native control, anchor with href, contenteditable, tabindex). */
  isFocusable(element: HTMLElement, config?: IsFocusableConfig): boolean {
    return isPotentiallyFocusable(element) && !this.isDisabled(element) && (config?.ignoreVisibility || this.isVisible(element));
  }
}

function getFrameElement(window: Window): HTMLElement | null {
  try {
    return window.frameElement as HTMLElement | null;
  } catch {
    return null; // cross-origin
  }
}

function hasGeometry(element: HTMLElement): boolean {
  return !!(element.offsetWidth || element.offsetHeight || (typeof element.getClientRects === "function" && element.getClientRects().length));
}

function isNativeFormElement(element: Node): boolean {
  const nodeName = element.nodeName.toLowerCase();
  return nodeName === "input" || nodeName === "select" || nodeName === "button" || nodeName === "textarea";
}

function isHiddenInput(element: HTMLElement): boolean {
  return element.nodeName.toLowerCase() === "input" && (element as HTMLInputElement).type === "hidden";
}

function isAnchorWithHref(element: HTMLElement): boolean {
  return element.nodeName.toLowerCase() === "a" && element.hasAttribute("href");
}

function hasValidTabIndex(element: HTMLElement): boolean {
  if (!element.hasAttribute("tabindex") || element.tabIndex === undefined) return false;
  const tabIndex = element.getAttribute("tabindex");
  return !!(tabIndex && !isNaN(parseInt(tabIndex, 10)));
}

/** The parsed `tabindex` attribute, or null when absent / invalid. */
function getTabIndexValue(element: HTMLElement): number | null {
  if (!hasValidTabIndex(element)) return null;
  const tabIndex = parseInt(element.getAttribute("tabindex") || "", 10);
  return isNaN(tabIndex) ? -1 : tabIndex;
}

function isPotentiallyTabbableIOS(element: HTMLElement): boolean {
  const nodeName = element.nodeName.toLowerCase();
  const inputType = nodeName === "input" && (element as HTMLInputElement).type;
  return inputType === "text" || inputType === "password" || nodeName === "select" || nodeName === "textarea";
}

function isPotentiallyFocusable(element: HTMLElement): boolean {
  if (isHiddenInput(element)) return false;
  return isNativeFormElement(element) || isAnchorWithHref(element) || element.hasAttribute("contenteditable") || hasValidTabIndex(element);
}

function getWindow(node: HTMLElement): Window {
  return (node.ownerDocument && node.ownerDocument.defaultView) || window;
}

let shared: InteractivityChecker | null = null;

/** The shared InteractivityChecker. */
export function getInteractivityChecker(): InteractivityChecker {
  return (shared ??= new InteractivityChecker());
}
