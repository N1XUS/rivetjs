// DOM-target suite: the `render` prop of `dom.*` (cdk `DOMRenderProps` contract; no cast on `{...props}`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

const window = installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { ref } = await import("@rivetjs/runtime/dom");
const { signal } = await import("@rivetjs/reactivity");
const { dom } = await import("../src/utils/dom.tsx");

test("dom.div render: replaces the element, keeps class / data-slot / children / ref", () => {
  const r1 = ref<HTMLElement>();
  const r = render(() => (
    <dom.div ref={r1} id="x" class="c" data-slot="s" render={(props) => <section {...props} />}>
      <b>k</b>
    </dom.div>
  ));
  const el = r.find("#x");
  assert.equal(el.tagName, "SECTION");
  assert.equal(el.className, "c");
  assert.equal(el.getAttribute("data-slot"), "s");
  assert.equal(el.firstElementChild?.tagName, "B");
  assert.ok(r1() === el, "ref attached to the rendered element");
  r.unmount();
});

test("dom.span render receives renderProps undefined and no render attribute", () => {
  let rp: unknown = "unset";
  let seen: Record<string, unknown> = {};
  const r = render(() => (
    <dom.span
      render={(props, renderProps) => {
        rp = renderProps;
        seen = props as Record<string, unknown>;
        return <i {...props} />;
      }}
    >
      x
    </dom.span>
  ));
  assert.equal(rp, undefined);
  assert.ok(!("render" in seen));
  assert.equal(r.html(), "<i>x</i>");
  r.unmount();
});

test("dom.* render: accessor attributes stay reactive", () => {
  const c = signal("a");
  const r = render(() => <dom.div class={() => c()} render={(props) => <section {...props} />} />);
  assert.equal(r.html(), '<section class="a"></section>');
  c.set("b");
  assert.equal(r.html(), '<section class="b"></section>');
  r.unmount();
});

test("dom.* render: event handlers reach the rendered element", () => {
  let clicks = 0;
  const r = render(() => (
    <dom.div role="button" onClick={() => clicks++} render={(props) => <section {...props} />}>
      go
    </dom.div>
  ));
  r.find("section").dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event);
  assert.equal(clicks, 1);
  r.unmount();
});

test("dom.* render: function children stay reactive", () => {
  const c = signal("a");
  const r = render(() => <dom.p render={(props) => <section {...props} />}>{() => c()}</dom.p>);
  assert.equal(r.html(), "<section>a</section>");
  c.set("b");
  assert.equal(r.html(), "<section>b</section>");
  r.unmount();
});
