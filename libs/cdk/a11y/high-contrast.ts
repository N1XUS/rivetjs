// HighContrastModeDetector: detect Windows high-contrast (forced colors) mode and its theme by
// computing a test element's coerced background, and apply `cdk-high-contrast-*` body classes.
// Ported from Angular CDK a11y high-contrast-mode-detector (angular/components), MIT, © Google LLC.
//
// Rivet: BreakpointObserver replaced by a `(forced-colors: active)` matchMedia listener. Browser only;
// on the server `getHighContrastMode()` returns NONE.

export const HighContrastMode = { NONE: 0, BLACK_ON_WHITE: 1, WHITE_ON_BLACK: 2 } as const;
export type HighContrastMode = (typeof HighContrastMode)[keyof typeof HighContrastMode];

/** Body class in black-on-white high-contrast mode. */
export const BLACK_ON_WHITE_CSS_CLASS = "cdk-high-contrast-black-on-white";
/** Body class in white-on-black high-contrast mode. */
export const WHITE_ON_BLACK_CSS_CLASS = "cdk-high-contrast-white-on-black";
/** Body class in any high-contrast mode. */
export const HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS = "cdk-high-contrast-active";

export class HighContrastModeDetector {
  private _hasCheckedHighContrastMode = false;
  private _document: Document | null;
  private _cleanup: (() => void) | undefined;

  constructor(doc: Document | null = typeof document === "undefined" ? null : document) {
    this._document = doc;
    const win = doc?.defaultView;
    const query = win?.matchMedia?.("(forced-colors: active)");
    if (query) {
      const onChange = () => {
        if (this._hasCheckedHighContrastMode) {
          this._hasCheckedHighContrastMode = false;
          this._applyBodyHighContrastModeCssClasses();
        }
      };
      query.addEventListener?.("change", onChange);
      this._cleanup = () => query.removeEventListener?.("change", onChange);
    }
  }

  /** The current high-contrast mode, from the coerced color of a test element. */
  getHighContrastMode(): HighContrastMode {
    const doc = this._document;
    if (!doc || !doc.body) return HighContrastMode.NONE;
    // An arbitrary color that is neither black nor white; high-contrast mode coerces it.
    const testElement = doc.createElement("div");
    testElement.style.backgroundColor = "rgb(1,2,3)";
    testElement.style.position = "absolute";
    doc.body.appendChild(testElement);
    const documentWindow = doc.defaultView || window;
    const computedStyle = documentWindow && documentWindow.getComputedStyle ? documentWindow.getComputedStyle(testElement) : null;
    const computedColor = ((computedStyle && computedStyle.backgroundColor) || "").replace(/ /g, "");
    testElement.remove();
    switch (computedColor) {
      // Pre Windows 11 dark theme; Windows 11 dark themes.
      case "rgb(0,0,0)":
      case "rgb(45,50,54)":
      case "rgb(32,32,32)":
        return HighContrastMode.WHITE_ON_BLACK;
      // Pre Windows 11 light theme; Windows 11 light theme.
      case "rgb(255,255,255)":
      case "rgb(255,250,239)":
        return HighContrastMode.BLACK_ON_WHITE;
    }
    return HighContrastMode.NONE;
  }

  /** Stop listening for forced-colors changes. */
  destroy(): void {
    this._cleanup?.();
    this._cleanup = undefined;
  }

  /** Apply the high-contrast body classes (once until the mode changes). */
  _applyBodyHighContrastModeCssClasses(): void {
    const doc = this._document;
    if (!this._hasCheckedHighContrastMode && doc && doc.body) {
      const bodyClasses = doc.body.classList;
      bodyClasses.remove(HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS, BLACK_ON_WHITE_CSS_CLASS, WHITE_ON_BLACK_CSS_CLASS);
      this._hasCheckedHighContrastMode = true;
      const mode = this.getHighContrastMode();
      if (mode === HighContrastMode.BLACK_ON_WHITE) bodyClasses.add(HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS, BLACK_ON_WHITE_CSS_CLASS);
      else if (mode === HighContrastMode.WHITE_ON_BLACK) bodyClasses.add(HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS, WHITE_ON_BLACK_CSS_CLASS);
    }
  }
}

let shared: HighContrastModeDetector | null = null;

/** The shared detector (created on first call). */
export function getHighContrastModeDetector(): HighContrastModeDetector {
  return (shared ??= new HighContrastModeDetector());
}
