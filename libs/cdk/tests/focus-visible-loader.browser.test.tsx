// Rivet-only (no upstream suite): the global modality listeners install on first use (resumed pages run no cdk code
// before the first handler), so the first install adopts the resume loader's record of the last input
// (`window.__rvIM`, CDK-PINS 2026-10-12). Without it the modality stays unknown (React Aria's initial state).
import { afterEach, describe, expect, it } from "vitest";
import { _setInteractionModality, getInteractionModality, getPointerType, isFocusVisible, setupGlobalFocusEvents } from "../interactions/focus-visible.tsx";

type LoaderWindow = Window & { __rvIM?: string };

const frames: HTMLIFrameElement[] = [];
/** A fresh window: the listeners install once per window. */
function freshWindow(modality?: string): LoaderWindow {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  frames.push(frame);
  const win = frame.contentWindow as LoaderWindow;
  if (modality !== undefined) win.__rvIM = modality;
  return win;
}

afterEach(() => {
  for (const frame of frames.splice(0)) frame.remove();
  _setInteractionModality(null);
});

describe("focus-visible: resume loader modality", () => {
  it("a pointer press before the first install: pointer modality, focus not visible", () => {
    _setInteractionModality(null);
    const win = freshWindow("mouse");
    setupGlobalFocusEvents(win.document.body);
    expect(getInteractionModality()).toBe("pointer");
    expect(getPointerType()).toBe("mouse");
    expect(isFocusVisible()).toBe(false);
  });

  it("touch / pen keep their pointer type", () => {
    _setInteractionModality(null);
    setupGlobalFocusEvents(freshWindow("touch").document.body);
    expect(getInteractionModality()).toBe("pointer");
    expect(getPointerType()).toBe("touch");
  });

  it("a key press before the first install: keyboard modality", () => {
    _setInteractionModality(null);
    setupGlobalFocusEvents(freshWindow("keyboard").document.body);
    expect(getInteractionModality()).toBe("keyboard");
    expect(isFocusVisible()).toBe(true);
  });

  it("no record (client render) or an unknown value: the modality stays unknown", () => {
    _setInteractionModality(null);
    setupGlobalFocusEvents(freshWindow().document.body);
    expect(getInteractionModality()).toBe(null);
    setupGlobalFocusEvents(freshWindow("gamepad").document.body);
    expect(getInteractionModality()).toBe(null);
  });

  it("a modality tracked already wins over the loader's record", () => {
    _setInteractionModality("keyboard");
    setupGlobalFocusEvents(freshWindow("mouse").document.body);
    expect(getInteractionModality()).toBe("keyboard");
  });
});
