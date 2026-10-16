// Ports of React Aria's useModal.test.js, useModalOverlay.test.js, usePreventScroll.test.js and
// DismissButton.test.tsx (Apache-2.0, © Adobe). Components are server-rendered (the HTML a resumed
// page starts from), parsed into happy-dom, then the imperative `modal()` / `modalOverlay()` /
// `preventScroll()` run against it the way the open handler would.
import { describe, test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { installDom } from "./install-dom.ts";
import { importModule, renderHtml } from "./server.ts";

const dom = installDom();
// modal.tsx is a component module: load its server build (modal() is plain DOM code).
const { modal } = await importModule<typeof import("../modal/provider.tsx")>("modal/provider.tsx");
const { modalOverlay } = await import("../overlay/modal-overlay.ts");
const { preventScroll } = await import("../overlay/prevent-scroll.ts");
const { createOverlayTriggerState } = await import("../overlay/overlay-trigger-state.ts");
const fixtureSource = await readFile(new URL("./fixtures/modal-fixture.tsx", import.meta.url), "utf8");
const fixture = await importModule<{ Nested(p: { container?: string }): unknown; Modal(p: object): unknown; Dismiss(): unknown }>(
  "modal-fixture.tsx",
  fixtureSource,
);

beforeEach(() => dom.reset());

async function mountHtml(view: () => unknown, host: Element = document.body) {
  const html = await renderHtml(view);
  host.insertAdjacentHTML("beforeend", html);
}
const q = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const hidden = (el: Element) => el.getAttribute("aria-hidden") === "true";

describe("useModal → modal()", () => {
  test("should set aria-hidden on parent providers on mount and remove on unmount", async () => {
    await mountHtml(() => fixture.Nested({}));
    const rootProvider = q(".root-provider");
    const modalProvider = q(".modal-provider");
    assert.equal(hidden(rootProvider), false);
    const release = modal(q('[data-testid="modal"]'));
    assert.equal(hidden(rootProvider), true);
    assert.equal(hidden(modalProvider), false);
    release();
    assert.equal(rootProvider.hasAttribute("aria-hidden"), false);
  });

  test("should work with nested modals", async () => {
    await mountHtml(() => fixture.Nested({}));
    const rootProvider = q(".root-provider"),
      modalProvider = q(".modal-provider"),
      innerModalProvider = q(".inner-modal-provider");
    // Logical parent links survive the portal move.
    assert.equal(modalProvider.getAttribute("data-rv-modal-parent"), rootProvider.id);
    assert.equal(innerModalProvider.getAttribute("data-rv-modal-parent"), modalProvider.id);
    const releaseOuter = modal(q('[data-testid="modal"]'));
    assert.equal(hidden(rootProvider), true);
    assert.equal(hidden(modalProvider), false);
    const releaseInner = modal(q('[data-testid="inner-modal"]'));
    assert.equal(hidden(rootProvider), true);
    assert.equal(hidden(modalProvider), true);
    assert.equal(hidden(innerModalProvider), false);
    releaseInner();
    assert.equal(hidden(rootProvider), true);
    assert.equal(hidden(modalProvider), false);
    releaseOuter();
    assert.equal(hidden(rootProvider), false);
  });

  test("can specify a different container from the default document.body (moved: links still hold)", async () => {
    const alternate = document.createElement("div");
    alternate.id = "alternateContainer";
    document.body.append(alternate);
    await mountHtml(() => fixture.Nested({ container: "#alternateContainer" }));
    // Simulate the load-time portal moves into the container.
    for (const host of [...document.querySelectorAll("[data-rivet-portal]")].reverse()) alternate.append(host);
    const rootProvider = q(".root-provider"),
      modalProvider = q(".modal-provider"),
      innerModalProvider = q(".inner-modal-provider");
    assert.ok(alternate.contains(modalProvider) && !rootProvider.contains(modalProvider));
    const releaseOuter = modal(q('[data-testid="modal"]'));
    const releaseInner = modal(q('[data-testid="inner-modal"]'));
    assert.equal(hidden(rootProvider), true);
    assert.equal(hidden(modalProvider), true);
    assert.equal(hidden(innerModalProvider), false);
    releaseInner();
    releaseOuter();
    assert.equal(hidden(rootProvider), false);
  });

  test("error state: a modal outside any provider throws", () => {
    const element = document.createElement("div");
    document.body.append(element);
    assert.throws(() => modal(element), /not contained within a provider/);
  });

  test("isDisabled: nothing hidden", async () => {
    await mountHtml(() => fixture.Nested({}));
    modal(q('[data-testid="modal"]'), { isDisabled: true })();
    assert.equal(hidden(q(".root-provider")), false);
  });

  test("modalProps: data-ismodal", async () => {
    await mountHtml(() => fixture.Nested({}));
    assert.equal(q('[data-testid="modal"]').getAttribute("data-ismodal"), "true");
  });
});

describe("useModalOverlay → modalOverlay()", () => {
  const press = () => {
    for (const type of ["pointerdown", "pointerup", "click"])
      document.body.dispatchEvent(new (type === "click" ? MouseEvent : PointerEvent)(type, { bubbles: true, button: 0 }));
  };
  function example(props: Parameters<typeof modalOverlay>[1]) {
    const changes: boolean[] = [];
    const state = createOverlayTriggerState({ defaultOpen: true, onOpenChange: (v) => changes.push(v) });
    const underlay = document.createElement("div"),
      element = document.createElement("div");
    underlay.append(element);
    document.body.append(underlay);
    const release = modalOverlay(element, props, state);
    return { changes, release };
  }

  test("should hide the overlay when clicking outside if shouldCloseOnInteractOutside returns true", () => {
    const { changes, release } = example({ isDismissable: true, shouldCloseOnInteractOutside: (target) => target === document.body });
    press();
    assert.deepEqual(changes, [false]);
    release();
  });

  test("should not hide the overlay when clicking outside if shouldCloseOnInteractOutside returns false", () => {
    const { changes, release } = example({ isDismissable: true, shouldCloseOnInteractOutside: (target) => target !== document.body });
    press();
    assert.deepEqual(changes, []);
    release();
  });

  test("locks scroll while open", () => {
    const { release } = example({});
    assert.equal(document.documentElement.style.overflow, "hidden");
    release();
    assert.notEqual(document.documentElement.style.overflow, "hidden");
  });
});

describe("usePreventScroll → preventScroll()", () => {
  const locked = () => document.documentElement.style.overflow === "hidden";

  test("should set overflow: hidden on the body on mount and remove on unmount", () => {
    assert.equal(locked(), false);
    const release = preventScroll();
    assert.equal(locked(), true);
    release();
    assert.equal(locked(), false);
  });

  test("should work with nested modals", () => {
    const one = preventScroll();
    const two = preventScroll();
    assert.equal(locked(), true);
    two();
    assert.equal(locked(), true);
    one();
    assert.equal(locked(), false);
  });

  test("should work with nested/multiple modals regardless of unmount order", () => {
    const one = preventScroll();
    const two = preventScroll();
    one();
    assert.equal(locked(), true);
    two();
    assert.equal(locked(), false);
  });

  test("should remove overflow: hidden when isDisabled option is true", () => {
    const release = preventScroll();
    assert.equal(locked(), true);
    // Re-render with isDisabled: the effect cleanup runs and the new call does nothing.
    release();
    preventScroll({ isDisabled: true });
    assert.equal(locked(), false);
  });

  test("release is idempotent", () => {
    const one = preventScroll();
    const two = preventScroll();
    one();
    one();
    assert.equal(locked(), true);
    two();
    assert.equal(locked(), false);
  });
});

describe("DismissButton", () => {
  test("labels (server HTML)", async () => {
    await mountHtml(() => fixture.Dismiss());
    const button = (section: string) => q(`#${section} button`);
    assert.equal(button("default").getAttribute("aria-label"), "Dismiss", "should have a default aria-label");
    assert.equal(button("label").getAttribute("aria-label"), "foo", "should accept an aria-label");
    assert.equal(button("labelledby").getAttribute("aria-labelledby"), "span-id", "should accept an aria-labelledby");
    assert.equal(button("labelledby").hasAttribute("aria-label"), false);
    assert.equal(button("both").getAttribute("aria-labelledby"), "self span-id", "should accept an aria-labelledby and aria-label");
    assert.equal(button("both").getAttribute("aria-label"), "foo");
    assert.equal(button("de").getAttribute("aria-label"), "Schließen");
    assert.equal(button("default").getAttribute("tabindex"), "-1");
  });
});
