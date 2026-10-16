// DOM-target suite (happy-dom): `dom.*` lower to DOM v2 (`_spread`) and forward every prop + children.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

const window = installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { dom } = await import("../src/utils/dom.tsx");

test("dom.div mounts with class, data-*, id and children", () => {
  const r = render(() => (
    <dom.div class="card" data-slot="card" id="c1">
      <dom.h3 class="t">Title</dom.h3>
      <dom.p>Body</dom.p>
    </dom.div>
  ));
  assert.equal(r.html(), '<div class="card" data-slot="card" id="c1"><h3 class="t">Title</h3><p>Body</p></div>');
  r.unmount();
});

// Rivet props are snapshots: reactive attributes go in as accessors (spread rule: a function value is an accessor).
test("dom.* accessor props: class, data-* and children follow their signals", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  const c = signal("a");
  const r = render(() => (
    <dom.div class={() => c()} data-x={() => c()}>
      {c()}
    </dom.div>
  ));
  assert.equal(r.html(), '<div class="a" data-x="a">a</div>');
  c.set("b");
  assert.equal(r.html(), '<div class="b" data-x="b">b</div>');
  r.unmount();
});

// `_spread` re-inserts children only when `children` changes: the child node survives an accessor-prop change
// (also resumed: tests-components/resume.test.ts).
test("dom.* accessor class change keeps the JSX child node (client-rendered)", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  const c = signal("a");
  const r = render(() => (
    <dom.div class={() => c()}>
      <span id="child">child</span>
    </dom.div>
  ));
  const child = r.find("#child");
  c.set("b");
  assert.equal(r.html(), '<div class="b"><span id="child">child</span></div>');
  assert.ok(r.find("#child") === child, "child node kept");
  r.unmount();
});

test("dom.* forwards ref to the element", () => {
  let el: Element | undefined;
  const r = render(() => <dom.section ref={(node) => (el = node)} id="s" />);
  assert.ok(el !== undefined && el === r.find("#s"), "ref received the element");
  r.unmount();
});

test("dom.* forwards event handlers through the spread", () => {
  let clicks = 0;
  const r = render(() => <dom.button onClick={() => clicks++}>go</dom.button>);
  r.find("button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event);
  assert.equal(clicks, 1);
  r.unmount();
});
