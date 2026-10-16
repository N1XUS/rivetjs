// DOM-target suite: `Header` (upstream tests ported: class, data-slot, children, ref, passthrough).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Header, HeaderRoot, headerVariants } = await import("../src/components/header/index.ts");

test("header: markup, class merge, passthrough, ref", () => {
  let el: Element | undefined;
  const r = render(() => (
    <Header class="px-2" data-foo="bar" ref={(e: Element) => (el = e)}>
      Title
    </Header>
  ));
  assert.equal(r.html(), '<header data-slot="header" data-foo="bar" class="header px-2">Title</header>');
  assert.equal(el?.tagName, "HEADER");
  r.unmount();
  assert.equal(Header, HeaderRoot);
  assert.equal(headerVariants(), "header");
});

test("header: render prop replaces the element, keeps class + data-slot", () => {
  const r = render(() => <Header render={(p) => <h4 {...(p as {})} />}>Sub</Header>);
  assert.equal(r.container.firstElementChild?.tagName, "H4");
  assert.equal(r.container.firstElementChild?.getAttribute("data-slot"), "header");
  assert.match(r.container.firstElementChild!.className, /^header/);
  r.unmount();
});
