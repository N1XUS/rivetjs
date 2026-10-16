// DOM-target suite: `Description` (upstream description tests ported): BEM class, data-slot, cdk Text slot `description`, ref, children.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Provider } = await import("@rivetjs/runtime/dom");
const { TextContext } = await import("@rivetjs/cdk/text");
const { Description, DescriptionRoot } = await import("../src/components/description/index.ts");

test("description: markup (span, class, data-slot, slot)", () => {
  let el: Element | undefined;
  const r = render(() => (
    <Description class="mt-1" ref={(e: Element) => (el = e)}>
      Hint
    </Description>
  ));
  const e = r.container.firstElementChild!;
  assert.equal(e.tagName, "SPAN");
  assert.equal(e.className, "description mt-1");
  assert.equal(e.getAttribute("data-slot"), "description");
  assert.equal(e.textContent, "Hint");
  assert.equal(el, e);
  r.unmount();
  assert.equal(Description, DescriptionRoot);
});

test("description: takes the `description` slot props from TextContext (id for aria-describedby)", () => {
  const r = render(() => (
    <Provider token={TextContext} value={{ slots: { description: { id: "hint-1" } } }}>
      {() => <Description>Hint</Description>}
    </Provider>
  ));
  const e = r.container.querySelector("span")!;
  assert.equal(e.id, "hint-1");
  assert.equal(e.getAttribute("data-slot"), "description");
  r.unmount();
});
