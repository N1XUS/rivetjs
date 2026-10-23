// Ports of React Aria's useOverlayPosition.test.tsx and usePopover.test.tsx (Apache-2.0, © Adobe) onto
// `overlayPosition()` and `popoverProps()` (popover/use-popover.ts).
// happy-dom stands in for jsdom; "render" = create the trigger / container / overlay / arrow elements and
// call `overlayPosition()` (React re-render with new props = dispose + a new call: props are read once).
// Layout is mocked as upstream: rects, offset sizes from inline styles; client sizes 500 x 768; a fake
// visualViewport.
import { describe, test, beforeEach, afterEach, afterAll } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

const dom = installDom();
const { overlayPosition } = await import("../overlay/position.ts");
const { popoverProps } = await import("../popover/use-popover.ts");
const { registerTrigger } = await import("../overlay/overlay-trigger.tsx");
const { createOverlayTriggerState } = await import("../state/overlays.ts");

type PositionProps = Partial<Parameters<typeof overlayPosition>[0]>;

const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
const saved = new Map<string, PropertyDescriptor | undefined>();
for (const key of ["getBoundingClientRect", "clientHeight", "clientWidth", "offsetWidth", "offsetHeight", "offsetParent"])
  saved.set(key, Object.getOwnPropertyDescriptor(proto, key) ?? Object.getOwnPropertyDescriptor(Element.prototype, key));
const realGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const realGetComputedStyle = window.getComputedStyle;
const win = window as unknown as Record<string, unknown>;
const savedViewport = Object.getOwnPropertyDescriptor(win, "visualViewport");

const px = (value: string) => parseInt(value, 10) || 0;
let clientHeight = 768;

function mockSizes(): void {
  Object.defineProperty(proto, "clientHeight", { configurable: true, get: () => clientHeight });
  Object.defineProperty(proto, "clientWidth", { configurable: true, value: 500 });
  Object.defineProperty(proto, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return px(this.style.width);
    },
  });
  Object.defineProperty(proto, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return px(this.style.height);
    },
  });
}

function mockViewport(): void {
  const viewport = {
    offsetTop: 0,
    height: 768,
    offsetLeft: 0,
    scale: 1,
    width: 500,
    pageLeft: 0,
    pageTop: 0,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
  Object.defineProperty(win, "visualViewport", { configurable: true, writable: true, value: viewport });
  document.body.style.margin = "0";
}

/** Upstream's module-level mock: rects from inline styles; BODY = client size. */
function styleRect(this: HTMLElement) {
  const rect = realGetBoundingClientRect.apply(this);
  if (this.tagName === "BODY") return { ...rect.toJSON?.(), top: rect.top, left: rect.left, height: this.clientHeight, width: this.clientWidth };
  return {
    ...rect.toJSON?.(),
    left: px(this.style.left),
    top: px(this.style.top),
    right: px(this.style.right),
    bottom: px(this.style.bottom),
    width: px(this.style.width),
    height: px(this.style.height),
  };
}

const disposers: (() => void)[] = [];

/** Upstream `<Example>`: trigger (left 10, top `triggerTop`, 100 x 100), container > overlay (300 x 200) > arrow. */
function render({
  triggerTop = 250,
  containerStyle = { width: "600px", height: "600px" } as Record<string, string>,
  parent = document.body as HTMLElement,
  ...props
}: PositionProps & { triggerTop?: number; containerStyle?: Record<string, string>; parent?: HTMLElement } = {}) {
  const trigger = document.createElement("div");
  trigger.dataset.testid = "trigger";
  Object.assign(trigger.style, { left: "10px", top: `${triggerTop}px`, width: "100px", height: "100px" });
  const container = document.createElement("div");
  container.dataset.testid = "container";
  Object.assign(container.style, containerStyle);
  const overlay = document.createElement("div");
  overlay.dataset.testid = "overlay";
  Object.assign(overlay.style, { width: "300px", height: "200px" });
  const arrow = document.createElement("div");
  arrow.dataset.testid = "arrow";
  overlay.append(arrow);
  container.append(overlay);
  parent.append(trigger, container);
  const position = overlayPosition({ target: trigger, overlay, arrow, arrowSize: 8, ...props });
  disposers.push(() => position.dispose());
  return { trigger, container, overlay, arrow, position };
}

function expectStyle(element: HTMLElement, expected: Record<string, string>): void {
  const actual: Record<string, string> = {};
  for (const key of Object.keys(expected)) actual[key] = element.style.getPropertyValue(key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));
  assert.deepEqual(actual, expected);
}

const calls = () => {
  const list: unknown[][] = [];
  const fn = (...args: unknown[]) => void list.push(args);
  return Object.assign(fn, { calls: list });
};

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  dom.reset();
});

afterAll(() => {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(proto, key, descriptor);
    else delete proto[key];
  }
  if (savedViewport) Object.defineProperty(win, "visualViewport", savedViewport);
  else delete win.visualViewport;
  (globalThis as Record<string, unknown>).getComputedStyle = realGetComputedStyle;
  win.getComputedStyle = realGetComputedStyle;
});

describe("useOverlayPosition", () => {
  beforeEach(() => {
    clientHeight = 768;
    mockViewport();
    mockSizes();
    Object.defineProperty(proto, "getBoundingClientRect", { configurable: true, writable: true, value: styleRect });
  });

  test("should position the overlay relative to the trigger", () => {
    const { overlay, arrow, position } = render();
    expectStyle(overlay, { position: "absolute", zIndex: "100000", left: "12px", top: "350px", maxHeight: "406px" });
    assert.equal(position.placement(), "bottom");
    // Arrow should be placed in the center of the button aka trigger left + trigger width / 2 - overlay left.
    expectStyle(arrow, { left: "48px" });
  });

  test("should position the overlay relative to the trigger at top", () => {
    const { overlay, arrow, position } = render({ placement: "top" });
    expectStyle(overlay, { position: "absolute", zIndex: "100000", left: "12px", bottom: "350px", maxHeight: "238px" });
    assert.equal(position.placement(), "top");
    expectStyle(arrow, { left: "48px" });
  });

  test("should update the position on window resize", () => {
    const { overlay, position } = render({ triggerTop: 400 });
    expectStyle(overlay, { left: "12px", top: "500px", maxHeight: "256px" });
    assert.equal(position.placement(), "bottom");

    clientHeight = 1000;
    Object.defineProperty(window.visualViewport, "height", { configurable: true, value: 1000 });
    window.dispatchEvent(new Event("resize"));

    expectStyle(overlay, { left: "12px", top: "500px", maxHeight: "488px" });
    assert.equal(position.placement(), "bottom");
  });

  test("should update the position on props change", () => {
    const first = render();
    expectStyle(first.overlay, { left: "12px", top: "350px", maxHeight: "406px" });
    // rerender(<Example offset={20} />): the hook re-runs with the new props on the same elements.
    first.position.dispose();
    const second = overlayPosition({ target: first.trigger, overlay: first.overlay, arrow: first.arrow, arrowSize: 8, offset: 20 });
    disposers.push(() => second.dispose());
    expectStyle(first.overlay, { left: "12px", top: "370px", maxHeight: "386px" });
  });

  test("should update the overlay's maxHeight by the given one if it's smaller than available viewport height.", () => {
    const first = render({ maxHeight: 450 });
    expectStyle(first.overlay, { left: "12px", top: "350px", maxHeight: "406px" });
    first.position.dispose();
    const second = overlayPosition({ target: first.trigger, overlay: first.overlay, arrow: first.arrow, arrowSize: 8, maxHeight: 150 });
    disposers.push(() => second.dispose());
    expectStyle(first.overlay, { left: "12px", top: "350px", maxHeight: "150px" });
  });

  test("should close the overlay when the trigger scrolls", () => {
    const onClose = calls();
    const scrollable = document.createElement("div");
    scrollable.dataset.testid = "scrollable";
    document.body.append(scrollable);
    const { trigger } = render({ isOpen: true, onClose, parent: scrollable });
    // A real ancestor scroll moves the viewport rect. A queued pre-open scroll notification does not.
    trigger.style.top = "230px";
    scrollable.dispatchEvent(new Event("scroll"));
    assert.equal(onClose.calls.length, 1);
  });

  test("should not close the overlay when an adjacent scrollable region scrolls", () => {
    const onClose = calls();
    const wrapper = document.createElement("div");
    document.body.append(wrapper);
    render({ isOpen: true, onClose, parent: wrapper });
    const scrollable = document.createElement("div");
    scrollable.textContent = "test";
    wrapper.append(scrollable);
    scrollable.dispatchEvent(new Event("scroll"));
    assert.equal(onClose.calls.length, 0);
  });

  test("should close the overlay when the body scrolls", () => {
    const onClose = calls();
    const { trigger } = render({ isOpen: true, onClose });
    trigger.style.top = "230px";
    document.body.dispatchEvent(new Event("scroll"));
    assert.equal(onClose.calls.length, 1);
  });

  test("should close the overlay when the document scrolls", () => {
    const onClose = calls();
    const { trigger } = render({ isOpen: true, onClose });
    trigger.style.top = "230px";
    document.dispatchEvent(new Event("scroll"));
    assert.equal(onClose.calls.length, 1);
  });

  test("should close the overlay when target is window in a scroll event", () => {
    const onClose = calls();
    const { trigger } = render({ isOpen: true, onClose });
    trigger.style.top = "230px";
    window.dispatchEvent(new Event("scroll"));
    assert.equal(onClose.calls.length, 1);
  });

  test("ignores queued pre-open scroll notifications at a stable trigger but closes after actual movement", () => {
    const onClose = calls();
    const parent = document.createElement("div");
    document.body.append(parent);
    const { trigger } = render({ isOpen: true, onClose, parent });
    // These may have been queued by focus/confirmation layout before the overlay opened. Its anchor already has
    // the position they describe; a notification alone must not destroy the newly focused menu.
    for (const target of [parent, document.body, document, window]) target.dispatchEvent(new Event("scroll"));
    assert.equal(onClose.calls.length, 0);
    trigger.style.left = "30px";
    parent.dispatchEvent(new Event("scroll"));
    assert.equal(onClose.calls.length, 1);
  });

  test("arrow should be hidden when using assistive technologies", () => {
    const { arrow } = render();
    assert.equal(arrow.getAttribute("aria-hidden"), "true");
    assert.equal(arrow.getAttribute("role"), "presentation");
  });
});

describe("useOverlayPosition with positioned container", () => {
  beforeEach(() => {
    clientHeight = 768;
    mockViewport();
    mockSizes();
    // Upstream's "real" getBoundingClientRect here is the module-level style mock.
    Object.defineProperty(proto, "getBoundingClientRect", { configurable: true, writable: true, value: styleRect });
    // Make sure container is the offsetParent of overlay.
    Object.defineProperty(proto, "offsetParent", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.testid === "overlay" ? document.querySelector('[data-testid="container"]') : null;
      },
    });
    const positioned = (element: Element) => {
      const style = realGetComputedStyle(element);
      if ((element as HTMLElement).dataset?.testid === "container")
        return new Proxy(style, { get: (target, key) => (key === "position" ? "relative" : Reflect.get(target, key)) });
      return style;
    };
    (globalThis as Record<string, unknown>).getComputedStyle = positioned;
    win.getComputedStyle = positioned;
  });

  afterEach(() => {
    const descriptor = saved.get("offsetParent");
    if (descriptor) Object.defineProperty(proto, "offsetParent", descriptor);
    (globalThis as Record<string, unknown>).getComputedStyle = realGetComputedStyle;
    win.getComputedStyle = realGetComputedStyle;
  });

  test("should position the overlay relative to the trigger", () => {
    const { overlay, arrow, position } = render({ containerStyle: { top: "150px", left: "0px", width: "400px", height: "400px" } });
    // Usually top is at 350, but because container is already offset by 150, top should only be 200.
    expectStyle(overlay, { position: "absolute", zIndex: "100000", left: "12px", top: "200px", maxHeight: "406px" });
    assert.equal(position.placement(), "bottom");
    expectStyle(arrow, { left: "48px" });
  });

  test("should position the overlay relative to the trigger at top", () => {
    const { overlay, arrow, position } = render({ placement: "top", containerStyle: { top: "150px", left: "0px", width: "400px", height: "400px" } });
    // Expect bottom to be at 300; the top of the trigger is 250; container positioned at 150, so relative to
    // container it is 100, from the bottom of the container of height 400 is 300.
    expectStyle(overlay, { position: "absolute", zIndex: "100000", left: "12px", bottom: "300px", maxHeight: "238px" });
    assert.equal(position.placement(), "top");
    expectStyle(arrow, { left: "48px" });
  });
});

describe("usePopover", () => {
  test("should not close popover on scroll", () => {
    const onOpenChange = calls();
    const state = createOverlayTriggerState({ isOpen: true, onOpenChange });
    const wrapper = document.createElement("div");
    const trigger = document.createElement("div");
    const popover = document.createElement("div");
    wrapper.append(trigger, popover);
    document.body.append(wrapper);
    // useOverlayTrigger({type: 'listbox'}, state, triggerRef) registers the trigger's close-on-scroll.
    registerTrigger(trigger, state);
    const aria = popoverProps({ triggerRef: trigger, popoverRef: popover }, state);
    disposers.push(() => aria.dispose());

    document.body.dispatchEvent(new Event("scroll"));
    assert.equal(onOpenChange.calls.length, 0);
  });
});
