// DOM-target suite: `ErrorMessage` (upstream error-message tests ported): BEM class, data-slot, cdk Text slot `errorMessage`, ref, children.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Provider } = await import("@rivetjs/runtime/dom");
const { TextContext } = await import("@rivetjs/cdk/text");
const { ErrorMessage, ErrorMessageRoot } = await import("../src/components/error-message/index.ts");

test("error-message: markup (span, class, data-slot, slot)", () => {
  let el: Element | undefined;
  const r = render(() => (
    <ErrorMessage class="mt-1" ref={(e: Element) => (el = e)}>
      Hint
    </ErrorMessage>
  ));
  const e = r.container.firstElementChild!;
  assert.equal(e.tagName, "SPAN");
  assert.equal(e.className, "error-message mt-1");
  assert.equal(e.getAttribute("data-slot"), "error-message");
  assert.equal(e.textContent, "Hint");
  assert.equal(el, e);
  r.unmount();
  assert.equal(ErrorMessage, ErrorMessageRoot);
});

test("error-message: takes the `errorMessage` slot props from TextContext (id for aria-describedby)", () => {
  const r = render(() => (
    <Provider token={TextContext} value={{ slots: { errorMessage: { id: "hint-1" } } }}>
      {() => <ErrorMessage>Hint</ErrorMessage>}
    </Provider>
  ));
  const e = r.container.querySelector("span")!;
  assert.equal(e.id, "hint-1");
  assert.equal(e.getAttribute("data-slot"), "error-message");
  r.unmount();
});
