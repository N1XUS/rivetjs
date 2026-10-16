// DOM-target suite (happy-dom): `Separator` markup, orientation from `SeparatorContext`, data passthrough (upstream tests ported).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Provider } = await import("@rivetjs/runtime/dom");
const { SeparatorContext } = await import("@rivetjs/cdk/separator");
const { Separator, SeparatorRoot, separatorVariants } = await import("../src/components/separator/index.ts");

test("separator: horizontal default = hr with BEM classes + data-slot", () => {
  const r = render(() => <Separator data-testid="s" />);
  const el = r.container.firstElementChild!;
  assert.equal(el.tagName, "HR");
  assert.equal(el.getAttribute("data-slot"), "separator");
  assert.equal(el.getAttribute("data-orientation"), "horizontal");
  assert.equal(el.className, "separator separator--horizontal separator--default");
  r.unmount();
});

test("separator: orientation / variant modifiers, class, data passthrough", () => {
  const r = render(() => <Separator orientation="vertical" variant="secondary" class="mx-2" data-foo="bar" />);
  const el = r.container.firstElementChild!;
  assert.equal(el.getAttribute("data-orientation"), "vertical");
  assert.equal(el.getAttribute("aria-orientation"), "vertical");
  assert.equal(el.getAttribute("role"), "separator");
  assert.equal(el.getAttribute("data-foo"), "bar");
  assert.equal(el.className, "separator separator--vertical separator--secondary mx-2");
  r.unmount();
});

test("separator: orientation from SeparatorContext when the prop is absent", () => {
  const r = render(() => (
    <Provider token={SeparatorContext} value={{ orientation: "vertical" }}>
      {() => <Separator />}
    </Provider>
  ));
  const el = r.container.firstElementChild!;
  assert.equal(el.getAttribute("data-orientation"), "vertical");
  assert.equal(el.getAttribute("aria-orientation"), "vertical");
  assert.match(el.className, /separator--vertical/);
  r.unmount();
});

test("separator: prop orientation wins over the context; ref forwarded; index exports", () => {
  let el: Element | undefined;
  const r = render(() => (
    <Provider token={SeparatorContext} value={{ orientation: "vertical" }}>
      {() => <Separator orientation="horizontal" ref={(e: Element) => (el = e)} />}
    </Provider>
  ));
  assert.equal(el?.getAttribute("data-orientation"), "horizontal");
  r.unmount();
  assert.equal(Separator, SeparatorRoot);
  assert.equal(Separator.Root, SeparatorRoot);
  assert.equal(separatorVariants({ orientation: "vertical" }), "separator separator--vertical separator--default");
});
