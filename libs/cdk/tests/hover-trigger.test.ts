// Rivet tests (no upstream suite): overlay/safe-area.ts (React Aria useSafeArea port) and
// overlay/hover-trigger.tsx (hover / focus opening for overlay triggers: delay, closeDelay, safe area).
// happy-dom; rects mocked with `mockLayout`; timers faked.
import { describe, test, beforeEach, afterEach, vi } from "vitest";
import assert from "node:assert/strict";
import { untrack } from "@rivetjs/reactivity";
import { installDom, mockLayout } from "./install-dom.ts";

const dom = installDom();
const { isPointInSafeArea, safeArea } = await import("../overlay/safe-area.ts");
const { hoverTriggerProps, attachHoverTrigger } = await import("../overlay/hover-trigger.tsx");
const { createOverlayTriggerState } = await import("../state/overlays.ts");
const { setInteractionModality } = await import("../interactions/focus-visible.tsx");

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;

const pointer = (type: string, init: { pointerType?: string; clientX?: number; clientY?: number } = {}) =>
  new PointerEvent(type, { pointerType: "mouse", bubbles: type !== "pointerenter" && type !== "pointerleave", ...init });

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers();
  dom.reset();
});

describe("isPointInSafeArea", () => {
  // Trigger at (0,0)–(100,20); overlay below and to the right at (200,100)–(400,300).
  const trigger = rect(0, 0, 100, 20),
    overlay = rect(200, 100, 200, 200);

  test("points in the trigger or the overlay are in the safe area", () => {
    assert.equal(isPointInSafeArea({ x: 50, y: 10 }, trigger, overlay), true);
    assert.equal(isPointInSafeArea({ x: 300, y: 200 }, trigger, overlay), true);
  });

  test("a diagonal path across the gap between them is in the safe area", () => {
    for (const t of [0.25, 0.5, 0.75]) {
      const x = 100 + t * (200 - 100),
        y = 20 + t * (100 - 20);
      assert.equal(isPointInSafeArea({ x, y }, trigger, overlay), true, `t=${t}`);
    }
  });

  test("points outside the hull are not", () => {
    assert.equal(isPointInSafeArea({ x: 390, y: 10 }, trigger, overlay), false);
    assert.equal(isPointInSafeArea({ x: 10, y: 290 }, trigger, overlay), false);
  });

  test("without an overlay only the trigger counts", () => {
    assert.equal(isPointInSafeArea({ x: 50, y: 10 }, trigger), true);
    assert.equal(isPointInSafeArea({ x: 150, y: 60 }, trigger), false);
  });
});

function elements() {
  const trigger = document.createElement("button");
  const overlay = document.createElement("div");
  overlay.tabIndex = -1;
  const outside = document.createElement("button");
  document.body.append(trigger, overlay, outside);
  mockLayout(trigger, { left: 0, top: 0, width: 100, height: 20 });
  mockLayout(overlay, { left: 200, top: 100, width: 200, height: 200 });
  return { trigger, overlay, outside };
}

describe("safeArea", () => {
  test("reports pointer moves in / out of the safe area, ignores touch, leaving the document is out; release stops", () => {
    const { trigger, overlay } = elements();
    const seen: boolean[] = [];
    const release = safeArea({ triggerRef: trigger, overlayRef: overlay, onSafeAreaChange: (v) => seen.push(v) });
    window.dispatchEvent(pointer("pointermove", { clientX: 150, clientY: 60 }));
    window.dispatchEvent(pointer("pointermove", { clientX: 390, clientY: 10 }));
    window.dispatchEvent(pointer("pointermove", { pointerType: "touch", clientX: 50, clientY: 10 }));
    document.documentElement.dispatchEvent(new PointerEvent("pointerleave"));
    assert.deepEqual(seen, [true, false, false]);
    release();
    window.dispatchEvent(pointer("pointermove", { clientX: 50, clientY: 10 }));
    assert.deepEqual(seen, [true, false, false]);
  });

  test("isDisabled tracks nothing", () => {
    const { trigger, overlay } = elements();
    const seen: boolean[] = [];
    cleanups.push(safeArea({ triggerRef: trigger, overlayRef: overlay, isDisabled: true, onSafeAreaChange: (v) => seen.push(v) }));
    window.dispatchEvent(pointer("pointermove", { clientX: 50, clientY: 10 }));
    assert.deepEqual(seen, []);
  });
});

describe("hoverTriggerProps / attachHoverTrigger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setInteractionModality("pointer");
  });

  function setup(options: { trigger?: "hover" | "focus"; delay?: number; closeDelay?: number; isDisabled?: boolean } = {}) {
    const els = elements();
    const state = createOverlayTriggerState();
    const props = { ...options, triggerRef: els.trigger, overlayRef: () => (untrack(state.isOpen) ? els.overlay : null) };
    const { triggerProps, overlayProps } = hoverTriggerProps(props, state);
    for (const [name, fn] of Object.entries(triggerProps)) els.trigger.addEventListener(name.slice(2).toLowerCase(), fn as EventListener);
    els.overlay.addEventListener("focusin", () => overlayProps.onFocusWithin());
    els.overlay.addEventListener("focusout", (e) => {
      if (!els.overlay.contains((e as FocusEvent).relatedTarget as Node)) overlayProps.onBlurWithin(e as FocusEvent);
    });
    // The open overlay's client effect.
    let release: (() => void) | null = null;
    const sync = () => {
      if (untrack(state.isOpen) && !release) release = attachHoverTrigger(props, state);
      if (!untrack(state.isOpen) && release) (release(), (release = null));
    };
    cleanups.push(() => release?.());
    const isOpen = () => (sync(), untrack(state.isOpen));
    return { ...els, state, isOpen, sync };
  }

  test("hover opens after the delay (default 300 ms); leaving the trigger before that cancels", () => {
    const t = setup();
    t.trigger.dispatchEvent(pointer("pointerenter"));
    vi.advanceTimersByTime(299);
    assert.equal(t.isOpen(), false);
    t.trigger.dispatchEvent(pointer("pointerleave"));
    vi.advanceTimersByTime(500);
    assert.equal(t.isOpen(), false);
    t.trigger.dispatchEvent(pointer("pointerenter"));
    vi.advanceTimersByTime(300);
    assert.equal(t.isOpen(), true);
  });

  test("the safe area keeps the overlay open on the way into it (closeDelay 0); leaving it closes", () => {
    const t = setup({ delay: 0, closeDelay: 0 });
    t.trigger.dispatchEvent(pointer("pointerenter"));
    assert.equal(t.isOpen(), true);
    t.trigger.dispatchEvent(pointer("pointerleave"));
    window.dispatchEvent(pointer("pointermove", { clientX: 150, clientY: 60 }));
    window.dispatchEvent(pointer("pointermove", { clientX: 300, clientY: 200 }));
    assert.equal(t.isOpen(), true);
    window.dispatchEvent(pointer("pointermove", { clientX: 390, clientY: 10 }));
    assert.equal(t.isOpen(), false);
  });

  test("leaving the safe area closes after closeDelay; coming back within it cancels the close", () => {
    const t = setup({ delay: 0, closeDelay: 200 });
    t.trigger.dispatchEvent(pointer("pointerenter"));
    assert.equal(t.isOpen(), true);
    window.dispatchEvent(pointer("pointermove", { clientX: 390, clientY: 10 }));
    vi.advanceTimersByTime(150);
    window.dispatchEvent(pointer("pointermove", { clientX: 300, clientY: 200 }));
    vi.advanceTimersByTime(500);
    assert.equal(t.isOpen(), true);
    window.dispatchEvent(pointer("pointermove", { clientX: 390, clientY: 10 }));
    vi.advanceTimersByTime(199);
    assert.equal(t.isOpen(), true);
    vi.advanceTimersByTime(1);
    assert.equal(t.isOpen(), false);
  });

  test('touch, trigger="focus" and isDisabled never open on hover', () => {
    const touch = setup({ delay: 0 });
    touch.trigger.dispatchEvent(pointer("pointerenter", { pointerType: "touch" }));
    assert.equal(touch.isOpen(), false);
    const focus = setup({ delay: 0, trigger: "focus" });
    focus.trigger.dispatchEvent(pointer("pointerenter"));
    assert.equal(focus.isOpen(), false);
    const disabled = setup({ delay: 0, isDisabled: true });
    disabled.trigger.dispatchEvent(pointer("pointerenter"));
    assert.equal(disabled.isOpen(), false);
  });

  test("keyboard focus opens immediately; pointer focus does not", () => {
    const t = setup({ trigger: "focus" });
    t.trigger.focus();
    assert.equal(t.isOpen(), false);
    t.trigger.blur();
    setInteractionModality("keyboard");
    t.trigger.focus();
    assert.equal(t.isOpen(), true);
  });

  test("focus moving into the overlay keeps it open; leaving both closes", () => {
    const t = setup({ trigger: "focus" });
    setInteractionModality("keyboard");
    t.trigger.focus();
    assert.equal(t.isOpen(), true);
    t.overlay.focus();
    assert.equal(t.isOpen(), true);
    t.outside.focus();
    assert.equal(t.isOpen(), false);
  });

  test("focus within the overlay keeps a hover-opened overlay open when the pointer leaves the safe area", () => {
    const t = setup({ delay: 0, closeDelay: 0 });
    t.trigger.dispatchEvent(pointer("pointerenter"));
    assert.equal(t.isOpen(), true);
    t.overlay.focus();
    window.dispatchEvent(pointer("pointermove", { clientX: 390, clientY: 10 }));
    assert.equal(t.isOpen(), true);
    t.outside.focus();
    assert.equal(t.isOpen(), false);
  });
});
