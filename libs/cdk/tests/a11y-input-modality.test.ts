// Ported from angular/components src/cdk/a11y/input-modality/input-modality-detector.spec.ts, MIT,
// © Google LLC. Platform / INPUT_MODALITY_DETECTOR_OPTIONS providers → constructor arguments
// (null document = non-browser).
import { createKeyboardEvent, createMouseEvent, createTouchEvent, dispatch } from "./dom.ts";
import { describe, it, afterEach, vi } from "vitest";
import assert from "node:assert/strict";
import { InputModalityDetector, TOUCH_BUFFER_MS, type InputModality, type InputModalityDetectorOptions } from "../a11y/focus-monitor.ts";

const A = 65, B = 66, C = 67, ALT = 18, CONTROL = 17, MAC_META = 224, META = 91, SHIFT = 16;

describe("InputModalityDetector", () => {
  let detector: InputModalityDetector;
  function setupTest(isBrowser = true, options: InputModalityDetectorOptions = {}) {
    detector = new InputModalityDetector(options, isBrowser ? document : null);
  }
  const keydown = (keyCode = 0) => dispatch(document, createKeyboardEvent("keydown", keyCode));
  const mousedown = () => dispatch(document, createMouseEvent("mousedown"));
  const touchstart = () => dispatch(document, createTouchEvent("touchstart"));
  afterEach(() => {
    detector?.destroy();
    vi.useRealTimers();
  });

  it("should do nothing on non-browser platforms", () => {
    setupTest(false);
    assert.equal(detector.mostRecentModality, null);
    keydown();
    assert.equal(detector.mostRecentModality, null);
    mousedown();
    assert.equal(detector.mostRecentModality, null);
    touchstart();
    assert.equal(detector.mostRecentModality, null);
  });

  it("should detect keyboard input modality", () => {
    setupTest();
    keydown();
    assert.equal(detector.mostRecentModality, "keyboard");
  });

  it("should detect mouse input modality", () => {
    setupTest();
    mousedown();
    assert.equal(detector.mostRecentModality, "mouse");
  });

  it("should detect touch input modality", () => {
    setupTest();
    touchstart();
    assert.equal(detector.mostRecentModality, "touch");
  });

  it("should detect changes in input modality", () => {
    setupTest();
    keydown();
    assert.equal(detector.mostRecentModality, "keyboard");
    mousedown();
    assert.equal(detector.mostRecentModality, "mouse");
    touchstart();
    assert.equal(detector.mostRecentModality, "touch");
    keydown();
    assert.equal(detector.mostRecentModality, "keyboard");
  });

  it("should emit when input modalities are detected", () => {
    setupTest();
    const emitted: InputModality[] = [];
    detector.modalityDetected.subscribe((modality) => emitted.push(modality));
    assert.equal(emitted.length, 0);
    keydown();
    assert.deepEqual(emitted, ["keyboard"]);
    keydown();
    assert.deepEqual(emitted, ["keyboard", "keyboard"]);
    mousedown();
    assert.deepEqual(emitted, ["keyboard", "keyboard", "mouse"]);
    touchstart();
    assert.deepEqual(emitted, ["keyboard", "keyboard", "mouse", "touch"]);
    keydown();
    assert.deepEqual(emitted, ["keyboard", "keyboard", "mouse", "touch", "keyboard"]);
  });

  it("should emit changes in input modality", () => {
    setupTest();
    const emitted: InputModality[] = [];
    detector.modalityChanged.subscribe((modality) => emitted.push(modality));
    assert.equal(emitted.length, 0);
    keydown();
    assert.deepEqual(emitted, ["keyboard"]);
    keydown();
    assert.deepEqual(emitted, ["keyboard"]);
    mousedown();
    assert.deepEqual(emitted, ["keyboard", "mouse"]);
    touchstart();
    assert.deepEqual(emitted, ["keyboard", "mouse", "touch"]);
    touchstart();
    assert.deepEqual(emitted, ["keyboard", "mouse", "touch"]);
    keydown();
    assert.deepEqual(emitted, ["keyboard", "mouse", "touch", "keyboard"]);
  });

  it("should detect fake screen reader mouse events as keyboard input modality on Chrome", () => {
    setupTest();
    dispatch(document, createMouseEvent("mousedown", { detail: 0 }));
    assert.equal(detector.mostRecentModality, "keyboard");
  });

  it("should detect fake screen reader mouse events as keyboard input modality on Firefox", () => {
    setupTest();
    dispatch(document, createMouseEvent("mousedown", { buttons: 0 }));
    assert.equal(detector.mostRecentModality, "keyboard");
  });

  it("should detect fake screen reader touch events as keyboard input modality", () => {
    setupTest();
    const event = createTouchEvent("touchstart");
    Object.defineProperty(event, "touches", { get: () => [{ identifier: -1 }] });
    dispatch(document, event);
    assert.equal(detector.mostRecentModality, "keyboard");
  });

  it("should ignore certain modifier keys by default", () => {
    setupTest();
    keydown(ALT);
    keydown(CONTROL);
    keydown(MAC_META);
    keydown(META);
    keydown(SHIFT);
    assert.equal(detector.mostRecentModality, null);
  });

  it("should not ignore modifier keys if specified", () => {
    setupTest(true, { ignoreKeys: [] });
    keydown(CONTROL);
    assert.equal(detector.mostRecentModality, "keyboard");
  });

  it("should ignore keys if specified", () => {
    setupTest(true, { ignoreKeys: [A, B, C] });
    keydown(A);
    keydown(B);
    keydown(C);
    assert.equal(detector.mostRecentModality, null);
  });

  it("should ignore mouse events that occur too closely after a touch event", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: 1_000_000 });
    setupTest();
    touchstart();
    mousedown();
    assert.equal(detector.mostRecentModality, "touch");
    vi.advanceTimersByTime(TOUCH_BUFFER_MS);
    mousedown();
    assert.equal(detector.mostRecentModality, "mouse");
  });

  it("should complete the various observables on destroy", () => {
    setupTest();
    const modalityDetectedSpy = vi.fn();
    const modalityChangedSpy = vi.fn();
    detector.modalityDetected.subscribe({ complete: modalityDetectedSpy });
    detector.modalityChanged.subscribe({ complete: modalityChangedSpy });
    detector.destroy();
    assert.equal(modalityDetectedSpy.mock.calls.length, 1);
    assert.equal(modalityChangedSpy.mock.calls.length, 1);
  });
});
