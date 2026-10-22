// Ported from react-aria (packages/react-aria/src/landmark/useLandmark.ts: LandmarkManager,
// UNSTABLE_createLandmarkController), Apache-2.0, © Adobe.
// Rivet:
// - Plain `.ts` (browser-only code, never server-rewritten); `./index.tsx` holds `landmarkProps` (useLandmark).
// - Landmarks hold `ref()` accessors (read as `ref()` where RA reads `ref.current`).
// - The manager singleton lives on `document[Symbol.for("rivet-cdk-landmark-manager")]` and announces a
//   replacement with `rv-landmark-manager-change` (RA: `react-aria-landmark-manager` /
//   `react-aria-landmark-manager-change`): its landmarks hold `ref()` accessors, not React ref objects, so
//   they must not join a React Aria manager on the same page. The wrap event keeps RA's name
//   (`react-aria-landmark-navigation`, public API).
// - `useLandmarkManager` (useSyncExternalStore) → `registerLandmark` subscribes to the manager-change
//   event and re-registers with the new manager.
import { DEV, getEventTarget, nodeContains } from "../utils/dom.ts";

type FocusableElement = HTMLElement | SVGElement;
export type LandmarkRef = () => FocusableElement | null | undefined;

export type AriaLandmarkRole = "main" | "region" | "search" | "navigation" | "form" | "banner" | "contentinfo" | "complementary";

export interface AriaLandmarkProps {
  role: AriaLandmarkRole;
  /** Rivet: a string or an accessor. */
  "aria-label"?: string | (() => string | undefined);
  "aria-labelledby"?: string;
  focus?: (direction: "forward" | "backward") => void;
}

export interface LandmarkProps {
  role: AriaLandmarkRole;
  tabIndex: () => number | undefined;
  "aria-label"?: string | (() => string | undefined);
  "aria-labelledby"?: string;
}

/** Return of `landmarkProps` (RA `LandmarkAria.landmarkProps`). */
export interface LandmarkAria {
  landmarkProps: LandmarkProps;
}

// Increment this version number whenever the
// LandmarkManagerApi or Landmark interfaces change.
const LANDMARK_API_VERSION = 1;

// Minimal API for LandmarkManager that must continue to work between versions.
interface LandmarkManagerApi {
  version: number;
  createLandmarkController(): LandmarkController;
  registerLandmark(landmark: Landmark): () => void;
}

// Changes to this interface are considered breaking. New properties MUST be optional.
interface Landmark {
  ref: LandmarkRef;
  role: AriaLandmarkRole;
  label?: string;
  lastFocused?: FocusableElement;
  focus: (direction: "forward" | "backward") => void;
  blur: () => void;
}

export interface LandmarkControllerOptions {
  /**
   * The element from which to start navigating.
   * @default document.activeElement
   */
  from?: FocusableElement;
}

/** A LandmarkController allows programmatic navigation of landmarks. */
export interface LandmarkController {
  /** Moves focus to the next landmark. */
  focusNext(opts?: LandmarkControllerOptions): boolean;
  /** Moves focus to the previous landmark. */
  focusPrevious(opts?: LandmarkControllerOptions): boolean;
  /** Moves focus to the main landmark. */
  focusMain(): boolean;
  /** Moves focus either forward or backward in the landmark sequence. */
  navigate(direction: "forward" | "backward", opts?: LandmarkControllerOptions): boolean;
  /**
   * Disposes the landmark controller. When no landmarks are registered, and no
   * controllers are active, the landmark keyboard listeners are removed from the page.
   */
  dispose(): void;
}

// Symbol under which the singleton landmark manager instance is attached to the document.
const landmarkSymbol = Symbol.for("rivet-cdk-landmark-manager");
const CHANGE_EVENT = "rv-landmark-manager-change";

// RA: `process.env.NODE_ENV !== 'production'` (bundlers replace it; a missing `process` counts as dev).

function subscribe(fn: () => void): () => void {
  document.addEventListener(CHANGE_EVENT, fn);
  return () => document.removeEventListener(CHANGE_EVENT, fn);
}

type LandmarkDocument = Document & { [landmarkSymbol]?: LandmarkManagerApi };

function getLandmarkManager(): LandmarkManagerApi | null {
  if (typeof document === "undefined") return null;

  // Reuse an existing instance if it has the same or greater version.
  const doc = document as LandmarkDocument;
  const instance = doc[landmarkSymbol];
  if (instance && instance.version >= LANDMARK_API_VERSION) return instance;

  // Otherwise, create a new instance and dispatch an event so anything using the existing
  // instance updates and re-registers their landmarks with the new one.
  doc[landmarkSymbol] = new LandmarkManager();
  document.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  return doc[landmarkSymbol]!;
}

class LandmarkManager implements LandmarkManagerApi {
  private landmarks: Array<Landmark> = [];
  private isListening = false;
  private refCount = 0;
  public version = LANDMARK_API_VERSION;

  constructor() {
    this.f6Handler = this.f6Handler.bind(this);
    this.focusinHandler = this.focusinHandler.bind(this);
    this.focusoutHandler = this.focusoutHandler.bind(this);
  }

  private setupIfNeeded() {
    if (this.isListening) return;
    document.addEventListener("keydown", this.f6Handler, { capture: true });
    document.addEventListener("focusin", this.focusinHandler, { capture: true });
    document.addEventListener("focusout", this.focusoutHandler, { capture: true });
    this.isListening = true;
  }

  private teardownIfNeeded() {
    if (!this.isListening || this.landmarks.length > 0 || this.refCount > 0) return;
    document.removeEventListener("keydown", this.f6Handler, { capture: true });
    document.removeEventListener("focusin", this.focusinHandler, { capture: true });
    document.removeEventListener("focusout", this.focusoutHandler, { capture: true });
    this.isListening = false;
  }

  private focusLandmark(landmark: FocusableElement, direction: "forward" | "backward") {
    this.landmarks.find((l) => l.ref() === landmark)?.focus?.(direction);
  }

  /** Return set of landmarks with a specific role. */
  private getLandmarksByRole(role: AriaLandmarkRole) {
    return new Set(this.landmarks.filter((l) => l.role === role));
  }

  /** Return first landmark with a specific role. */
  private getLandmarkByRole(role: AriaLandmarkRole) {
    return this.landmarks.find((l) => l.role === role);
  }

  private addLandmark(newLandmark: Landmark) {
    this.setupIfNeeded();
    const element = newLandmark.ref();
    if (this.landmarks.find((landmark) => landmark.ref === newLandmark.ref) || !element) return;

    if (this.landmarks.filter((landmark) => landmark.role === "main").length > 1 && DEV) {
      console.error('Page can contain no more than one landmark with the role "main".');
    }

    if (this.landmarks.length === 0) {
      this.landmarks = [newLandmark];
      this.checkLabels(newLandmark.role);
      return;
    }

    // Binary search to insert new landmark based on position in document relative to existing landmarks.
    // https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition
    let start = 0;
    let end = this.landmarks.length - 1;
    while (start <= end) {
      const mid = Math.floor((start + end) / 2);
      const comparedPosition = element.compareDocumentPosition(this.landmarks[mid]!.ref() as Node);
      const isNewAfterExisting = Boolean(comparedPosition & Node.DOCUMENT_POSITION_PRECEDING || comparedPosition & Node.DOCUMENT_POSITION_CONTAINS);

      if (isNewAfterExisting) start = mid + 1;
      else end = mid - 1;
    }

    this.landmarks.splice(start, 0, newLandmark);
    this.checkLabels(newLandmark.role);
  }

  private updateLandmark(landmark: Pick<Landmark, "ref"> & Partial<Landmark>) {
    const index = this.landmarks.findIndex((l) => l.ref === landmark.ref);
    if (index >= 0) {
      this.landmarks[index] = { ...this.landmarks[index]!, ...landmark };
      this.checkLabels(this.landmarks[index]!.role);
    }
  }

  private removeLandmark(ref: LandmarkRef) {
    this.landmarks = this.landmarks.filter((landmark) => landmark.ref !== ref);
    this.teardownIfNeeded();
  }

  /**
   * Warn if there are 2+ landmarks with the same role but no label.
   * Labels for landmarks with the same role must also be unique.
   *
   * See https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/.
   */
  private checkLabels(role: AriaLandmarkRole) {
    const landmarksWithRole = this.getLandmarksByRole(role);
    if (landmarksWithRole.size > 1) {
      const duplicatesWithoutLabel = [...landmarksWithRole].filter((landmark) => !landmark.label);
      if (duplicatesWithoutLabel.length > 0 && DEV) {
        console.warn(
          `Page contains more than one landmark with the '${role}' role. If two or more landmarks on a page share the same role, all must be labeled with an aria-label or aria-labelledby attribute: `,
          duplicatesWithoutLabel.map((landmark) => landmark.ref()),
        );
      } else if (DEV) {
        const labels = [...landmarksWithRole].map((landmark) => landmark.label);
        const duplicateLabels = labels.filter((item, index) => labels.indexOf(item) !== index);

        duplicateLabels.forEach((label) => {
          console.warn(
            `Page contains more than one landmark with the '${role}' role and '${label}' label. If two or more landmarks on a page share the same role, they must have unique labels: `,
            [...landmarksWithRole].filter((landmark) => landmark.label === label).map((landmark) => landmark.ref()),
          );
        });
      }
    }
  }

  /**
   * Get the landmark that is the closest parent in the DOM.
   * Returns undefined if no parent is a landmark.
   */
  private closestLandmark(element: FocusableElement) {
    const landmarkMap = new Map(this.landmarks.map((l) => [l.ref(), l]));
    let currentElement: Element | null = element;
    while (currentElement && !landmarkMap.has(currentElement as FocusableElement) && currentElement !== document.body && currentElement.parentElement) {
      currentElement = currentElement.parentElement;
    }
    return landmarkMap.get(currentElement as FocusableElement);
  }

  /**
   * Gets the next landmark, in DOM focus order, or previous if backwards is specified.
   * If last landmark, next should be the first landmark.
   * If not inside a landmark, will return first landmark.
   * Returns undefined if there are no landmarks.
   */
  private getNextLandmark(element: FocusableElement, { backward }: { backward?: boolean }) {
    const currentLandmark = this.closestLandmark(element);
    let nextLandmarkIndex = backward ? this.landmarks.length - 1 : 0;
    if (currentLandmark) nextLandmarkIndex = this.landmarks.indexOf(currentLandmark) + (backward ? -1 : 1);

    const wrapIfNeeded = () => {
      // When we reach the end of the landmark sequence, fire a custom event that can be listened for by applications.
      // If this event is canceled, we return immediately. This can be used to implement landmark navigation across iframes.
      if (nextLandmarkIndex < 0) {
        if (!element.dispatchEvent(new CustomEvent("react-aria-landmark-navigation", { detail: { direction: "backward" }, bubbles: true, cancelable: true }))) {
          return true;
        }
        nextLandmarkIndex = this.landmarks.length - 1;
      } else if (nextLandmarkIndex >= this.landmarks.length) {
        if (!element.dispatchEvent(new CustomEvent("react-aria-landmark-navigation", { detail: { direction: "forward" }, bubbles: true, cancelable: true }))) {
          return true;
        }
        nextLandmarkIndex = 0;
      }

      if (nextLandmarkIndex < 0 || nextLandmarkIndex >= this.landmarks.length) return true;
      return false;
    };

    if (wrapIfNeeded()) return undefined;

    // Skip over hidden landmarks.
    const i = nextLandmarkIndex;
    while (this.landmarks[nextLandmarkIndex]!.ref()?.closest("[aria-hidden=true]")) {
      nextLandmarkIndex += backward ? -1 : 1;
      if (wrapIfNeeded()) return undefined;
      if (nextLandmarkIndex === i) break;
    }

    return this.landmarks[nextLandmarkIndex];
  }

  /**
   * Look at next landmark. If an element was previously focused inside, restore focus there.
   * If not, focus the landmark itself.
   * If no landmarks at all, or none with focusable elements, don't move focus.
   */
  private f6Handler(e: KeyboardEvent) {
    if (e.key === "F6") {
      // If alt key pressed, focus main landmark, otherwise navigate forward or backward based on shift key.
      const handled = e.altKey ? this.focusMain() : this.navigate(getEventTarget(e) as FocusableElement, e.shiftKey);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  private focusMain() {
    const main = this.getLandmarkByRole("main");
    const element = main?.ref();
    if (element && element.isConnected) {
      this.focusLandmark(element, "forward");
      return true;
    }
    return false;
  }

  private navigate(from: FocusableElement, backward: boolean) {
    const nextLandmark = this.getNextLandmark(from, { backward });
    if (!nextLandmark) return false;

    // If something was previously focused in the next landmark, then return focus to it
    if (nextLandmark.lastFocused) {
      const lastFocused = nextLandmark.lastFocused;
      if (nodeContains(document.body, lastFocused)) {
        lastFocused.focus();
        return true;
      }
    }

    // Otherwise, focus the landmark itself
    const element = nextLandmark.ref();
    if (element && element.isConnected) {
      this.focusLandmark(element, backward ? "backward" : "forward");
      return true;
    }

    return false;
  }

  /**
   * Sets lastFocused for a landmark, if focus is moved within that landmark.
   * Lets the last focused landmark know it was blurred if something else is focused.
   */
  private focusinHandler(e: FocusEvent) {
    const target = getEventTarget(e) as FocusableElement;
    const currentLandmark = this.closestLandmark(target);
    if (currentLandmark && currentLandmark.ref() !== target) {
      this.updateLandmark({ ref: currentLandmark.ref, lastFocused: target });
    }
    const previousFocusedElement = e.relatedTarget as FocusableElement;
    if (previousFocusedElement) {
      const closestPreviousLandmark = this.closestLandmark(previousFocusedElement);
      if (closestPreviousLandmark && closestPreviousLandmark.ref() === previousFocusedElement) closestPreviousLandmark.blur();
    }
  }

  /**
   * Track if the focus is lost to the body. If it is, do cleanup on the landmark that last had
   * focus.
   */
  private focusoutHandler(e: FocusEvent) {
    const previousFocusedElement = getEventTarget(e) as FocusableElement;
    const nextFocusedElement = e.relatedTarget;
    // the === document seems to be a jest thing for focus to go there on generic blur event such as landmark.blur();
    // browsers appear to send focus instead to document.body and the relatedTarget is null when that happens
    if (!nextFocusedElement || nextFocusedElement === document) {
      const closestPreviousLandmark = this.closestLandmark(previousFocusedElement);
      if (closestPreviousLandmark && closestPreviousLandmark.ref() === previousFocusedElement) closestPreviousLandmark.blur();
    }
  }

  public createLandmarkController(): LandmarkController {
    let instance: LandmarkManager | null = this;
    instance.refCount++;
    instance.setupIfNeeded();
    return {
      navigate(direction, opts) {
        const element = opts?.from || (document!.activeElement as FocusableElement);
        return instance!.navigate(element, direction === "backward");
      },
      focusNext(opts) {
        const element = opts?.from || (document!.activeElement as FocusableElement);
        return instance!.navigate(element, false);
      },
      focusPrevious(opts) {
        const element = opts?.from || (document!.activeElement as FocusableElement);
        return instance!.navigate(element, true);
      },
      focusMain() {
        return instance!.focusMain();
      },
      dispose() {
        if (instance) {
          instance.refCount--;
          instance.teardownIfNeeded();
          instance = null;
        }
      },
    };
  }

  public registerLandmark(landmark: Landmark): () => void {
    if (this.landmarks.find((l) => l.ref === landmark.ref)) this.updateLandmark(landmark);
    else this.addLandmark(landmark);
    return () => this.removeLandmark(landmark.ref);
  }
}

/** Creates a LandmarkController, which allows programmatic navigation of landmarks. */
export function UNSTABLE_createLandmarkController(): LandmarkController {
  // Get the current landmark manager and create a controller using it.
  let instance: LandmarkManagerApi | null = getLandmarkManager();
  let controller = instance?.createLandmarkController();

  const unsubscribe = subscribe(() => {
    // If the landmark manager changes, dispose the old
    // controller and create a new one.
    controller?.dispose();
    instance = getLandmarkManager();
    controller = instance?.createLandmarkController();
  });

  // Return a wrapper that proxies requests to the current controller instance.
  return {
    navigate(direction, opts) {
      return controller!.navigate(direction, opts);
    },
    focusNext(opts) {
      return controller!.focusNext(opts);
    },
    focusPrevious(opts) {
      return controller!.focusPrevious(opts);
    },
    focusMain() {
      return controller!.focusMain();
    },
    dispose() {
      controller?.dispose();
      unsubscribe();
      controller = undefined;
      instance = null;
    },
  };
}

/** @internal Register a landmark with the current manager (and its replacements); returns the cleanup. */
export function registerLandmark(
  ref: LandmarkRef,
  role: AriaLandmarkRole,
  label: string | undefined,
  focus: ((direction: "forward" | "backward") => void) | undefined,
  isLandmarkFocused: { set(value: boolean): unknown },
): () => void {
  const defaultFocus = () => {
    isLandmarkFocused.set(true);
    // RA focuses in an effect after `tabIndex=-1` rendered; focus now, with the attribute in place.
    const element = ref();
    if (element) {
      if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
      element.focus();
    }
  };
  const blur = () => isLandmarkFocused.set(false);
  const register = () => getLandmarkManager()?.registerLandmark({ ref, label, role, focus: focus || defaultFocus, blur });
  let unregister = register();
  const unsubscribe = subscribe(() => {
    unregister?.();
    unregister = register();
  });
  return () => {
    unsubscribe();
    unregister?.();
  };
}
