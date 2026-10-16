// DOM-target suite: `Label` (upstream label tests ported): BEM modifiers, data-slot (HeroUI's wins), htmlFor/children, ref.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Label, LabelRoot, labelVariants } = await import("../src/components/label/index.ts");

test("label: markup + data-slot", () => {
  const r = render(() => <Label class="mb-1">Name</Label>);
  assert.equal(r.html(), '<label data-slot="label" class="label mb-1">Name</label>');
  r.unmount();
});

test("label: isRequired / isInvalid / isDisabled → BEM modifiers, not forwarded to the element", () => {
  const r = render(() => (
    <Label isRequired isInvalid isDisabled>
      L
    </Label>
  ));
  const el = r.container.firstElementChild!;
  assert.equal(el.className, "label label--disabled label--invalid label--required");
  assert.equal(el.getAttribute("isrequired"), null);
  r.unmount();
});

test("label: a data-slot passed by the caller is HeroUI's (cdk Text/Label add no data-slot of their own: gap #8 does not apply)", () => {
  const r = render(() => <Label>L</Label>);
  assert.equal(r.container.firstElementChild?.getAttribute("data-slot"), "label");
  r.unmount();
});

test("label: ref, htmlFor, index exports", () => {
  let el: Element | undefined;
  const r = render(() => (
    <Label for="x" ref={(e: Element) => (el = e)}>
      L
    </Label>
  ));
  assert.equal(el?.getAttribute("for"), "x");
  r.unmount();
  assert.equal(Label, LabelRoot);
  assert.equal(labelVariants({ isRequired: true }), "label label--required");
});
