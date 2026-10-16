// DOM-target suite: `CloseButton`: aria-label, default lucide X icon, custom children, disabled, type=button, render-prop classes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { CloseButton, CloseButtonRoot, closeButtonVariants } = await import("../src/components/close-button/index.ts");

test("close-button: label, type, classes, default X icon", () => {
  const r = render(() => <CloseButton class="ml-auto" />);
  const b = r.container.firstElementChild!;
  assert.equal(b.tagName, "BUTTON");
  assert.equal(b.getAttribute("aria-label"), "Close");
  assert.equal(b.getAttribute("type"), "button");
  assert.equal(b.getAttribute("data-slot"), "close-button");
  assert.equal(b.className, `${closeButtonVariants()} ml-auto`);
  const svg = b.querySelector("svg[data-slot=close-button-icon]")!;
  assert.ok(svg);
  assert.equal(svg.getAttribute("width"), "16");
  r.unmount();
  assert.equal(CloseButton, CloseButtonRoot);
});

test("close-button: custom children replace the icon; aria-label overridable; isDisabled", () => {
  const r = render(() => (
    <CloseButton aria-label="Dismiss" isDisabled>
      <b>x</b>
    </CloseButton>
  ));
  const b = r.container.firstElementChild!;
  assert.equal(b.getAttribute("aria-label"), "Dismiss");
  assert.equal(b.querySelector("svg"), null);
  assert.equal(b.querySelector("b")?.textContent, "x");
  assert.equal(b.hasAttribute("disabled"), true);
  r.unmount();
});
