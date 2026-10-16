// Ported from angular/components src/cdk/a11y/high-contrast-mode/high-contrast-mode-detector.spec.ts,
// MIT, © Google LLC. DOCUMENT / Platform providers → constructor document (null = non-browser).
import "./dom.ts";
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { BLACK_ON_WHITE_CSS_CLASS, HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS, HighContrastMode, HighContrastModeDetector, WHITE_ON_BLACK_CSS_CLASS } from "../a11y/high-contrast.ts";

/** A fake document with a fake `window.getComputedStyle`. */
function getFakeDocument(fakeComputedBackgroundColor: string) {
  return {
    body: document.createElement("body"),
    createElement: (tag: string) => document.createElement(tag),
    querySelectorAll: (selector: string) => document.querySelectorAll(selector),
    defaultView: { getComputedStyle: () => ({ backgroundColor: fakeComputedBackgroundColor }) },
  } as unknown as Document;
}

describe("HighContrastModeDetector", () => {
  it("should detect NONE for non-browser platforms", () => {
    const detector = new HighContrastModeDetector(null);
    assert.equal(detector.getHighContrastMode(), HighContrastMode.NONE, "Expected high-contrast mode `NONE` on non-browser platforms");
  });

  it("should not apply any css classes for non-browser platforms", () => {
    const fakeDocument = getFakeDocument("");
    const detector = new HighContrastModeDetector(null);
    detector._applyBodyHighContrastModeCssClasses();
    assert.equal(fakeDocument.body.className, "", "Expected body not to have any CSS classes in non-browser platforms");
  });

  it("should detect WHITE_ON_BLACK when backgrounds are coerced to black", () => {
    const detector = new HighContrastModeDetector(getFakeDocument("rgb(0,0,0)"));
    assert.equal(detector.getHighContrastMode(), HighContrastMode.WHITE_ON_BLACK);
  });

  it("should detect BLACK_ON_WHITE when backgrounds are coerced to white ", () => {
    const detector = new HighContrastModeDetector(getFakeDocument("rgb(255,255,255)"));
    assert.equal(detector.getHighContrastMode(), HighContrastMode.BLACK_ON_WHITE);
  });

  it("should detect NONE when backgrounds are not coerced ", () => {
    const detector = new HighContrastModeDetector(getFakeDocument("rgb(1,2,3)"));
    assert.equal(detector.getHighContrastMode(), HighContrastMode.NONE);
  });

  // Rivet addition: the Windows 11 theme colours handled by the original but not in its spec.
  it("should detect the Windows 11 themes", () => {
    assert.equal(new HighContrastModeDetector(getFakeDocument("rgb(45, 50, 54)")).getHighContrastMode(), HighContrastMode.WHITE_ON_BLACK);
    assert.equal(new HighContrastModeDetector(getFakeDocument("rgb(32,32,32)")).getHighContrastMode(), HighContrastMode.WHITE_ON_BLACK);
    assert.equal(new HighContrastModeDetector(getFakeDocument("rgb(255,250,239)")).getHighContrastMode(), HighContrastMode.BLACK_ON_WHITE);
  });

  it("should apply css classes for BLACK_ON_WHITE high-contrast mode", () => {
    const fakeDocument = getFakeDocument("rgb(255,255,255)");
    new HighContrastModeDetector(fakeDocument)._applyBodyHighContrastModeCssClasses();
    assert.ok(fakeDocument.body.classList.contains(HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS));
    assert.ok(fakeDocument.body.classList.contains(BLACK_ON_WHITE_CSS_CLASS));
  });

  it("should apply css classes for WHITE_ON_BLACK high-contrast mode", () => {
    const fakeDocument = getFakeDocument("rgb(0,0,0)");
    new HighContrastModeDetector(fakeDocument)._applyBodyHighContrastModeCssClasses();
    assert.ok(fakeDocument.body.classList.contains(HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS));
    assert.ok(fakeDocument.body.classList.contains(WHITE_ON_BLACK_CSS_CLASS));
  });

  it("should not apply any css classes when backgrounds are not coerced", () => {
    const fakeDocument = getFakeDocument("");
    new HighContrastModeDetector(fakeDocument)._applyBodyHighContrastModeCssClasses();
    assert.equal(fakeDocument.body.className, "");
  });
});
