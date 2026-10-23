// Ports of React Aria's useOverlay.test.js, useOverlayTrigger.test.js and React Stately's
// useOverlayTriggerState behaviour (Apache-2.0, © Adobe) onto `overlay()`, `interactOutside()`,
// `overlayTriggerProps()` / `registerTrigger()`, `overlayPosition()` and `createOverlayTriggerState()`.
// happy-dom stands in for jsdom; "render" = create the elements and call the imperative API.
import { describe, test, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import { signal, untrack } from "@rivetjs/reactivity";
import { installDom } from "./install-dom.ts";

const dom = installDom();
const { overlay, topOverlay } = await import("../overlay/index.ts");
const { createOverlayTriggerState, openOverlay, closeOverlay, toggleOverlay } = await import("../overlay/overlay-trigger-state.ts");
const { overlayTriggerProps, registerTrigger } = await import("../overlay/overlay-trigger.tsx");
const { overlayPosition } = await import("../overlay/position.ts");

type OverlayProps = Parameters<typeof overlay>[1];
let cleanups: (() => void)[] = [];

/** `<Example>`: an underlay div with the overlay div inside, `overlay()` registered. */
function render(props: OverlayProps & { children?: string }) {
  const underlay = document.createElement("div");
  const element = document.createElement("div");
  element.dataset.testid = "test";
  if (props.children) element.innerHTML = props.children;
  underlay.append(element);
  document.body.append(underlay);
  const release = overlay(element, props);
  const unmount = () => {
    release();
    underlay.remove();
  };
  cleanups.push(unmount);
  return { element, unmount };
}

const calls = () => {
  const list: unknown[][] = [];
  const fn = (...args: unknown[]) => void list.push(args);
  return Object.assign(fn, { calls: list });
};

beforeEach(() => dom.reset());
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

const fire = (target: EventTarget, type: string, init: Record<string, unknown> = {}) => {
  const Ctor = type.startsWith("pointer") ? PointerEvent : type.startsWith("key") ? KeyboardEvent : MouseEvent;
  target.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, composed: true, ...init }));
};

// React Aria runs these for mouse, pointer and touch events; interactOutside listens to
// pointerdown + click (pointer events exist in every supported browser).
const pressOutside = () => {
  fire(document.body, "pointerdown", { button: 0, pointerId: 1 });
  fire(document.body, "pointerup", { button: 0, pointerId: 1 });
  fire(document.body, "click", { button: 0 });
};

describe("useOverlay → overlay()", () => {
  test("should hide the overlay when clicking outside if isDismissble is true", () => {
    const onClose = calls();
    render({ isOpen: true, onClose, isDismissable: true });
    pressOutside();
    assert.equal(onClose.calls.length, 1);
  });

  test("should hide the overlay when clicking outside if shouldCloseOnInteractOutside returns true", () => {
    const onClose = calls();
    render({ isOpen: true, onClose, isDismissable: true, shouldCloseOnInteractOutside: (target) => target === document.body });
    pressOutside();
    assert.equal(onClose.calls.length, 1);
  });

  test("should not hide the overlay when clicking outside if shouldCloseOnInteractOutside returns false", () => {
    const onClose = calls();
    render({ isOpen: true, onClose, isDismissable: true, shouldCloseOnInteractOutside: (target) => target !== document.body });
    pressOutside();
    assert.equal(onClose.calls.length, 0);
  });

  test("should not hide the overlay when clicking outside if isDismissable is false", () => {
    const onClose = calls();
    render({ isOpen: true, onClose, isDismissable: false });
    pressOutside();
    assert.equal(onClose.calls.length, 0);
  });

  test("should only hide the top-most overlay", () => {
    const onCloseFirst = calls(),
      onCloseSecond = calls();
    render({ isOpen: true, onClose: onCloseFirst, isDismissable: true });
    const second = render({ isOpen: true, onClose: onCloseSecond, isDismissable: true });
    assert.equal(topOverlay(), second.element);
    pressOutside();
    assert.equal(onCloseSecond.calls.length, 1);
    assert.equal(onCloseFirst.calls.length, 0);
    second.unmount();
    pressOutside();
    assert.equal(onCloseFirst.calls.length, 1);
  });

  test("clicks inside the overlay do not close it; secondary buttons are ignored", () => {
    const onClose = calls();
    const { element } = render({ isOpen: true, onClose, isDismissable: true, children: "<button>x</button>" });
    const button = element.querySelector("button")!;
    fire(button, "pointerdown", { button: 0 });
    fire(button, "click", { button: 0 });
    fire(document.body, "pointerdown", { button: 2 });
    fire(document.body, "click", { button: 2 });
    assert.equal(onClose.calls.length, 0);
  });

  test("should hide the overlay when pressing the escape key", () => {
    const onClose = calls();
    const { element } = render({ isOpen: true, onClose });
    fire(element, "keydown", { key: "Escape" });
    assert.equal(onClose.calls.length, 1);
  });

  test("should still hide the overlay when pressing the escape key if isDismissable is false", () => {
    const onClose = calls();
    const { element } = render({ isOpen: true, onClose, isDismissable: false });
    fire(element, "keydown", { key: "Escape" });
    assert.equal(onClose.calls.length, 1);
  });

  test("Rivet keyTarget: Escape listens on the overlay element, not its group (submenu sharing the root's container)", () => {
    // Root popover: group = its container (holding the root popover and, portaled, the submenu); the submenu
    // registers the same group. Escape inside the submenu reaches only the submenu's own element listener.
    const group = document.createElement("div"),
      root = document.createElement("div"),
      sub = document.createElement("div");
    group.append(root, sub);
    document.body.append(group);
    const closeRoot = calls(),
      closeSub = calls();
    cleanups.push(
      overlay(group, { isOpen: true, onClose: closeRoot, keyTarget: root }),
      overlay(group, { isOpen: true, onClose: closeSub, keyTarget: sub }),
      () => group.remove(),
    );
    fire(sub, "keydown", { key: "Escape" });
    assert.equal(closeSub.calls.length, 1);
    assert.equal(closeRoot.calls.length, 0);
  });

  test("isKeyboardDismissDisabled: Escape does nothing", () => {
    const onClose = calls();
    const { element } = render({ isOpen: true, onClose, isKeyboardDismissDisabled: true });
    fire(element, "keydown", { key: "Escape" });
    assert.equal(onClose.calls.length, 0);
  });

  test("shouldCloseOnBlur: focus moving outside closes, focus lost to body does not", () => {
    const onClose = calls();
    const { element } = render({ isOpen: true, onClose, shouldCloseOnBlur: true, children: "<input>" });
    const outside = document.createElement("button");
    document.body.append(outside);
    const input = element.querySelector("input")!;
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
    assert.equal(onClose.calls.length, 0);
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }));
    assert.equal(onClose.calls.length, 1);
  });
});

describe("useOverlayTriggerState → createOverlayTriggerState()", () => {
  test("uncontrolled: defaultOpen, open / close / toggle, onOpenChange on changes only", () => {
    const onOpenChange = calls();
    const state = createOverlayTriggerState({ defaultOpen: true, onOpenChange });
    assert.equal(untrack(state.isOpen), true);
    openOverlay(state);
    assert.equal(onOpenChange.calls.length, 0);
    toggleOverlay(state);
    assert.equal(untrack(state.isOpen), false);
    closeOverlay(state);
    assert.deepEqual(onOpenChange.calls, [[false]]);
    openOverlay(state);
    assert.deepEqual(onOpenChange.calls, [[false], [true]]);
  });

  test("controlled by a signal (two-way)", () => {
    const isOpen = signal(false);
    const state = createOverlayTriggerState({ isOpen });
    openOverlay(state);
    assert.equal(isOpen(), true);
    isOpen.set(false);
    assert.equal(untrack(state.isOpen), false);
  });

  test("controlled by a read-only accessor: never written, onOpenChange only; follows the source", () => {
    const source = signal(false);
    const onOpenChange = calls();
    const state = createOverlayTriggerState({ isOpen: () => source(), onOpenChange });
    openOverlay(state);
    assert.deepEqual(onOpenChange.calls, [[true]]);
    assert.equal(source(), false);
    source.set(true);
    assert.equal(untrack(state.isOpen), true);
    closeOverlay(state);
    assert.deepEqual(onOpenChange.calls, [[true], [false]]);
  });
});

describe("useOverlayTrigger → overlayTriggerProps() + overlayPosition()", () => {
  test("trigger props: aria-haspopup per type, aria-expanded / aria-controls follow state", () => {
    const state = createOverlayTriggerState();
    const { triggerProps, overlayProps } = overlayTriggerProps({ type: "menu", id: "ov" }, state);
    assert.equal(triggerProps["aria-haspopup"], true);
    assert.equal(overlayProps.id, "ov");
    const expanded = triggerProps["aria-expanded"] as () => boolean | undefined;
    const controls = triggerProps["aria-controls"] as () => string | undefined;
    assert.equal(expanded(), false);
    assert.equal(controls(), undefined);
    openOverlay(state);
    assert.equal(expanded(), true);
    assert.equal(controls(), "ov");
    assert.equal(overlayTriggerProps({ type: "listbox" }, state).triggerProps["aria-haspopup"], "listbox");
    triggerProps.onPress();
    assert.equal(untrack(state.isOpen), false);
  });

  function Example(container: HTMLElement, onOpenChange: (v: boolean) => void) {
    const state = createOverlayTriggerState({ defaultOpen: true, onOpenChange });
    const trigger = document.createElement("div");
    trigger.dataset.testid = "test";
    const overlayElement = document.createElement("div");
    container.append(trigger);
    document.body.append(overlayElement);
    registerTrigger(trigger, state);
    const position = overlayPosition({ target: trigger, overlay: overlayElement });
    cleanups.push(() => position.dispose());
    return { state, trigger };
  }

  test("should close the overlay when the trigger scrolls with useOverlayPosition for backward compatibility", () => {
    const onOpenChange = calls();
    const scrollable = document.createElement("div");
    document.body.append(scrollable);
    const { trigger } = Example(scrollable, onOpenChange);
    // Model the viewport movement caused by scrolling, rather than only dispatching its notification.
    trigger.getBoundingClientRect = () => new DOMRect(0, -20, 0, 0);
    scrollable.dispatchEvent(new Event("scroll"));
    assert.deepEqual(onOpenChange.calls, [[false]]);
  });

  test("should not close the overlay when an adjacent scrollable region scrolls with useOverlayPosition for backward compatibility", () => {
    const onOpenChange = calls();
    const wrapper = document.createElement("div");
    document.body.append(wrapper);
    Example(wrapper, onOpenChange);
    const scrollable = document.createElement("div");
    wrapper.append(scrollable);
    scrollable.dispatchEvent(new Event("scroll"));
    assert.equal(onOpenChange.calls.length, 0);
  });

  test("should close the overlay when the body scrolls with useOverlayPosition for backward compatibility", () => {
    const onOpenChange = calls();
    const { trigger } = Example(document.body, onOpenChange);
    trigger.getBoundingClientRect = () => new DOMRect(0, -20, 0, 0);
    document.body.dispatchEvent(new Event("scroll"));
    assert.deepEqual(onOpenChange.calls, [[false]]);
  });
});
