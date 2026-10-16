// DOM-target suite: `Spinner` (upstream spinner tests ported): role/aria-label/data-slot, size + color modifiers, lucide icon.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Spinner, SpinnerRoot, spinnerVariants } = await import("../src/components/spinner/index.ts");

test("spinner: status role, label, classes, icon svg", () => {
  const r = render(() => <Spinner size="lg" color="danger" class="m-1" />);
  const el = r.container.firstElementChild!;
  assert.equal(el.tagName, "SPAN");
  assert.equal(el.getAttribute("role"), "status");
  assert.equal(el.getAttribute("aria-label"), "Loading");
  assert.equal(el.getAttribute("data-slot"), "spinner");
  assert.equal(el.className, "spinner spinner--danger spinner--lg m-1");
  const svg = el.querySelector("svg")!;
  assert.equal(svg.getAttribute("data-slot"), "spinner-icon");
  assert.equal(svg.getAttribute("viewBox"), "0 0 24 24");
  assert.equal(svg.getAttribute("aria-hidden"), "true");
  r.unmount();
});

test("spinner: defaults (accent / md); aria-label overridable; ref; index exports", () => {
  let el: Element | undefined;
  const r = render(() => <Spinner aria-label="Saving" ref={(e: Element) => (el = e)} />);
  assert.equal(el?.className, "spinner spinner--accent spinner--md");
  assert.equal(el?.getAttribute("aria-label"), "Saving");
  r.unmount();
  assert.equal(Spinner, SpinnerRoot);
  assert.equal(spinnerVariants(), "spinner spinner--accent spinner--md");
});
